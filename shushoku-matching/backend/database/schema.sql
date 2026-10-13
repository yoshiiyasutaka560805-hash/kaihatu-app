-- 株式会社リアネット 求職者マッチング DB（スキーマ v1）
-- 新生福祉会の介護系DB（data/kaihatu.db）とは完全に分離する
-- 日時はすべて日本時間の文字列（'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS'）

-- ── 事業所（求人者） ─────────────────────────────
CREATE TABLE employers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  corporate_number   TEXT,
  prefecture         TEXT,
  city               TEXT,
  address            TEXT,
  contact_person     TEXT,
  contact_title      TEXT,
  phone              TEXT,
  email              TEXT,
  facility_types     TEXT,                       -- 運営する施設種別（カンマ区切り）
  tokutei_support    TEXT,                       -- 特定技能の支援体制（自社支援／登録支援機関名）
  council_joined     INTEGER,                    -- 介護分野特定技能協議会 加入
  contract_date      TEXT,                       -- 紹介契約（手数料・返戻金合意）締結日
  fee_rate_percent   REAL,                       -- 個別の手数料率（未設定なら設定値）
  refund_policy      TEXT,                       -- 個別の返戻金規定（JSON。未設定なら設定値）
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  deleted_at         TEXT
);

-- ── 求人（ハローワーク求人／自社受理求人） ─────────────
CREATE TABLE job_postings (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_no         TEXT NOT NULL UNIQUE,       -- HW求人番号 または 自社求人番号（R-YYYY-NNNN）
  origin             TEXT NOT NULL DEFAULT 'hw', -- hw: ハローワーク求人（探索用） / own: 自社受理求人（紹介可）
  employer_id        INTEGER REFERENCES employers(id),
  hw_posting_no      TEXT,                       -- 自社求人の元になったHW求人番号
  company_name       TEXT NOT NULL,
  prefecture         TEXT,
  city               TEXT,
  address            TEXT,
  nearest_station    TEXT,
  job_title          TEXT NOT NULL,
  job_category       TEXT,
  facility_type      TEXT,                       -- 特養/老健/GH/有料/デイ/訪問/障害/病院/その他
  job_kind           TEXT,                       -- 介護職/生活相談員/看護職/ケアマネ/送迎/調理/事務/その他
  visiting_care      INTEGER,                    -- 訪問系サービスの業務を含む
  employment_type    TEXT,
  employment_term    TEXT,                       -- 無期 / 有期
  contract_period    TEXT,
  trial_period       TEXT,
  wage_type          TEXT DEFAULT 'monthly',     -- monthly/hourly/daily/annual
  wage_min           INTEGER,
  wage_max           INTEGER,
  allowances_monthly INTEGER,                    -- 固定手当（月額）
  night_allowance    INTEGER,                    -- 夜勤手当（1回）
  nights_per_month   INTEGER,                    -- 想定夜勤回数（月）
  bonus_months       REAL,                       -- 賞与（月数・前年度実績）
  other_annual       INTEGER,                    -- 処遇改善一時金等（年額）
  work_start         TEXT,
  work_end           TEXT,
  daily_hours        REAL,                       -- 1日の所定労働時間
  shift_work         INTEGER DEFAULT 0,
  days_per_week      INTEGER,
  annual_holidays    INTEGER,
  holidays_note      TEXT,
  overtime           TEXT,
  social_insurance   TEXT,
  smoking_measure    TEXT,                       -- 受動喫煙防止措置
  job_change_scope   TEXT,                       -- 業務の変更の範囲
  place_change_scope TEXT,                       -- 就業場所の変更の範囲
  commute_note       TEXT,                       -- 車通勤可・送迎等
  required_licenses  TEXT,
  preferred_licenses TEXT,
  experience_required INTEGER DEFAULT 0,
  japanese_level     TEXT,                       -- 必要な日本語レベル（N4等）
  age_min            INTEGER,
  age_max            INTEGER,
  age_exception_reason TEXT,
  foreigner_ok       INTEGER,
  tokutei_ok         INTEGER,                    -- 特定技能の受入れ可
  openings           INTEGER,                    -- 求人数
  description        TEXT,
  received_date      TEXT,                       -- 受付（受理）日
  expiry_date        TEXT,                       -- 紹介期限／有効期間の末日
  source             TEXT NOT NULL DEFAULT 'manual', -- manual / hw_provision / hw_crawler / ocr / own
  source_file        TEXT,
  provision_terms    TEXT,                       -- 提供条件（オンライン提供の利用規約等）
  source_url         TEXT,
  fetched_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  is_active          INTEGER NOT NULL DEFAULT 1,
  closed_manually    INTEGER NOT NULL DEFAULT 0, -- 手動で募集終了にした（再取込で復活させない）
  updated_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_postings_area ON job_postings(prefecture, city);
CREATE INDEX idx_postings_active ON job_postings(is_active);
CREATE INDEX idx_postings_employer ON job_postings(employer_id);

-- ── 求職者 ───────────────────────────────────────
CREATE TABLE job_seekers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 識別情報（AIへは送信しない）
  name               TEXT NOT NULL,
  name_kana          TEXT,
  phone              TEXT,
  email              TEXT,
  address            TEXT,
  birth_date         TEXT,
  -- 受付
  accepted_date      TEXT,                       -- 求職受付日
  validity_end       TEXT,                       -- 求職の有効期間末日
  consent_date       TEXT,
  ai_consent         INTEGER NOT NULL DEFAULT 0,
  preferred_language TEXT DEFAULT 'ja',          -- 提案書の言語
  -- 希望条件
  prefecture         TEXT,
  city               TEXT,
  nearest_station    TEXT,
  acceptable_cities  TEXT,
  transport          TEXT,                       -- 徒歩/自転車/車/公共交通（カンマ区切り）
  max_commute_minutes INTEGER,
  desired_categories TEXT,
  desired_facility_types TEXT,
  excluded_facility_types TEXT,
  desired_job_kinds  TEXT,
  desired_employment TEXT,
  desired_wage_type  TEXT DEFAULT 'monthly',
  desired_wage_min   INTEGER,
  available_start    TEXT,
  available_end      TEXT,
  shift_ok           INTEGER DEFAULT 0,
  night_max_per_month INTEGER,                   -- 夜勤の上限回数（NULL=制限なし、0=不可）
  night_only         INTEGER DEFAULT 0,          -- 夜勤専従希望
  max_days_per_week  INTEGER,
  min_annual_holidays INTEGER,
  available_from     TEXT,                       -- 就業可能日
  licenses           TEXT,
  experience_years   INTEGER DEFAULT 0,
  experience_note    TEXT,
  priorities         TEXT,                       -- 希望の優先順位（自由記述）
  weight_profile     TEXT DEFAULT 'balanced',
  -- 外国籍・在留
  is_foreign_national INTEGER DEFAULT 0,
  visa_status        TEXT,
  residence_expiry   TEXT,
  work_restriction   TEXT,                       -- 就労制限の有無（在留カード記載）
  extra_activity_permit INTEGER,                 -- 資格外活動許可
  residence_checked_date TEXT,                   -- 在留カード原本確認日
  residence_checked_by TEXT,
  jlpt_level         TEXT,
  care_japanese_test INTEGER,                    -- 介護日本語評価試験 合格
  skill_test         TEXT,                       -- 特定技能 技能試験 合格（分野）
  -- 管理
  notes              TEXT,
  status             TEXT NOT NULL DEFAULT '受付',
  closed_date        TEXT,                       -- 紹介終了日（就職・終了）
  retention_until    TEXT,                       -- 保存期限（これを過ぎたら削除）
  deleted_at         TEXT,                       -- 論理削除（帳簿保存のため実データは保存期限まで保持）
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 面談記録
CREATE TABLE interview_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seeker_id   INTEGER NOT NULL REFERENCES job_seekers(id),
  at          TEXT NOT NULL,
  method      TEXT,                              -- 来所/電話/オンライン/訪問
  memo        TEXT,
  operator    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ── マッチング・選考 ───────────────────────────────
CREATE TABLE matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  seeker_id     INTEGER NOT NULL REFERENCES job_seekers(id),
  posting_id    INTEGER NOT NULL REFERENCES job_postings(id),
  score         INTEGER NOT NULL,
  completeness  INTEGER,                         -- 求人情報の充足率（%）
  breakdown     TEXT NOT NULL,
  ai_comment    TEXT,
  is_new        INTEGER NOT NULL DEFAULT 1,      -- 担当者が未確認の新着候補
  intro_status  TEXT NOT NULL DEFAULT '未提案',  -- 未提案/提案済/応募/面接/内定/入職/不採用/辞退
  proposed_date TEXT,
  applied_date  TEXT,
  interview_at  TEXT,                            -- 'YYYY-MM-DD HH:MM'
  interview_place TEXT,
  interview_result TEXT,
  offer_date    TEXT,
  decline_reason TEXT,                           -- 辞退・不採用理由（選択式）
  note          TEXT,
  judged_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (seeker_id, posting_id)
);

