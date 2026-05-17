'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/subsidies?service_type=unit&status=claiming
router.get('/', (req, res) => {
  const db = getDb();
  const { service_type, status } = req.query;

  let where = '1=1';
  const params = [];

  if (service_type) {
    where += ` AND (s.applicable_services = 'all' OR s.applicable_services LIKE ?)`;
    params.push(`%${service_type}%`);
  }
  if (status) {
    where += ` AND a.claiming_status = ?`;
    params.push(status);
  }

  const rows = db.prepare(`
    SELECT
      s.id, s.code, s.name_ja, s.category, s.sort_order,
      s.legal_basis, s.notification_no, s.latest_info_vol,
      s.requires_life, s.life_frequency, s.applicable_services,
      a.id AS assessment_id, a.claiming_status, a.claiming_tier,
      a.responsible_name, a.current_concerns, a.has_past_findings,
      st.id AS service_type_id, st.code AS service_type_code,
      st.name_ja AS service_type_name,
      awr.risk_level, awr.failed_req_count,
      awr.req_ok_rate, awr.evidence_ok_rate
    FROM subsidies s
    JOIN service_types st ON (
      s.applicable_services = 'all'
      OR s.applicable_services LIKE '%' || st.code || '%'
    )
    LEFT JOIN assessments a ON a.subsidy_id = s.id AND a.service_type_id = st.id
    LEFT JOIN assessment_with_risk awr ON awr.id = a.id
    WHERE ${where}
    ORDER BY st.sort_order, s.category, s.sort_order
  `).all(...params);

  res.json(rows);
});

// GET /api/subsidies/:subsidyId/service-types/:serviceTypeId
router.get('/:subsidyId/service-types/:serviceTypeId', (req, res) => {
  const db = getDb();
  const { subsidyId, serviceTypeId } = req.params;

  const row = db.prepare(`
    SELECT
      s.*, st.code AS service_type_code, st.name_ja AS service_type_name,
      a.id AS assessment_id, a.claiming_status, a.claiming_tier,
      a.responsible_name, a.responsible_role, a.current_concerns,
      a.has_past_findings, a.past_audit_findings, a.notes,
      a.last_life_submission_date, a.next_submission_deadline,
      awr.risk_level, awr.failed_req_count,
      awr.req_ok_rate, awr.evidence_ok_rate
    FROM subsidies s
    JOIN service_types st ON st.id = ?
    LEFT JOIN assessments a ON a.subsidy_id = s.id AND a.service_type_id = ?
    LEFT JOIN assessment_with_risk awr ON awr.id = a.id
    WHERE s.id = ?
  `).get(serviceTypeId, serviceTypeId, subsidyId);

  if (!row) return res.status(404).json({ error: '加算が見つかりません' });

  // チェック項目
  const reqItems = db.prepare(`
    SELECT ri.*, rc.is_satisfied, rc.notes AS check_notes, rc.checked_at
    FROM requirement_items ri
    LEFT JOIN requirement_checks rc ON rc.requirement_item_id = ri.id
      AND rc.assessment_id = ?
    WHERE ri.subsidy_id = ?
      AND (ri.service_type_id = 0 OR ri.service_type_id = ?)
    ORDER BY ri.sort_order
  `).all(row.assessment_id || -1, subsidyId, serviceTypeId);

  // 根拠書類テンプレート
  const evidenceTemplates = db.prepare(`
    SELECT etd.*, ec.is_confirmed, ec.confirmed_date, ec.notes AS evidence_notes
    FROM evidence_template_definitions etd
    LEFT JOIN evidence_checks ec ON ec.evidence_template_def_id = etd.id
      AND ec.assessment_id = ?
    WHERE etd.subsidy_id = ?
      AND (etd.service_type_id = 0 OR etd.service_type_id = ?)
    ORDER BY etd.sort_order
  `).all(row.assessment_id || -1, subsidyId, serviceTypeId);

  // 添付ファイル
  const files = row.assessment_id
    ? db.prepare('SELECT * FROM evidence_files WHERE assessment_id = ? ORDER BY uploaded_at DESC')
        .all(row.assessment_id)
    : [];

  // 届出履歴
  const notifications = db.prepare(`
    SELECT * FROM notification_history
    WHERE subsidy_id = ? AND service_type_id = ?
    ORDER BY filed_date DESC
  `).all(subsidyId, serviceTypeId);

  res.json({ ...row, reqItems, evidenceTemplates, files, notifications });
});

module.exports = router;
