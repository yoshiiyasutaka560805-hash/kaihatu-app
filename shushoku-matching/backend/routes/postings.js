'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getDb, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf, ah } = require('../utils/validate');
const { todayJst } = require('../utils/dates');
const { nextOwnPostingNo, disclosureMissing, IMPORT_FIELDS } = require('../services/postingStore');
const { importCsvBuffer } = require('../services/sources/manualImport');
const { runFetch } = require('../services/scheduler');
const { rematchActiveSeekers } = require('../services/matching/runner');
const { readPosting } = require('../services/ai/postingOcr');
const { withLock } = require('../utils/lock');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } });
const ocrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

function load(id) {
  const p = getDb().prepare('SELECT * FROM job_postings WHERE id = ?').get(id);
  if (!p) throw Object.assign(new Error('求人が見つかりません'), { status: 404 });
  return p;
}

router.get('/', (req, res) => {
  const where = [];
  const params = {};
  if (req.query.active !== 'all') where.push('is_active = 1');
  if (req.query.origin) { where.push('origin = @origin'); params.origin = req.query.origin; }
  if (req.query.employerId) { where.push('employer_id = @eid'); params.eid = req.query.employerId; }
  if (req.query.q) {
    where.push('(company_name LIKE @q OR job_title LIKE @q OR job_category LIKE @q OR posting_no LIKE @q OR facility_type LIKE @q)');
    params.q = `%${req.query.q}%`;
  }
  if (req.query.city) { where.push('city LIKE @city'); params.city = `%${req.query.city}%`; }
  res.json(getDb().prepare(`SELECT id, posting_no, origin, employer_id, company_name, prefecture, city, job_title, facility_type,
    employment_type, wage_type, wage_min, wage_max, expiry_date, received_date, source, source_file, source_url, is_active, closed_manually, hw_posting_no
    FROM job_postings ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY fetched_at DESC LIMIT 1000`).all(params));
});

router.get('/runs', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM fetch_runs ORDER BY id DESC LIMIT 50').all());
});

router.get('/:id', (req, res) => {
  const p = load(req.params.id);
  const own = p.origin === 'own' ? null : getDb().prepare("SELECT id, posting_no FROM job_postings WHERE hw_posting_no = ? AND origin = 'own'").get(p.posting_no);
  res.json({ ...p, disclosure_missing: p.origin === 'own' ? disclosureMissing(p) : null, own_copy: own || null,
    referrals: getDb().prepare(`SELECT m.id, m.intro_status, s.name, s.id AS seeker_id FROM matches m JOIN job_seekers s ON s.id = m.seeker_id
      WHERE m.posting_id = ? AND s.deleted_at IS NULL AND m.intro_status <> '未提案'`).all(p.id) });
});

// 自社受理求人の新規登録
router.post('/', (req, res) => {
  const o = validate(req.body, specs.posting, { required: ['employer_id', 'job_title'] });
  const emp = getDb().prepare('SELECT * FROM employers WHERE id = ? AND deleted_at IS NULL').get(o.employer_id);
  if (!emp) return res.status(400).json({ error: '事業所を選択してください' });
  Object.assign(o, { origin: 'own', posting_no: nextOwnPostingNo(), company_name: o.company_name || emp.name,
    received_date: o.received_date || todayJst() });
  const cols = [...columnsOf(o, specs.posting)];
  const r = getDb().prepare(`INSERT INTO job_postings (${cols.join(',')}, source) VALUES (${cols.map(c => '@' + c).join(',')}, 'own')`).run(o);
  audit('posting_create', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid, posting_no: o.posting_no, disclosure_missing: disclosureMissing(o) });
});

