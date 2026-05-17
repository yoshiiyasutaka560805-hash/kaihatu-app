'use strict';

// 令和6年度改定（2024年4月施行）準拠
// applicable_services: 'all' | 'unit,traditional' | 'unit' | 'traditional' | 'shortterm,shortterm_prev' 等

const SUBSIDIES = [
  // ── カテゴリA：基本体制 ──────────────────────────────────────
  {
    id: 1, code: 'night_work_base', category: 'A', sort_order: 10,
    name_ja: '夜間勤務条件基準',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: '夜間における職員の配置基準。施設形態ごとに必要人数が異なる。',
  },
  {
    id: 2, code: 'staff_shortage_deduction', category: 'A', sort_order: 20,
    name_ja: '職員の欠員による減算の状況',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: '人員基準欠如が生じた場合は翌々月から減算が発生する。',
  },
  {
    id: 3, code: 'unit_care_system', category: 'A', sort_order: 30,
    name_ja: 'ユニットケア体制',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,shortterm,shortterm_prev',
    description: 'ユニット型施設としての体制整備。',
  },
  {
    id: 4, code: 'quasi_unit_care', category: 'A', sort_order: 40,
    name_ja: '準ユニットケア体制',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'traditional',
    description: '従来型施設における準ユニットケアの実施体制。',
  },

  // ── カテゴリB：安全・コンプライアンス ────────────────────────
  {
    id: 10, code: 'restraint_abolition', category: 'B', sort_order: 10,
    name_ja: '身体拘束廃止取組の有無',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: '委員会設置・指針整備・研修実施・記録保存の4点が必要。未届出の場合自動減算（-10%/月）。',
  },
  {
    id: 11, code: 'safety_mgmt', category: 'B', sort_order: 20,
    name_ja: '安全管理体制',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: '事故防止指針・委員会・研修・担当者設定の4点。',
  },
  {
    id: 12, code: 'elder_abuse_prevention', category: 'B', sort_order: 30,
    name_ja: '高齢者虐待防止措置実施の有無',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: '委員会設置・指針整備・年2回以上の研修・担当者設定が必要。未実施は減算（-1%/月）。',
  },
  {
    id: 13, code: 'bcp', category: 'B', sort_order: 40,
    name_ja: '業務継続計画策定の有無',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: 'BCP策定・年2回の研修・年1回の訓練が必要。未策定は減算（-1%/月）。',
  },
  {
    id: 14, code: 'safety_measures', category: 'B', sort_order: 50,
    name_ja: '安全対策体制加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '外部研修修了者を安全対策担当者として配置し、体制を整備した場合に算定。',
  },

  // ── カテゴリC：人員・看護配置 ────────────────────────────────
  {
    id: 20, code: 'daily_life_continuation', category: 'C', sort_order: 10,
    name_ja: '日常生活継続支援加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '要介護4・5、認知症、喀痰吸引等の重度者要件 OR 介護福祉士配置要件を満たした場合。従来型は算定中。ユニット型は移行目標中。',
  },
  {
    id: 21, code: 'nursing_system_1', category: 'C', sort_order: 20,
    name_ja: '看護体制加算Ⅰ',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional,shortterm,shortterm_prev',
    description: '常勤の看護師を1名以上配置。',
  },
  {
    id: 22, code: 'nursing_system_2', category: 'C', sort_order: 30,
    name_ja: '看護体制加算Ⅱ',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '入所者25人又はその端数を増すごとに看護職員を基準数＋1以上配置。24時間連絡体制。',
  },
  {
    id: 23, code: 'night_staff', category: 'C', sort_order: 40,
    name_ja: '夜勤職員配置加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional,shortterm,shortterm_prev',
    description: '夜勤職員を基準数に1以上加配した場合。SS併設時は合算で計算。施設は全サービスでⅠ・Ⅱ算定中。',
  },
  {
    id: 24, code: 'nutrition_mgmt_strengthen', category: 'C', sort_order: 50,
    name_ja: '栄養マネジメント強化体制加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    latest_info_vol: 'Vol.1216',
    applicable_services: 'unit,traditional',
    description: '管理栄養士を常勤換算で入所者50人につき1人以上（常勤栄養士配置施設は70人につき1人以上）。多職種による栄養管理計画作成・食事観察。ユニット型のみ算定中。',
    requires_life: 1,
    life_frequency: 'quarterly',
  },
  {
    id: 25, code: 'placed_dr_emergency', category: 'C', sort_order: 60,
    name_ja: '配置医師緊急時対応加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '配置医師が早朝・夜間・休日等に施設の求めに応じて対応する体制を確保した場合。',
  },

  // ── カテゴリD：個別ケア・リハビリ ───────────────────────────
  {
    id: 30, code: 'individual_func_training', category: 'D', sort_order: 10,
    name_ja: '個別機能訓練加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    latest_info_vol: 'Vol.1216',
    applicable_services: 'unit,traditional,shortterm,shortterm_prev',
    description: '専従の機能訓練指導員（理学療法士等）を常勤1名以上配置。個別計画・3か月ごと評価。施設は全特養でⅠ・Ⅱ算定中。',
    requires_life: 1,
    life_frequency: 'quarterly',
  },
  {
    id: 31, code: 'psychiatrist_guidance', category: 'D', sort_order: 20,
    name_ja: '精神科医師定期的療養指導加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '入所者の1/3以上が認知症診断を受けていること（施設実態：64%）。月2回以上の療養指導実施。施設は全特養で算定中。',
  },
  {
    id: 32, code: 'pressure_sore_mgmt', category: 'D', sort_order: 30,
    name_ja: '褥瘡マネジメント加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    applicable_services: 'unit,traditional',
    description: '褥瘡の発生を防止するための体制を構築。LIFEへのデータ提出が必要。',
    requires_life: 1,
    life_frequency: 'quarterly',
  },
  {
    id: 33, code: 'excretion_support', category: 'D', sort_order: 40,
    name_ja: '排泄支援加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    applicable_services: 'unit,traditional',
    description: '排泄の状態の把握と排泄支援計画の作成。LIFEへのデータ提出が必要。',
    requires_life: 1,
    life_frequency: 'quarterly',
  },
  {
    id: 34, code: 'adl_maintenance', category: 'D', sort_order: 50,
    name_ja: 'ADL維持等加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    applicable_services: 'unit,traditional',
    description: '入所者のADLの維持・改善の取組み。LIFEへのデータ提出が必要。',
    requires_life: 1,
    life_frequency: 'biannual',
  },
  {
    id: 35, code: 'dementia_care', category: 'D', sort_order: 60,
    name_ja: '認知症専門ケア加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional,shortterm,shortterm_prev',
    description: '認知症ケアに関する専門的な知識・技能を持つ職員の配置等。',
  },
  {
    id: 36, code: 'dementia_team', category: 'D', sort_order: 70,
    name_ja: '認知症チームケア推進加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '認知症チームケアの取組みに対する評価。',
  },
  {
    id: 37, code: 'independence_promotion', category: 'D', sort_order: 80,
    name_ja: '自立支援促進加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    applicable_services: 'unit,traditional',
    description: '医師の診察・多職種共同による自立支援計画の作成・定期的な評価。',
    requires_life: 1,
    life_frequency: 'quarterly',
  },

  // ── カテゴリE：LIFE・科学的介護 ─────────────────────────────
  {
    id: 40, code: 'scientific_care', category: 'E', sort_order: 10,
    name_ja: '科学的介護推進体制加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老老発0315第4号',
    latest_info_vol: 'Vol.1216',
    applicable_services: 'unit,traditional',
    description: '全入所者のデータをLIFEに定期的に提出し、フィードバックを活用したPDCAサイクルの実施。施設は全特養で算定中。',
    requires_life: 1,
    life_frequency: 'quarterly',
  },
  {
    id: 41, code: 'productivity_improvement', category: 'E', sort_order: 20,
    name_ja: '生産性向上推進体制加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: 'テクノロジー活用・委員会設置・データ提出。施設はユニット・従来型ともにⅠ算定中（aams・ツナグ・ほのぼの使用）。',
  },
  {
    id: 42, code: 'infection_control_1', category: 'E', sort_order: 30,
    name_ja: '高齢者施設等感染対策向上加算Ⅰ',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional,shortterm,shortterm_prev',
    description: '感染症対策に関する協定医療機関と連携体制の確保。',
  },
  {
    id: 43, code: 'infection_control_2', category: 'E', sort_order: 40,
    name_ja: '高齢者施設等感染対策向上加算Ⅱ',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional,shortterm,shortterm_prev',
    description: '感染対策に係る研修の実施等。',
  },

  // ── カテゴリF：食事・療養 ────────────────────────────────────
  {
    id: 50, code: 'therapeutic_diet', category: 'F', sort_order: 10,
    name_ja: '療養食加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '医師が発行した食事箋に基づく適切な療養食（糖尿病食・腎臓病食等）の提供。施設は全特養で算定中。',
  },
  {
    id: 51, code: 'permanent_doctor', category: 'F', sort_order: 20,
    name_ja: '常勤専従医師配置',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '常勤の医師を1名以上専従で配置した場合。',
  },

  // ── カテゴリG：看取り・連携 ─────────────────────────────────
  {
    id: 60, code: 'end_of_life_1', category: 'G', sort_order: 10,
    name_ja: '看取り介護加算（加算Ⅰ）',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '看取り指針・24時間連絡体制・多職種連携・家族説明・定期的カンファレンスの実施。施設は全特養で算定中。',
  },
  {
    id: 61, code: 'end_of_life_2', category: 'G', sort_order: 20,
    name_ja: '看取り介護加算（加算Ⅱ）',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '看取り介護加算Ⅰの要件に加え、入院期間後の施設での看取り等を実施した場合。',
  },
  {
    id: 62, code: 'cooperation_hospital', category: 'G', sort_order: 30,
    name_ja: '協力医療機関連携加算Ⅰ',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '協力医療機関との3要件（相談対応・診療・入院受入）を備え、月1回以上の定期的な会議等を実施。施設は全特養で算定中。',
  },
  {
    id: 63, code: 'home_facility_mutual', category: 'G', sort_order: 40,
    name_ja: '在宅・入所相互利用体制加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '在宅と施設入所を相互に利用できる体制の整備。',
  },

  // ── カテゴリH：サービス提供体制・処遇改善 ──────────────────
  {
    id: 70, code: 'service_provision_enhancement', category: 'H', sort_order: 10,
    name_ja: 'サービス提供体制強化加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'all',
    description: '介護福祉士比率・常勤職員比率・勤続年数いずれかの要件を満たす場合。施設：ユニットⅢ・SSⅡ（常勤職員75%以上で算定）。',
  },
  {
    id: 71, code: 'treatment_improvement', category: 'H', sort_order: 20,
    name_ja: '介護職員等処遇改善加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    notification_no: '老発0315第1号',
    latest_info_vol: 'Vol.1277',
    applicable_services: 'all',
    description: '加算Ⅱ算定中。別紙様式２（計画書）・別紙様式３（実績報告）の提出。副施設長PCで管理。',
  },
  {
    id: 72, code: 'young_dementia', category: 'H', sort_order: 30,
    name_ja: '若年性認知症入所者受入加算',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'unit,traditional',
    description: '若年性認知症の入所者を受け入れ、担当者を配置した場合。',
  },

  // ── カテゴリI：ショートステイ固有 ──────────────────────────
  {
    id: 80, code: 'life_consultation_ss', category: 'I', sort_order: 10,
    name_ja: '生活相談員配置等加算（SS）',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'shortterm,shortterm_prev',
    description: 'ショートステイに専従の生活相談員を週40時間以上配置した場合。',
  },
  {
    id: 81, code: 'func_training_system_ss', category: 'I', sort_order: 20,
    name_ja: '機能訓練指導体制加算（SS）',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'shortterm,shortterm_prev',
    description: '専従の機能訓練指導員（理学療法士等）を配置した場合。施設はSS・SS予防ともに算定中。',
  },
  {
    id: 82, code: 'transfer_system_ss', category: 'I', sort_order: 30,
    name_ja: '送迎体制加算（SS）',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'shortterm,shortterm_prev',
    description: '利用者の送迎を実施した場合。施設は算定中。',
  },
  {
    id: 83, code: 'end_of_life_cooperation_ss', category: 'I', sort_order: 40,
    name_ja: '看取り連携体制加算（SS）',
    legal_basis: '令和6年厚生労働省告示第86号',
    applicable_services: 'shortterm,shortterm_prev',
    description: '24時間連絡体制・看取り方針説明等の要件を満たす場合。',
  },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO subsidies
      (id, code, name_ja, category, sort_order, description,
       legal_basis, notification_no, latest_info_vol, effective_date,
       requires_life, life_frequency, applicable_services)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const s of SUBSIDIES) {
    insert.run(
      s.id, s.code, s.name_ja, s.category, s.sort_order,
      s.description || null,
      s.legal_basis || null, s.notification_no || null,
      s.latest_info_vol || null, s.effective_date || null,
      s.requires_life || 0, s.life_frequency || null,
      s.applicable_services,
    );
  }
  console.log(`subsidies: ${SUBSIDIES.length}件`);
}

module.exports = { seed, SUBSIDIES };
