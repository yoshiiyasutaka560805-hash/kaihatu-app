PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- マスタテーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS service_types (
  id         INTEGER PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name_ja    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subsidies (
  id                  INTEGER PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  name_ja             TEXT NOT NULL,
  category            TEXT NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  description         TEXT,
  legal_basis         TEXT,
  notification_no     TEXT,
  latest_info_vol     TEXT,
  effective_date      TEXT,
  requires_life       INTEGER NOT NULL DEFAULT 0,
  life_frequency      TEXT,
  applicable_services TEXT NOT NULL DEFAULT 'all'
);

-- チェック項目マスタ（service_type_id=0 は全サービス共通）
CREATE TABLE IF NOT EXISTS requirement_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_id      INTEGER NOT NULL REFERENCES subsidies(id),
  service_type_id INTEGER NOT NULL DEFAULT 0,
  item_code       TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  description     TEXT NOT NULL,
  legal_basis     TEXT,
  official_form   TEXT,
  required_for    TEXT NOT NULL DEFAULT 'all',
  threshold_value TEXT,
  check_frequency TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(subsidy_id, service_type_id, item_code)
);

-- 根拠書類テンプレート定義（定義マスタ：アプリ更新時に上書き可）
CREATE TABLE IF NOT EXISTS evidence_template_definitions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_id      INTEGER NOT NULL REFERENCES subsidies(id),
  service_type_id INTEGER NOT NULL DEFAULT 0,
  evidence_type   TEXT NOT NULL,
  evidence_name   TEXT NOT NULL,
  access_path     TEXT,
  description     TEXT,
  is_required     INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(subsidy_id, service_type_id, evidence_type, evidence_name)
);

-- ============================================================
-- 施設設定
-- ============================================================

CREATE TABLE IF NOT EXISTS facility_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ============================================================
-- アセスメント（加算×サービス種別の現状）
-- ============================================================

CREATE TABLE IF NOT EXISTS assessments (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_id             INTEGER NOT NULL REFERENCES subsidies(id),
  service_type_id        INTEGER NOT NULL REFERENCES service_types(id),
  claiming_status        TEXT NOT NULL DEFAULT 'unknown'
                         CHECK(claiming_status IN ('claiming','not_claiming','unknown')),
  claiming_tier          TEXT,
  responsible_name       TEXT,
  responsible_role       TEXT,
  last_life_submission_date TEXT,
  next_submission_deadline  TEXT,
  current_concerns       TEXT,
  has_past_findings      INTEGER NOT NULL DEFAULT 0,
  past_audit_findings    TEXT,
  notes                  TEXT,
  assessed_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subsidy_id, service_type_id)
);

-- ============================================================
-- チェック状況
-- ============================================================

CREATE TABLE IF NOT EXISTS requirement_checks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id       INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  requirement_item_id INTEGER NOT NULL REFERENCES requirement_items(id),
  is_satisfied        INTEGER CHECK(is_satisfied IN (0,1)),
  notes               TEXT,
  checked_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assessment_id, requirement_item_id)
);

CREATE TABLE IF NOT EXISTS evidence_checks (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id            INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  evidence_template_def_id INTEGER NOT NULL REFERENCES evidence_template_definitions(id),
  is_confirmed             INTEGER CHECK(is_confirmed IN (0,1)),
  confirmed_date           TEXT,
  notes                    TEXT,
  checked_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assessment_id, evidence_template_def_id)
);

-- ============================================================
-- 添付ファイル
-- ============================================================

CREATE TABLE IF NOT EXISTS evidence_files (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id            INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  evidence_template_def_id INTEGER REFERENCES evidence_template_definitions(id),
  original_name            TEXT NOT NULL,
  stored_path              TEXT NOT NULL,
  file_size_bytes          INTEGER,
  mime_type                TEXT,
  note                     TEXT,
  uploaded_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 届出履歴
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_id      INTEGER REFERENCES subsidies(id),
  service_type_id INTEGER REFERENCES service_types(id),
  filed_date      TEXT NOT NULL,
  effective_date  TEXT,
  change_content  TEXT NOT NULL,
  form_name       TEXT,
  filed_by        TEXT,
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 自動減算記録
-- ============================================================

CREATE TABLE IF NOT EXISTS deduction_records (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  service_type_id  INTEGER NOT NULL REFERENCES service_types(id),
  deduction_type   TEXT NOT NULL CHECK(deduction_type IN (
                     'restraint_no_filing',
                     'abuse_prevention',
                     'bcp_not_filed',
                     'over_capacity',
                     'staff_shortage'
                   )),
  start_date       TEXT NOT NULL,
  end_date         TEXT,
  reduction_rate   TEXT,
  reason           TEXT NOT NULL,
  resolution_notes TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 月次人員配置記録
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_staff_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month      TEXT NOT NULL,
  service_type_id INTEGER NOT NULL REFERENCES service_types(id),
  role_code       TEXT NOT NULL CHECK(role_code IN (
                    'care_worker',
                    'certified_care_worker',
                    'nurse',
                    'dietitian',
                    'func_trainer',
                    'life_consultant'
                  )),
  full_time_equiv REAL NOT NULL,
  required_fta    REAL,
  is_deficient    INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  recorded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year_month, service_type_id, role_code)
);

