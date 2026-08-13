'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { requireRole } = require('../middleware/auth');
const { recordAudit } = require('../services/auditLog');

const canEdit = requireRole('admin', 'staff');

// GET /api/residence-cases?stage=&worker_id=&q=
router.get('/', (req, res) => {
  const db = getDb();
  const { stage, worker_id, q } = req.query;

  let where = '1=1';
  const params = [];
  if (stage) {
    where += ' AND rc.stage = ?';
    params.push(stage);
  }
  if (worker_id) {
    where += ' AND rc.foreign_worker_id = ?';
    params.push(worker_id);
  }
  if (q) {
    where += ' AND (fw.name_native LIKE ? OR fw.name_romaji LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like);
  }

  const rows = db.prepare(`
    SELECT id, foreign_worker_id, name_native, name_romaji, nationality,
           case_type, stage, submission_deadline, submitted_date,
           responsible_name, document_total, document_submitted
    FROM residence_case_with_progress rc
    WHERE ${where}
    ORDER BY
      CASE stage
        WHEN 'collecting' THEN 0 WHEN 'drafting' THEN 1 WHEN 'internal_review' THEN 2
        WHEN 'ready_to_submit' THEN 3 WHEN 'submitted' THEN 4
        WHEN 'approved' THEN 5 WHEN 'rejected' THEN 6 ELSE 7
      END,
      submission_deadline IS NULL, submission_deadline ASC
  `).all(...params);

  res.json(rows);
});

// GET /api/residence-cases/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const caseRow = db.prepare('SELECT * FROM residence_case_with_progress WHERE id = ?').get(req.params.id);
  if (!caseRow) return res.status(404).json({ error: '案件が見つかりません' });

  const documents = db.prepare(`
    SELECT cdi.*, cdc.id AS check_id, cdc.is_submitted, cdc.submitted_date, cdc.notes
    FROM case_document_items cdi
    LEFT JOIN case_document_checks cdc ON cdc.case_document_item_id = cdi.id AND cdc.residence_case_id = ?
    WHERE cdi.case_type = ?
    ORDER BY cdi.sort_order
  `).all(req.params.id, caseRow.case_type);

  const history = db.prepare(`
    SELECT h.*, u.display_name AS changed_by_name
    FROM residence_case_status_history h
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.residence_case_id = ?
    ORDER BY h.changed_at DESC
  `).all(req.params.id);

  recordAudit(req, { action: 'view', entityType: 'residence_case', entityId: Number(req.params.id) });
  res.json({ ...caseRow, documents, history });
});

// POST /api/residence-cases
router.post('/', canEdit, (req, res) => {
  const db = getDb();
  const { foreign_worker_id, case_type, submission_deadline, responsible_user_id, notes } = req.body;

  if (!foreign_worker_id || !case_type) {
    return res.status(400).json({ error: 'foreign_worker_id, case_type が必要です' });
  }

  const worker = db.prepare('SELECT id FROM foreign_workers WHERE id = ?').get(foreign_worker_id);
  if (!worker) return res.status(404).json({ error: '従業員が見つかりません' });

  const result = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO residence_cases (foreign_worker_id, case_type, submission_deadline, responsible_user_id, notes)
      VALUES (?,?,?,?,?)
    `).run(foreign_worker_id, case_type, submission_deadline || null, responsible_user_id || null, notes || null);

    db.prepare(`
      INSERT INTO residence_case_status_history (residence_case_id, from_stage, to_stage, changed_by)
      VALUES (?, NULL, 'collecting', ?)
    `).run(r.lastInsertRowid, req.session.userId);

    return r;
  })();

  recordAudit(req, { action: 'create', entityType: 'residence_case', entityId: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/residence-cases/:id
router.put('/:id', canEdit, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM residence_cases WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '案件が見つかりません' });

  const b = req.body;
  const fields = ['submission_deadline', 'submitted_date', 'decided_date', 'decision_result', 'decision_notes', 'responsible_user_id', 'notes'];
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (b[f] !== undefined ? b[f] : existing[f]));

  db.prepare(`UPDATE residence_cases SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values, id);

  recordAudit(req, { action: 'update', entityType: 'residence_case', entityId: Number(id) });
  res.json({ ok: true });
});

// PUT /api/residence-cases/:id/stage
router.put('/:id/stage', canEdit, (req, res) => {
  const db = getDb();
  const { stage, comment } = req.body;
  const validStages = ['collecting', 'drafting', 'internal_review', 'ready_to_submit', 'submitted', 'approved', 'rejected'];
  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: 'stage が不正です' });
  }

  const existing = db.prepare('SELECT * FROM residence_cases WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '案件が見つかりません' });

  db.transaction(() => {
    db.prepare(`UPDATE residence_cases SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(stage, req.params.id);

    db.prepare(`
      INSERT INTO residence_case_status_history (residence_case_id, from_stage, to_stage, comment, changed_by)
      VALUES (?,?,?,?,?)
    `).run(req.params.id, existing.stage, stage, comment || null, req.session.userId);
  })();

  recordAudit(req, { action: 'update', entityType: 'residence_case', entityId: Number(req.params.id), before: { stage: existing.stage }, after: { stage } });
  res.json({ ok: true });
});

// GET /api/residence-cases/case-document-items?case_type=
router.get('/case-document-items/:caseType', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM case_document_items WHERE case_type = ? ORDER BY sort_order')
    .all(req.params.caseType);
  res.json(rows);
});

// POST /api/residence-cases/:id/document-checks
router.post('/:id/document-checks', canEdit, (req, res) => {
  const db = getDb();
  const { checks } = req.body; // [{ case_document_item_id, is_submitted, submitted_date, notes }]
  if (!Array.isArray(checks)) return res.status(400).json({ error: 'checks は配列が必要です' });

  const upsert = db.prepare(`
    INSERT INTO case_document_checks (residence_case_id, case_document_item_id, is_submitted, submitted_date, notes)
    VALUES (?,?,?,?,?)
    ON CONFLICT(residence_case_id, case_document_item_id)
    DO UPDATE SET is_submitted = excluded.is_submitted,
                  submitted_date = excluded.submitted_date,
                  notes = excluded.notes,
                  checked_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const c of checks) {
      upsert.run(req.params.id, c.case_document_item_id, c.is_submitted ?? null, c.submitted_date || null, c.notes || null);
    }
  })();

  recordAudit(req, { action: 'update', entityType: 'residence_case_documents', entityId: Number(req.params.id) });
  res.json({ ok: true });
});

module.exports = router;
