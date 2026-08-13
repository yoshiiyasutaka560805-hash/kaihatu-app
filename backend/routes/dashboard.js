'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/dashboard - ダッシュボード用サマリー
router.get('/', (req, res) => {
  const db = getDb();

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN risk_level = 'red'    THEN 1 ELSE 0 END) AS red_count,
      SUM(CASE WHEN risk_level = 'yellow' THEN 1 ELSE 0 END) AS yellow_count,
      SUM(CASE WHEN risk_level = 'green'  THEN 1 ELSE 0 END) AS green_count,
      SUM(CASE WHEN claiming_status = 'claiming' THEN 1 ELSE 0 END) AS claiming_count
    FROM assessment_with_risk
  `).get();

  const redItems = db.prepare(`
    SELECT id, subsidy_id, service_type_id, subsidy_name, service_type_name,
           claiming_tier, failed_req_count, current_concerns
    FROM assessment_with_risk
    WHERE risk_level = 'red' AND claiming_status = 'claiming'
    ORDER BY failed_req_count DESC
  `).all();

  const yellowItems = db.prepare(`
    SELECT id, subsidy_id, service_type_id, subsidy_name, service_type_name,
           claiming_tier, current_concerns, claiming_status
    FROM assessment_with_risk
    WHERE risk_level = 'yellow'
    ORDER BY service_type_id, subsidy_id
  `).all();

  const lawAlerts = db.prepare(`
    SELECT la.*, ls.source_name, ls.source_url
    FROM law_update_alerts la
    JOIN law_update_sources ls ON ls.id = la.source_id
    WHERE la.is_acknowledged = 0
    ORDER BY la.detected_at DESC
  `).all();

  const activeDeductions = db.prepare(`
    SELECT dr.*, st.name_ja AS service_type_name
    FROM deduction_records dr
    JOIN service_types st ON st.id = dr.service_type_id
    WHERE dr.end_date IS NULL
    ORDER BY dr.start_date DESC
  `).all();

  res.json({ summary, redItems, yellowItems, lawAlerts, activeDeductions });
});

// GET /api/dashboard/alerts - アラート一覧
router.get('/alerts', (req, res) => {
  const db = getDb();
  const alerts = db.prepare(`
    SELECT id, subsidy_id, service_type_id, subsidy_name, service_type_name,
           risk_level, claiming_status, failed_req_count, current_concerns,
           next_submission_deadline
    FROM assessment_with_risk
    WHERE risk_level IN ('red','yellow') AND claiming_status = 'claiming'
    ORDER BY
      CASE risk_level WHEN 'red' THEN 0 ELSE 1 END,
      failed_req_count DESC
  `).all();
  res.json(alerts);
});

// GET /api/dashboard/specific-skill - 特定技能外国人管理サマリー
router.get('/specific-skill', (req, res) => {
  const db = getDb();

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_active,
      SUM(CASE WHEN residence_risk_level = 'red'    THEN 1 ELSE 0 END) AS red_count,
      SUM(CASE WHEN residence_risk_level = 'yellow' THEN 1 ELSE 0 END) AS yellow_count
    FROM foreign_worker_with_risk
    WHERE is_active = 1 AND employment_status = 'active'
  `).get();

  const unacknowledgedAlerts = db.prepare(`
    SELECT COUNT(*) AS count FROM residence_alerts WHERE is_acknowledged = 0
  `).get();

  const upcomingExpiries = db.prepare(`
    SELECT id, name_native, residence_period_to, residence_risk_level
    FROM foreign_worker_with_risk
    WHERE is_active = 1 AND employment_status = 'active'
      AND residence_period_to IS NOT NULL AND residence_period_to <= date('now', '+90 days')
    ORDER BY residence_period_to ASC
    LIMIT 5
  `).all();

  res.json({ summary, unacknowledgedAlertCount: unacknowledgedAlerts.count, upcomingExpiries });
});

module.exports = router;