-- ============================================================
-- 法改正アラート
-- ============================================================

CREATE TABLE IF NOT EXISTS law_update_sources (
  id               INTEGER PRIMARY KEY,
  source_name      TEXT NOT NULL,
  source_url       TEXT NOT NULL,
  check_method     TEXT NOT NULL CHECK(check_method IN ('vol_number','content_hash','last_modified')),
  last_known_value TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS law_update_alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id       INTEGER NOT NULL REFERENCES law_update_sources(id),
  detected_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  old_value       TEXT,
  new_value       TEXT,
  alert_message   TEXT NOT NULL,
  is_acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_at DATETIME
);

-- ============================================================
-- 認証・ユーザー
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  username              TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  email                 TEXT,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff','viewer')),
  is_active             INTEGER NOT NULL DEFAULT 1,
  must_change_password  INTEGER NOT NULL DEFAULT 0,
  failed_login_count    INTEGER NOT NULL DEFAULT 0,
  locked_until          DATETIME,
  last_login_at         DATETIME,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  sid        TEXT PRIMARY KEY,
  session    TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- ============================================================
-- アクセス・変更監査ログ
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL CHECK(action IN (
                'view','create','update','delete','login','login_failed',
                'logout','file_upload','file_download','export'
              )),
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  before_json TEXT,
  after_json  TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 適性検査（論理思考力）結果
-- ============================================================

