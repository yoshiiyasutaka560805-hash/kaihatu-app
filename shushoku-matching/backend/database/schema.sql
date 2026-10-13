-- 株式会社リアネット 求職者マッチング DB
-- 新生福祉会の介護系DB（data/kaihatu.db）とは完全に分離する

CREATE TABLE IF NOT EXISTS job_postings (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_no         TEXT NOT NULL UNIQUE,      -- ハローワーク求人番号（例: 13010-12345678）
  company_name       TEXT NOT NULL,
  prefecture         TEXT,
  city               TEXT,
  address            TEXT,
  job_title          TEXT NOT NULL,
  job_category       TEXT,                      -- 職種分類（介護、事務、製造 等）
  employment_type    TEXT,                      -- 正社員 / パート 等
  wage_type          TEXT DEFAULT 'monthly',    -- monthly / hourly / daily
  wage_min           INTEGER,
  wage_max           INTEGER,
  work_start         TEXT,                      -- HH:MM
  work_end           TEXT,                      -- HH:MM
  shift_work         INTEGER DEFAULT 0,         -- 交替制・夜勤あり
  days_per_week      INTEGER,
  annual_holidays    INTEGER,
  holidays_note      TEXT,
  required_licenses  TEXT,                      -- カンマ区切り（必須）
  preferred_licenses TEXT,                      -- カンマ区切り（歓迎）
  experience_required INTEGER DEFAULT 0,        -- 必要経験年数
  age_min            INTEGER,
  age_max            INTEGER,
  age_exception_reason TEXT,                    -- 労働施策総合推進法施行規則1条の3の例外事由（なければ年齢条件を判定に使わない）
  foreigner_ok       INTEGER,                   -- 1=可 0=不可 NULL=不明
  description        TEXT,
  received_date      TEXT,                      -- 受理日
  expiry_date        TEXT,                      -- 紹介期限日
  source             TEXT NOT NULL DEFAULT 'manual', -- manual / hw_provision / hw_crawler
  source_url         TEXT,
  fetched_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  is_active          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_postings_area ON job_postings(prefecture, city);
CREATE INDEX IF NOT EXISTS idx_postings_active ON job_postings(is_active);

CREATE TABLE IF NOT EXISTS job_seekers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 識別情報（AIへは送信しない）
  name               TEXT NOT NULL,
  name_kana          TEXT,
  phone              TEXT,
  email              TEXT,
  address            TEXT,
  birth_date         TEXT,
  -- マッチング条件
  prefecture         TEXT,
  city               TEXT,
  acceptable_cities  TEXT,                      -- 通勤可能な市区町村（カンマ区切り）
  desired_categories TEXT,                      -- 希望職種（カンマ区切り）
  desired_employment TEXT,                      -- 希望雇用形態（カンマ区切り）
  desired_wage_type  TEXT DEFAULT 'monthly',
  desired_wage_min   INTEGER,
  available_start    TEXT,                      -- 勤務可能 開始 HH:MM
  available_end      TEXT,                      -- 勤務可能 終了 HH:MM
  shift_ok           INTEGER DEFAULT 0,
  max_days_per_week  INTEGER,
  min_annual_holidays INTEGER,
  licenses           TEXT,                      -- 保有資格（カンマ区切り）
  experience_years   INTEGER DEFAULT 0,
  experience_note    TEXT,
  is_foreign_national INTEGER DEFAULT 0,
  visa_status        TEXT,
  notes              TEXT,
  status             TEXT NOT NULL DEFAULT '受付', -- 受付/紹介中/面接/内定/就職/終了
  consent_date       TEXT,                      -- 個人情報取扱い同意日
  ai_consent         INTEGER NOT NULL DEFAULT 0, -- 外部AI（仮名化データ）利用の同意
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  seeker_id     INTEGER NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
  posting_id    INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL,
  breakdown     TEXT NOT NULL,                  -- JSON
  ai_comment    TEXT,                           -- JSON
  intro_status  TEXT NOT NULL DEFAULT '未提案',  -- 未提案/提案済/応募/面接/内定/不採用/辞退
  judged_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (seeker_id, posting_id)
);

CREATE TABLE IF NOT EXISTS fetch_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,
  started_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  finished_at  TEXT,
  inserted     INTEGER DEFAULT 0,
  updated      INTEGER DEFAULT 0,
  deactivated  INTEGER DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'running', -- running/success/error/skipped
  message      TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  action      TEXT NOT NULL,                    -- seeker_create/seeker_update/seeker_delete/match_run/ai_send/import
  target      TEXT,
  detail      TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('crawler_enabled',        '0'),
  ('crawler_terms_confirmed','0'),
  ('crawler_base_url',       ''),
  ('crawler_conditions',     '[]'),
  ('crawler_interval_ms',    '5000'),
  ('crawler_cron',           '30 2 * * *'),
  ('provision_enabled',      '0'),
  ('provision_dir',          ''),
  ('ai_enabled',             '1'),
  ('ai_top_n',               '5'),
  ('match_min_score',        '40');