CREATE TABLE match_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL REFERENCES matches(id),
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  from_status TEXT,
  to_status   TEXT,
  note        TEXT,
  operator    TEXT
);

-- 通勤時間（求職者×求人）
CREATE TABLE commute_cache (
  seeker_id   INTEGER NOT NULL REFERENCES job_seekers(id),
  posting_id  INTEGER NOT NULL REFERENCES job_postings(id),
  minutes     INTEGER NOT NULL,
  mode        TEXT,
  source      TEXT NOT NULL DEFAULT 'manual',    -- manual / api
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (seeker_id, posting_id)
);

-- ── 就職（成約）・請求・返戻金・定着 ─────────────────────
CREATE TABLE placements (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id           INTEGER NOT NULL UNIQUE REFERENCES matches(id),
  seeker_id          INTEGER NOT NULL REFERENCES job_seekers(id),
  posting_id         INTEGER NOT NULL REFERENCES job_postings(id),
  employer_id        INTEGER REFERENCES employers(id),
  hire_date          TEXT NOT NULL,
  employment_term    TEXT NOT NULL,              -- 無期 / 有期
  monthly_wage       INTEGER,                    -- 手数料算定の基礎となる賃金（月額）
  fee_basis_months   REAL NOT NULL DEFAULT 6,
  fee_rate_percent   REAL,
  fee_amount         INTEGER,
  fee_basis_note     TEXT,
  invoice_no         TEXT,
  invoice_date       TEXT,
  due_date           TEXT,
  paid_date          TEXT,
  paid_amount        INTEGER,
  separation_date    TEXT,
  separation_type    TEXT,                       -- 自己都合/会社都合/解雇/契約満了/その他
  separation_reason  TEXT,
  separation_unknown INTEGER NOT NULL DEFAULT 0, -- 6か月時点で在職状況を把握できなかった
  refund_rate        REAL,
  refund_amount      INTEGER,
  refund_date        TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE followups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  placement_id  INTEGER NOT NULL REFERENCES placements(id),
  kind          TEXT NOT NULL,                   -- 1週/1か月/3か月/6か月/その他
  due_date      TEXT NOT NULL,
  done_date     TEXT,
  method        TEXT,
  still_employed INTEGER,
  note          TEXT,
  operator      TEXT
);