CREATE TABLE IF NOT EXISTS aptitude_results (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_name     TEXT NOT NULL,
  test_date          TEXT NOT NULL,
  total_questions    INTEGER NOT NULL,
  correct_count      INTEGER NOT NULL,
  percentage         INTEGER NOT NULL,
  category_breakdown TEXT NOT NULL,   -- JSON: {matrix:{correct,total}, sequence:..., oddOneOut:..., analogy:...}
  answers            TEXT,            -- JSON: {questionId: selectedIndex}
  duration_seconds   INTEGER,
  timer_enabled      INTEGER NOT NULL DEFAULT 0,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ビュー：アセスメント + リスク判定
-- ============================================================

CREATE VIEW IF NOT EXISTS assessment_with_risk AS
SELECT
  a.*,
  s.name_ja         AS subsidy_name,
  s.category,
  s.legal_basis,
  s.notification_no,
  s.latest_info_vol,
  s.requires_life,
  s.life_frequency,
  st.code           AS service_type_code,
  st.name_ja        AS service_type_name,
  (
    SELECT CAST(SUM(CASE WHEN rc.is_satisfied = 1 THEN 1 ELSE 0 END) AS REAL)
      / NULLIF(COUNT(*), 0)
    FROM requirement_checks rc
    WHERE rc.assessment_id = a.id
  ) AS req_ok_rate,
  (
    SELECT CAST(SUM(CASE WHEN ec.is_confirmed = 1 THEN 1 ELSE 0 END) AS REAL)
      / NULLIF(COUNT(*), 0)
    FROM evidence_checks ec
    WHERE ec.assessment_id = a.id
  ) AS evidence_ok_rate,
  (
    SELECT COUNT(*) FROM requirement_checks rc
    WHERE rc.assessment_id = a.id AND rc.is_satisfied = 0
  ) AS failed_req_count,
  CASE
    WHEN a.claiming_status = 'claiming' AND EXISTS (
      SELECT 1 FROM requirement_checks rc WHERE rc.assessment_id = a.id AND rc.is_satisfied = 0
    ) THEN 'red'
    WHEN a.claiming_status = 'claiming' AND s.requires_life = 1
         AND a.next_submission_deadline IS NOT NULL
         AND a.next_submission_deadline < date('now') THEN 'red'
    WHEN a.current_concerns IS NOT NULL AND a.current_concerns != '' THEN 'yellow'
    WHEN a.claiming_status = 'unknown' THEN 'yellow'
    ELSE 'green'
  END AS risk_level
FROM assessments a
JOIN subsidies s    ON s.id  = a.subsidy_id
JOIN service_types st ON st.id = a.service_type_id;

-- ============================================================
-- 特定技能外国人管理：従業員マスタ
-- ============================================================

CREATE TABLE IF NOT EXISTS foreign_workers (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no                TEXT UNIQUE,
  name_native                TEXT NOT NULL,
  name_kana                  TEXT,
  name_romaji                TEXT NOT NULL,
  date_of_birth               TEXT,
  gender                      TEXT,
  nationality                 TEXT NOT NULL,
  native_language             TEXT,
  passport_no                 TEXT,
  passport_expiry_date        TEXT,
  residence_card_no           TEXT,
  residence_status            TEXT,
  specific_skill_field        TEXT,
  residence_period_from       TEXT,
  residence_period_to         TEXT,
  japanese_level              TEXT,
  employment_start_date       TEXT,
  employment_end_date         TEXT,
  employment_status           TEXT NOT NULL DEFAULT 'active'
                               CHECK(employment_status IN ('active','on_leave','resigned')),
  department                  TEXT,
  address                     TEXT,
  phone                       TEXT,
  email                       TEXT,
  emergency_contact_name      TEXT,
  emergency_contact_relation  TEXT,
  emergency_contact_phone     TEXT,
  is_active                   INTEGER NOT NULL DEFAULT 1,
  created_by                  INTEGER REFERENCES users(id),
  updated_by                  INTEGER REFERENCES users(id),
  created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- note_type='interview'/'consultation'の記録は、Phase4で支援計画の実施記録
-- （support_plan_checks、未実装）に自動リンクする想定。support_plan_check_id は
-- そのための予約カラム。SQLiteはforeign_keys=ON時、値がNULLでも参照先テーブルが
-- 実在しないと "no such table" で失敗するため、Phase4でsupport_plan_checksを
-- 作成するまではREFERENCES制約を付けない（プレーンなINTEGER列として保持）
CREATE TABLE IF NOT EXISTS worker_notes (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  foreign_worker_id     INTEGER NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  note_type             TEXT NOT NULL DEFAULT 'general'
                         CHECK(note_type IN ('general','interview','complaint','consultation')),
  content               TEXT NOT NULL,
  is_important          INTEGER NOT NULL DEFAULT 0,
  support_plan_check_id INTEGER,
  author_user_id        INTEGER NOT NULL REFERENCES users(id),
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- related_case_id（Phase3のresidence_cases）とrelated_check_id（Phase4の
-- support_plan_checks）も同様の理由でREFERENCES制約なしの予約カラムとする
CREATE TABLE IF NOT EXISTS worker_files (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  foreign_worker_id INTEGER NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  category          TEXT NOT NULL CHECK(category IN (
                      'residence_card','passport','contract','certificate',
                      'support_evidence','photo','other'
                    )),
  related_case_id   INTEGER,
  related_check_id  INTEGER,
  original_name     TEXT NOT NULL,
  stored_path       TEXT NOT NULL,
  file_size_bytes   INTEGER,
  mime_type         TEXT,
  note              TEXT,
  uploaded_by       INTEGER REFERENCES users(id),
  uploaded_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW IF NOT EXISTS foreign_worker_with_risk AS
SELECT
  fw.*,
  (
    SELECT COUNT(*) FROM worker_notes wn WHERE wn.foreign_worker_id = fw.id
  ) AS note_count,
  (
    SELECT COUNT(*) FROM worker_files wf WHERE wf.foreign_worker_id = fw.id
  ) AS file_count,
  CASE
    WHEN fw.residence_period_to IS NOT NULL AND fw.residence_period_to < date('now') THEN 'red'
    WHEN fw.residence_period_to IS NOT NULL AND fw.residence_period_to <= date('now', '+30 days') THEN 'red'
    WHEN fw.residence_period_to IS NOT NULL AND fw.residence_period_to <= date('now', '+90 days') THEN 'yellow'
    ELSE 'green'
  END AS residence_risk_level
FROM foreign_workers fw;
