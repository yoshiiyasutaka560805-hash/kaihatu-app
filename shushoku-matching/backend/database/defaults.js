'use strict';

// 設定の既定値。手数料率・返戻金規定は届出内容に合わせて必ず設定画面で入力すること
module.exports = {
  // 判定
  match_min_score: '40',
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
