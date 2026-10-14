'use strict';

// 求職者本人による受付フォーム（事務所のPC・タブレットで入力）→ 承認待ち下書き
const express = require('express');
const router = express.Router();
const { getDb, getSettings, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate } = require('../utils/validate');
const { todayJst } = require('../utils/dates');
const { runAs } = require('../middleware/context');

const INTAKE_FIELDS = ['name', 'name_kana', 'phone', 'email', 'address', 'birth_date', 'preferred_language', 'prefecture', 'city',
  'nearest_station', 'transport', 'max_commute_minutes', 'desired_job_kinds', 'desired_facility_types', 'desired_employment',
  'desired_wage_type', 'desired_wage_min', 'available_start', 'available_end', 'shift_ok', 'night_max_per_month',
  'max_days_per_week', 'available_from', 'licenses', 'experience_years', 'experience_note', 'is_foreign_national',
  'visa_status', 'residence_expiry', 'jlpt_level', 'care_japanese_test', 'skill_test', 'ai_consent'];

// 受付フォームに表示する事業者情報（職業安定法に基づき求職者に示す事項。公開して差し支えない項目のみ）
router.get('/info', (req, res) => {
  const s = getSettings();
  res.json({ company_name: s.company_name, license_no: s.license_no, handling_scope: s.handling_scope,
    contact_person: s.contact_person, contact_email: s.contact_email, contact_tel: s.contact_tel, retention_years: s.retention_years });
});

router.post('/', (req, res) => {
  if (!req.body.consent) return res.status(400).json({ error: 'consent required' });
  const spec = Object.fromEntries(INTAKE_FIELDS.map(f => [f, specs.seeker[f]]));
  const o = validate(req.body, spec, { required: ['name'] });
  o.consent_date = todayJst();
  const r = getDb().prepare("INSERT INTO drafts (kind, data, source_name) VALUES ('seeker_intake', ?, ?)")
    .run(JSON.stringify(o), `受付フォーム（${o.preferred_language || 'ja'}）`);
  runAs('受付フォーム', () => audit('draft_create', r.lastInsertRowid, { kind: 'seeker_intake' }));
  res.json({ ok: true });
});

module.exports = router;