-- ── 業務管理 ─────────────────────────────────────
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  due_date    TEXT,
  seeker_id   INTEGER REFERENCES job_seekers(id),
  done_at     TEXT,
  operator    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE complaints (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  received_date  TEXT NOT NULL,
  from_type      TEXT NOT NULL,                  -- 求職者/求人者/その他
  from_name      TEXT,
  seeker_id      INTEGER REFERENCES job_seekers(id),
  employer_id    INTEGER REFERENCES employers(id),
  content        TEXT NOT NULL,
  response       TEXT,
  responder      TEXT,
  completed_date TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 承認待ちの下書き（受付フォーム・面談メモAI抽出・求人票OCR）
CREATE TABLE drafts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,                     -- seeker_intake / seeker_memo / posting_ocr
  seeker_id   INTEGER REFERENCES job_seekers(id),
  data        TEXT NOT NULL,                     -- JSON
  source_name TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending / approved / rejected
  result_id   INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE TABLE proposals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seeker_id   INTEGER NOT NULL REFERENCES job_seekers(id),
  language    TEXT NOT NULL,
  match_ids   TEXT NOT NULL,                     -- JSON配列
  content     TEXT NOT NULL,                     -- JSON（表示用データ）
  override_reason TEXT,                          -- 転職勧奨禁止期間中の提案理由
  operator    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ── AI利用・取込・監査 ─────────────────────────────
CREATE TABLE ai_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  purpose       TEXT NOT NULL,                   -- match_advice / memo_extract / translate / posting_ocr
  model         TEXT NOT NULL,
  seeker_id     INTEGER,
  fields_sent   TEXT,
  input_hash    TEXT,
  status        TEXT NOT NULL DEFAULT 'sent',    -- sent / success / error
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      REAL,
  error         TEXT,
  operator      TEXT
);

CREATE TABLE fetch_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,
  started_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  finished_at  TEXT,
  inserted     INTEGER DEFAULT 0,
  updated      INTEGER DEFAULT 0,
  deactivated  INTEGER DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'running',
  message      TEXT
);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  operator    TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      TEXT
);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
