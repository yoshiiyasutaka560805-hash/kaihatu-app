'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/db');
const { requireRole } = require('../middleware/auth');
const { recordAudit } = require('../services/auditLog');

const canEdit = requireRole('admin', 'staff');

// GET /api/workers?status=&nationality=&expiring_within=90&q=
router.get('/', (req, res) => {
  const db = getDb();
  const { status, nationality, expiring_within, q } = req.query;

  let where = 'fw.is_active = 1';
  const params = [];

  if (status) {
    where += ' AND fw.employment_status = ?';
    params.push(status);
  }
  if (nationality) {
    where += ' AND fw.nationality = ?';
    params.push(nationality);
  }
  if (expiring_within) {
    where += " AND fw.residence_period_to IS NOT NULL AND fw.residence_period_to <= date('now', ?)";
    params.push(`+${parseInt(expiring_within, 10)} days`);
  }
  if (q) {
    where += ' AND (fw.name_native LIKE ? OR fw.name_kana LIKE ? OR fw.name_romaji LIKE ? OR fw.employee_no LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const rows = db.prepare(`
    SELECT id, employee_no, name_native, name_kana, name_romaji, nationality,
           residence_status, residence_period_to, employment_status, department,
           note_count, file_count, residence_risk_level
    FROM foreign_worker_with_risk fw
    WHERE ${where}
    ORDER BY residence_period_to IS NULL, residence_period_to ASC
  `).all(...params);

  res.json(rows);
});

// GET /api/workers/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const worker = db.prepare('SELECT * FROM foreign_worker_with_risk WHERE id = ?').get(req.params.id);
  if (!worker) return res.status(404).json({ error: '従業員が見つかりません' });

  const notes = db.prepare(`
    SELECT wn.*, u.display_name AS author_name
    FROM worker_notes wn
    JOIN users u ON u.id = wn.author_user_id
    WHERE wn.foreign_worker_id = ?
    ORDER BY wn.created_at DESC
  `).all(req.params.id);

  const files = db.prepare(`
    SELECT id, category, original_name, file_size_bytes, mime_type, note, uploaded_at
    FROM worker_files
    WHERE foreign_worker_id = ?
    ORDER BY uploaded_at DESC
  `).all(req.params.id);

  recordAudit(req, { action: 'view', entityType: 'foreign_worker', entityId: Number(req.params.id) });

  res.json({ ...worker, notes, files });
});

// POST /api/workers
router.post('/', canEdit, (req, res) => {
  const db = getDb();
  const b = req.body;

  if (!b.name_native || !b.name_romaji || !b.nationality) {
    return res.status(400).json({ error: 'name_native, name_romaji, nationality が必要です' });
  }

  const result = db.prepare(`
    INSERT INTO foreign_workers (
      employee_no, name_native, name_kana, name_romaji, date_of_birth, gender,
      nationality, native_language, passport_no, passport_expiry_date,
      residence_card_no, residence_status, specific_skill_field,
      residence_period_from, residence_period_to, japanese_level,
      employment_start_date, employment_end_date, employment_status, department,
      address, phone, email, emergency_contact_name, emergency_contact_relation,
      emergency_contact_phone, created_by, updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    b.employee_no || null, b.name_native, b.name_kana || null, b.name_romaji,
    b.date_of_birth || null, b.gender || null, b.nationality, b.native_language || null,
    b.passport_no || null, b.passport_expiry_date || null, b.residence_card_no || null,
    b.residence_status || null, b.specific_skill_field || null,
    b.residence_period_from || null, b.residence_period_to || null, b.japanese_level || null,
    b.employment_start_date || null, b.employment_end_date || null,
    b.employment_status || 'active', b.department || null,
    b.address || null, b.phone || null, b.email || null,
    b.emergency_contact_name || null, b.emergency_contact_relation || null,
    b.emergency_contact_phone || null,
    req.session.userId, req.session.userId,
  );

  recordAudit(req, { action: 'create', entityType: 'foreign_worker', entityId: result.lastInsertRowid, after: b });
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/workers/:id
router.put('/:id', canEdit, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const worker = db.prepare('SELECT * FROM foreign_workers WHERE id = ?').get(id);
  if (!worker) return res.status(404).json({ error: '従業員が見つかりません' });

  const b = req.body;
  const fields = [
    'employee_no', 'name_native', 'name_kana', 'name_romaji', 'date_of_birth', 'gender',
    'nationality', 'native_language', 'passport_no', 'passport_expiry_date',
    'residence_card_no', 'residence_status', 'specific_skill_field',
    'residence_period_from', 'residence_period_to', 'japanese_level',
    'employment_start_date', 'employment_end_date', 'employment_status', 'department',
    'address', 'phone', 'email', 'emergency_contact_name', 'emergency_contact_relation',
    'emergency_contact_phone',
  ];

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (b[f] !== undefined ? b[f] : worker[f]));

  db.prepare(`
    UPDATE foreign_workers SET ${setClause}, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(...values, req.session.userId, id);

  recordAudit(req, { action: 'update', entityType: 'foreign_worker', entityId: Number(id), before: worker, after: b });
  res.json({ ok: true });
});

// PUT /api/workers/:id/deactivate
router.put('/:id/deactivate', canEdit, (req, res) => {
  const db = getDb();
  const worker = db.prepare('SELECT id FROM foreign_workers WHERE id = ?').get(req.params.id);
  if (!worker) return res.status(404).json({ error: '従業員が見つかりません' });

  db.prepare('UPDATE foreign_workers SET is_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(req.session.userId, req.params.id);

  recordAudit(req, { action: 'update', entityType: 'foreign_worker', entityId: Number(req.params.id), after: { is_active: false } });
  res.json({ ok: true });
});

// ============================================================
// メモ
// ============================================================

// GET /api/workers/:id/notes
router.get('/:id/notes', (req, res) => {
  const db = getDb();
  const notes = db.prepare(`
    SELECT wn.*, u.display_name AS author_name
    FROM worker_notes wn
    JOIN users u ON u.id = wn.author_user_id
    WHERE wn.foreign_worker_id = ?
    ORDER BY wn.created_at DESC
  `).all(req.params.id);
  res.json(notes);
});

// POST /api/workers/:id/notes
router.post('/:id/notes', canEdit, (req, res) => {
  const db = getDb();
  const { note_type, content, is_important } = req.body;
  if (!content) return res.status(400).json({ error: 'content が必要です' });

  const worker = db.prepare('SELECT id FROM foreign_workers WHERE id = ?').get(req.params.id);
  if (!worker) return res.status(404).json({ error: '従業員が見つかりません' });

  const result = db.prepare(`
    INSERT INTO worker_notes (foreign_worker_id, note_type, content, is_important, author_user_id)
    VALUES (?,?,?,?,?)
  `).run(req.params.id, note_type || 'general', content, is_important ? 1 : 0, req.session.userId);

  recordAudit(req, { action: 'create', entityType: 'worker_note', entityId: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/workers/:id/notes/:noteId
router.put('/:id/notes/:noteId', canEdit, (req, res) => {
  const db = getDb();
  const note = db.prepare('SELECT * FROM worker_notes WHERE id = ? AND foreign_worker_id = ?')
    .get(req.params.noteId, req.params.id);
  if (!note) return res.status(404).json({ error: 'メモが見つかりません' });

  const { note_type, content, is_important } = req.body;
  db.prepare(`
    UPDATE worker_notes SET note_type = ?, content = ?, is_important = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    note_type ?? note.note_type,
    content ?? note.content,
    is_important !== undefined ? (is_important ? 1 : 0) : note.is_important,
    req.params.noteId,
  );

  recordAudit(req, { action: 'update', entityType: 'worker_note', entityId: Number(req.params.noteId) });
  res.json({ ok: true });
});

// DELETE /api/workers/:id/notes/:noteId
router.delete('/:id/notes/:noteId', canEdit, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM worker_notes WHERE id = ? AND foreign_worker_id = ?')
    .run(req.params.noteId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'メモが見つかりません' });

  recordAudit(req, { action: 'delete', entityType: 'worker_note', entityId: Number(req.params.noteId) });
  res.json({ ok: true });
});

