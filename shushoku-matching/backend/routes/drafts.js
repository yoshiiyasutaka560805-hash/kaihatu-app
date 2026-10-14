'use strict';

// 承認待ちの下書き：受付フォーム（求職者本人入力）・面談メモAI抽出・求人票AI読取
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { readConditionSheet } = require('../services/conditionSheet');
const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
const { getDb, getSettings, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf, ah } = require('../utils/validate');
const { extractFromMemo, SCHEMA: MEMO_SCHEMA } = require('../services/ai/memoExtract');
const { normalizePosting, nextOwnPostingNo } = require('../services/postingStore');
const { todayJst, addMonths } = require('../utils/dates');
const { currentOperator } = require('../middleware/context');
const { detectProhibited } = require('../services/ai/pii');
const { applyHearing } = require('../services/hearing');

router.get('/', (req, res) => {
  const rows = getDb().prepare(`SELECT d.*, s.name AS seeker_name FROM drafts d LEFT JOIN job_seekers s ON s.id = d.seeker_id
    WHERE d.status = ? ORDER BY d.id DESC LIMIT 200`).all(req.query.status || 'pending');
  res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data) })));
});

// 面談メモ → AI抽出 → 下書き
router.post('/memo', ah(async (req, res) => {
  const db = getDb();
  const seeker = db.prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(req.body.seeker_id);
  if (!seeker) return res.status(404).json({ error: '求職者が見つかりません' });
  if (!seeker.ai_consent) return res.status(409).json({ error: '求職者のAI利用同意がありません' });
  const memo = String(req.body.memo || '').trim();
  if (!memo) return res.status(400).json({ error: 'メモを入力してください' });
  const { data } = await extractFromMemo(seeker, memo);
  const r = db.prepare("INSERT INTO drafts (kind, seeker_id, data, source_name) VALUES ('seeker_memo', ?, ?, '面談メモ')").run(seeker.id, JSON.stringify(data));
  audit('draft_create', r.lastInsertRowid, { kind: 'seeker_memo' });
  res.json({ draftId: r.lastInsertRowid, data });
}));

// 条件表（Excel・Word・PDF）の取込 → 下書き
//   seeker_id 指定時は既存の求職者を更新、なければ新規登録用
//   ai_ok=1 は「本人から外部AI利用の同意を得ている」ことを担当者が確認した場合のみ
router.post('/sheet', sheetUpload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '条件表のファイルを選択してください' });
  const db = getDb();
  const seekerId = req.body.seeker_id ? Number(req.body.seeker_id) : null;
  const seeker = seekerId ? db.prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(seekerId) : null;
  if (seekerId && !seeker) return res.status(404).json({ error: '求職者が見つかりません' });
  const allowAi = seeker ? Boolean(seeker.ai_consent) : req.body.ai_ok === '1';
  const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const r = await readConditionSheet(req.file.buffer, filename, req.file.mimetype,
    { knownNames: seeker ? [seeker.name, seeker.name_kana] : [], allowAi, seekerId });
  const payload = { ...r.data, ...(seeker ? {} : { ai_consent: req.body.ai_ok === '1' ? 1 : 0 }) };
  const ins = db.prepare("INSERT INTO drafts (kind, seeker_id, data, source_name) VALUES ('seeker_sheet', ?, ?, ?)")
    .run(seekerId, JSON.stringify({ fields: payload, method: r.method, uncertain: r.uncertain }), `条件表：${filename}`);
  audit('draft_create', ins.lastInsertRowid, { kind: 'seeker_sheet', method: r.method });
  res.json({ draftId: ins.lastInsertRowid, method: r.method, data: payload, uncertain: r.uncertain, preview: r.preview || null, seeker_id: seekerId });
}));

router.post('/:id/reject', (req, res) => {
  getDb().prepare("UPDATE drafts SET status = 'rejected', reviewed_at = datetime('now','localtime'), reviewed_by = ? WHERE id = ? AND status = 'pending'")
    .run(currentOperator(), req.params.id);
  audit('draft_reject', req.params.id);
  res.json({ ok: true });
});

