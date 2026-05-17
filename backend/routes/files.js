'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/db');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const { assessmentId, evidenceDefId } = req.params;
    const dir = path.join(
      __dirname, '../..', 'data', 'uploads',
      'assessments', String(assessmentId),
      String(evidenceDefId || 'general'),
    );
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
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg', 'image/png',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('PDF・Excel・CSV・画像ファイルのみアップロードできます'));
    }
  },
});

// POST /api/assessments/:assessmentId/evidence/:evidenceDefId/files
router.post(
  '/assessments/:assessmentId/evidence/:evidenceDefId/files',
  upload.single('file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'ファイルが必要です' });

    const db = getDb();
    const { assessmentId, evidenceDefId } = req.params;

    const result = db.prepare(`
      INSERT INTO evidence_files
        (assessment_id, evidence_template_def_id, original_name, stored_path, file_size_bytes, mime_type, note)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      assessmentId,
      evidenceDefId === 'general' ? null : evidenceDefId,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      req.body.note || null,
    );

    res.json({ id: result.lastInsertRowid, name: req.file.originalname });
  }
);

// DELETE /api/files/:fileId
router.delete('/files/:fileId', (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM evidence_files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Not found' });

  if (fs.existsSync(file.stored_path)) {
    fs.unlinkSync(file.stored_path);
  }
  db.prepare('DELETE FROM evidence_files WHERE id = ?').run(req.params.fileId);
  res.json({ ok: true });
});

// GET /api/files/:fileId/download
router.get('/files/:fileId/download', (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM evidence_files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Not found' });
  res.download(file.stored_path, file.original_name);
});

module.exports = router;