// ============================================================
// 添付ファイル（在留カード・パスポート写し等）
// ============================================================

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../..', 'data', 'uploads', 'workers', String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_ぁ-んァ-ン一-龠]/gu, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('PDF・画像ファイルのみアップロードできます'));
    }
  },
});

// POST /api/workers/:id/files
router.post('/:id/files', canEdit, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが必要です' });

  const db = getDb();
  const worker = db.prepare('SELECT id FROM foreign_workers WHERE id = ?').get(req.params.id);
  if (!worker) return res.status(404).json({ error: '従業員が見つかりません' });

  const category = req.body.category || 'other';
  const validCategories = ['residence_card', 'passport', 'contract', 'certificate', 'support_evidence', 'photo', 'other'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'category が不正です' });
  }

  const result = db.prepare(`
    INSERT INTO worker_files (foreign_worker_id, category, original_name, stored_path, file_size_bytes, mime_type, note, uploaded_by)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    req.params.id, category, req.file.originalname, req.file.path,
    req.file.size, req.file.mimetype, req.body.note || null, req.session.userId,
  );

  recordAudit(req, { action: 'file_upload', entityType: 'worker_file', entityId: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid, name: req.file.originalname });
});

// GET /api/workers/:id/files/:fileId/download
router.get('/:id/files/:fileId/download', (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM worker_files WHERE id = ? AND foreign_worker_id = ?')
    .get(req.params.fileId, req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });

  recordAudit(req, { action: 'file_download', entityType: 'worker_file', entityId: file.id });
  res.download(file.stored_path, file.original_name);
});

// DELETE /api/workers/:id/files/:fileId
router.delete('/:id/files/:fileId', canEdit, (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM worker_files WHERE id = ? AND foreign_worker_id = ?')
    .get(req.params.fileId, req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });

  if (fs.existsSync(file.stored_path)) {
    fs.unlinkSync(file.stored_path);
  }
  db.prepare('DELETE FROM worker_files WHERE id = ?').run(req.params.fileId);

  recordAudit(req, { action: 'delete', entityType: 'worker_file', entityId: file.id });
  res.json({ ok: true });
});

module.exports = router;
