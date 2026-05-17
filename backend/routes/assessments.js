'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

function calcNextLifeDeadline(lastDate, frequency) {
  if (!lastDate || !frequency) return null;
  const months = frequency === 'quarterly' ? 3 : 6;
  const d = new Date(lastDate);
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-10`;
}

// PUT /api/assessments/:id - アセスメント更新（自動保存）
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const {
    claiming_status, claiming_tier, responsible_name, responsible_role,
    current_concerns, has_past_findings, past_audit_findings, notes,
    last_life_submission_date,
  } = req.body;

  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id);
  if (!assessment) return res.status(404).json({ error: 'Not found' });

  const subsidy = db.prepare('SELECT life_frequency FROM subsidies WHERE id = ?').get(assessment.subsidy_id);
  const next_submission_deadline = calcNextLifeDeadline(
    last_life_submission_date,
    subsidy?.life_frequency,
  );

  db.prepare(`
    UPDATE assessments SET
      claiming_status = ?, claiming_tier = ?,
      responsible_name = ?, responsible_role = ?,
      current_concerns = ?, has_past_findings = ?,
      past_audit_findings = ?, notes = ?,
      last_life_submission_date = ?,
      next_submission_deadline = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    claiming_status ?? assessment.claiming_status,
    claiming_tier ?? assessment.claiming_tier,
    responsible_name ?? assessment.responsible_name,
    responsible_role ?? assessment.responsible_role,
    current_concerns ?? assessment.current_concerns,
    has_past_findings ?? assessment.has_past_findings,
    past_audit_findings ?? assessment.past_audit_findings,
    notes ?? assessment.notes,
    last_life_submission_date ?? assessment.last_life_submission_date,
    next_submission_deadline ?? assessment.next_submission_deadline,
    id,
  );

  res.json({ ok: true });
});

// POST /api/assessments - 新規作成（存在しない場合）
router.post('/', (req, res) => {
  const db = getDb();
  const { subsidy_id, service_type_id } = req.body;

  if (!subsidy_id || !service_type_id) {
    return res.status(400).json({ error: 'subsidy_id と service_type_id が必要です' });
  }

  const subsidy = db.prepare('SELECT applicable_services FROM subsidies WHERE id = ?').get(subsidy_id);
  if (!subsidy) return res.status(404).json({ error: '加算が見つかりません' });

  const st = db.prepare('SELECT code FROM service_types WHERE id = ?').get(service_type_id);
  if (!st) return res.status(404).json({ error: 'サービス種別が見つかりません' });

  if (subsidy.applicable_services !== 'all' &&
      !subsidy.applicable_services.split(',').includes(st.code)) {
    return res.status(400).json({ error: 'このサービス種別には対応していない加算です' });
  }

  const existing = db.prepare(
    'SELECT id FROM assessments WHERE subsidy_id = ? AND service_type_id = ?'
  ).get(subsidy_id, service_type_id);

  if (existing) return res.json({ id: existing.id, created: false });

  const result = db.prepare(
    'INSERT INTO assessments (subsidy_id, service_type_id) VALUES (?,?)'
  ).run(subsidy_id, service_type_id);

  res.json({ id: result.lastInsertRowid, created: true });
});

// POST /api/assessments/:id/requirement-checks - 要件チェック一括保存
router.post('/:id/requirement-checks', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { checks } = req.body; // [{ requirement_item_id, is_satisfied, notes }]

  if (!Array.isArray(checks)) return res.status(400).json({ error: 'checks は配列が必要です' });

  const upsert = db.prepare(`
    INSERT INTO requirement_checks (assessment_id, requirement_item_id, is_satisfied, notes)
    VALUES (?,?,?,?)
    ON CONFLICT(assessment_id, requirement_item_id)
    DO UPDATE SET is_satisfied = excluded.is_satisfied,
                  notes = excluded.notes,
                  checked_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const c of checks) {
      upsert.run(id, c.requirement_item_id, c.is_satisfied ?? null, c.notes || null);
    }
  })();

  res.json({ ok: true });
});

// POST /api/assessments/:id/evidence-checks - 根拠書類確認一括保存
router.post('/:id/evidence-checks', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { checks } = req.body;

  if (!Array.isArray(checks)) return res.status(400).json({ error: 'checks は配列が必要です' });

  const upsert = db.prepare(`
    INSERT INTO evidence_checks (assessment_id, evidence_template_def_id, is_confirmed, confirmed_date, notes)
    VALUES (?,?,?,?,?)
    ON CONFLICT(assessment_id, evidence_template_def_id)
    DO UPDATE SET is_confirmed = excluded.is_confirmed,
                  confirmed_date = excluded.confirmed_date,
                  notes = excluded.notes,
                  checked_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const c of checks) {
      upsert.run(
        id, c.evidence_template_def_id,
        c.is_confirmed ?? null,
        c.confirmed_date || null,
        c.notes || null,
      );
    }
  })();

  res.json({ ok: true });
});

module.exports = router;