// 承認：body.data に担当者が確認・修正した値を渡す
router.post('/:id/approve', (req, res) => {
  const db = getDb();
  const d = db.prepare("SELECT * FROM drafts WHERE id = ? AND status = 'pending'").get(req.params.id);
  if (!d) return res.status(404).json({ error: '承認待ちの下書きが見つかりません' });
  const data = req.body.data || JSON.parse(d.data);
  let resultId;
  let prohibited = [];
  if (d.kind === 'seeker_memo') {
    // AI抽出で扱う希望条件の項目のみ反映（氏名・連絡先・ステータス・同意等は変更させない）
    const allowed = Object.keys(MEMO_SCHEMA.properties).filter(k => k in specs.seeker);
    const o = validate(Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k))), specs.seeker);
    for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
    const cols = columnsOf(o, specs.seeker);
    if (cols.length) db.prepare(`UPDATE job_seekers SET ${cols.map(c => `${c} = @${c}`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...o, id: d.seeker_id });
    resultId = d.seeker_id;
    prohibited = detectProhibited([o.notes, o.experience_note, o.priorities]);
  } else if (d.kind === 'seeker_sheet') {
    const fields = data.fields || data;
    if (d.seeker_id) {
      const cur = db.prepare('SELECT * FROM job_seekers WHERE id = ?').get(d.seeker_id);
      const o = applyHearing(validate(fields, specs.seeker), cur);
      for (const k of ['name', 'status', 'consent_date', 'accepted_date', 'validity_end']) delete o[k];
      for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
      const cols = columnsOf(o, specs.seeker);
      if (cols.length) db.prepare(`UPDATE job_seekers SET ${cols.map(c => `${c} = @${c}`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...o, id: d.seeker_id });
      resultId = d.seeker_id;
      prohibited = detectProhibited([o.notes, o.experience_note, o.priorities]);
    } else {
      const o = applyHearing(validate(fields, specs.seeker, { required: ['name', 'consent_date'] }));
      o.accepted_date = o.accepted_date || todayJst();
      o.validity_end = o.validity_end || addMonths(o.accepted_date, Number(getSettings().seeker_validity_months || 3));
      const cols = columnsOf(o, specs.seeker);
      resultId = db.prepare(`INSERT INTO job_seekers (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(o).lastInsertRowid;
      prohibited = detectProhibited([o.notes, o.experience_note, o.priorities]);
    }
  } else if (d.kind === 'seeker_intake') {
    const o = validate(data, specs.seeker, { required: ['name', 'consent_date'] });
    o.accepted_date = o.accepted_date || todayJst();
    o.validity_end = o.validity_end || addMonths(o.accepted_date, Number(getSettings().seeker_validity_months || 3));
    const cols = columnsOf(o, specs.seeker);
    resultId = db.prepare(`INSERT INTO job_seekers (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(o).lastInsertRowid;
    prohibited = detectProhibited([o.notes, o.experience_note, o.priorities]);
  } else if (d.kind === 'posting_ocr') {
    const fields = data.fields || data;
    const employerId = Number(req.body.employer_id);
    if (!employerId) return res.status(400).json({ error: '求人票の事業所を選択してください（自社受理求人として登録します）' });
    const emp = db.prepare('SELECT * FROM employers WHERE id = ? AND deleted_at IS NULL').get(employerId);
    if (!emp) return res.status(400).json({ error: '事業所が見つかりません' });
    let p;
    try {
      p = normalizePosting({ ...fields, posting_no: 'TMP', company_name: fields.company_name || emp.name, job_title: fields.job_title || '（未入力）' });
    } catch (e) {
      return res.status(400).json({ error: e.message.replace('求人番号 TMP: ', '') });
    }
    const hwNo = fields.posting_no && /^\d{5}-\d{8}$/.test(fields.posting_no) ? fields.posting_no : null;
    Object.assign(p, { posting_no: nextOwnPostingNo(), origin: 'own', employer_id: employerId, hw_posting_no: hwNo,
      received_date: p.received_date || todayJst(), source: 'ocr', source_file: d.source_name });
    const cols = Object.keys(p);
    resultId = db.prepare(`INSERT INTO job_postings (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(p).lastInsertRowid;
  } else return res.status(400).json({ error: '不明な下書きです' });

  db.prepare("UPDATE drafts SET status = 'approved', result_id = ?, reviewed_at = datetime('now','localtime'), reviewed_by = ? WHERE id = ?")
    .run(resultId, currentOperator(), d.id);
  audit('draft_approve', d.id, { kind: d.kind, result: resultId });
  res.json({ ok: true, resultId, prohibited });
});

module.exports = router;