// 編集は自社受理求人のみ（HW求人は取込データのため編集不可）
router.put('/:id', (req, res) => {
  const p = load(req.params.id);
  if (p.origin !== 'own') return res.status(400).json({ error: 'ハローワーク求人は編集できません。「自社求人化」してから編集してください' });
  const o = validate(req.body, specs.posting);
  delete o.posting_no; delete o.origin; delete o.hw_posting_no;
  const cols = columnsOf(o, specs.posting);
  if (cols.length) getDb().prepare(`UPDATE job_postings SET ${cols.map(c => `${c} = @${c}`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...o, id: p.id });
  audit('posting_update', p.id, { fields: cols });
  res.json({ ok: true, disclosure_missing: disclosureMissing({ ...p, ...o }) });
});

// HW求人 → 自社受理求人：求人者へ連絡し、求人申込みの受理と手数料・返戻金の合意を得た後に実行
router.post('/:id/convert', (req, res) => {
  const db = getDb();
  const p = load(req.params.id);
  if (p.origin === 'own') return res.status(400).json({ error: '既に自社求人です' });
  const exist = db.prepare("SELECT id FROM job_postings WHERE hw_posting_no = ? AND origin = 'own'").get(p.posting_no);
  if (exist) return res.status(409).json({ error: '自社求人化済みです', id: exist.id });
  const o = validate(req.body, { employer_id: 'int', received_date: 'date', expiry_date: 'date', confirmed: 'bool' });
  if (!o.confirmed) return res.status(400).json({ error: '求人者からの求人申込みの受理と、手数料・返戻金の合意を確認してください' });
  let employerId = o.employer_id;
  if (!employerId) {
    employerId = db.prepare('INSERT INTO employers (name, prefecture, city, address) VALUES (?,?,?,?)')
      .run(p.company_name, p.prefecture, p.city, p.address).lastInsertRowid;
  }
  const copy = {};
  for (const f of IMPORT_FIELDS) if (f !== 'posting_no' && f !== 'source_url') copy[f] = p[f];
  Object.assign(copy, { posting_no: nextOwnPostingNo(), origin: 'own', employer_id: employerId, hw_posting_no: p.posting_no,
    received_date: o.received_date || todayJst(), expiry_date: o.expiry_date || p.expiry_date, source: 'own' });
  const cols = Object.keys(copy);
  const id = db.prepare(`INSERT INTO job_postings (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(copy).lastInsertRowid;
  // 既存の候補（未提案）を自社求人側に付け替え
  db.prepare("UPDATE matches SET posting_id = ? WHERE posting_id = ? AND intro_status = '未提案' AND seeker_id NOT IN (SELECT seeker_id FROM matches WHERE posting_id = ?)").run(id, p.id, id);
  audit('posting_convert', id, { from: p.posting_no });
  res.json({ id, posting_no: copy.posting_no, employer_id: employerId, disclosure_missing: disclosureMissing(copy) });
});

router.put('/:id/active', (req, res) => {
  const p = load(req.params.id);
  const active = req.body.active ? 1 : 0;
  getDb().prepare("UPDATE job_postings SET is_active = ?, closed_manually = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(active, active ? 0 : 1, p.id);
  audit('posting_active', p.id, { active });
  res.json({ ok: true });
});

router.post('/import-csv', csvUpload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSVファイルを選択してください' });
  const r = await withLock('fetch', async () => importCsvBuffer(req.file.buffer, req.file.originalname));
  audit('import', 'manual_csv', { file: req.file.originalname, inserted: r.inserted, updated: r.updated, errors: r.errors.length });
  const rematch = await rematchActiveSeekers();
  res.json({ ...r, rematch });
}));

router.post('/fetch-now', ah(async (req, res) => res.json(await runFetch())));

// 求人票（PDF・画像）のAI読み取り → 下書き
router.post('/ocr', ocrUpload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルを選択してください' });
  const parsed = await readPosting(req.file.buffer, req.file.mimetype, req.file.originalname);
  const r = getDb().prepare("INSERT INTO drafts (kind, data, source_name) VALUES ('posting_ocr', ?, ?)")
    .run(JSON.stringify(parsed), req.file.originalname);
  audit('draft_create', r.lastInsertRowid, { kind: 'posting_ocr' });
  res.json({ draftId: r.lastInsertRowid, ...parsed });
}));

module.exports = router;
