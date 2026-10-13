'use strict';

// 設定の既定値。手数料率・返戻金規定は届出内容に合わせて必ず設定画面で入力すること
module.exports = {
  // 判定
  match_min_score: '40',
  verdict_high_score: '75',            // 「案内可（マッチ度高）」とするスコア
  wage_tolerance_percent: '5',          // 賃金がこの割合以内の不足なら除外せず注意表示
  tokutei_visiting_allowed: '0',        // 特定技能で訪問系業務を判定上「可」とするか（要確認：最新の運用要領）
  // AI
  ai_enabled: '1',
  ai_top_n: '5',
  ai_monthly_budget_usd: '30',
  // 手数料・返戻金
  fee_mode: '届出制',                    // 届出制 / 上限制
  fee_rate_percent: '',                  // 紹介手数料率（%）
  fee_cap_percent: '',                   // 上限（%）。超える請求を警告
  fee_basis_months: '6',
  refund_policy: '[]',                   // 例: [{"withinDays":30,"rate":80},{"withinDays":90,"rate":50}]
  invoice_due_days: '30',
  // 保存・バックアップ
  retention_years: '2',
  seeker_validity_months: '3',           // 求職の有効期間（受付日から）
  backup_dir: '',
  backup_keep: '30',
  // 求人取込
  provision_enabled: '0',
  provision_dir: '',
  provision_column_map: '{}',            // 提供CSVの列名 → 項目名 の対応（JSON）
  provision_terms: 'ハローワーク求人情報オンライン提供：職業紹介以外の目的での利用・第三者提供・インターネット等での公開禁止',
  // ハローワーク求人情報提供 Web API（承認後に仕様書に合わせて設定。認証情報は環境変数 HW_API_ID / HW_API_PASSWORD）
  hwapi_enabled: '0',
  hwapi_token_url: '',
  hwapi_data_url: '',                    // 例: https://…/{dataId}/{page}（{dataId} {page} {token} を置換）
  hwapi_logout_url: '',
  hwapi_data_ids: '',                    // 民間職業紹介事業者用のデータID（カンマ区切り）
  hwapi_token_tag: 'token',
  hwapi_record_tag: '',                  // 求人1件を表すXMLタグ名
  hwapi_field_map: '{}',                 // { "XMLタグ名": "posting_no" } 等。複数タグ連結は "A+B"
  hwapi_id_param: 'id',
  hwapi_pass_param: 'pass',
  hwapi_prefectures: '',                 // 取り込む都道府県（カンマ区切り。空=すべて）
  hwapi_interval_ms: '1000',
  crawler_enabled: '0',
  crawler_terms_confirmed: '0',
  crawler_base_url: '',
  crawler_conditions: '[]',
  crawler_interval_ms: '5000',
  fetch_cron: '30 2 * * *',
  // その他
  operators: '吉井',                     // 操作者（カンマ区切り）
  company_name: '株式会社リアネット',
  license_no: '',                        // 有料職業紹介事業 許可番号
};
