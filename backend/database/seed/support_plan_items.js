'use strict';

const LEGAL_BASIS = '特定技能雇用契約及び1号特定技能外国人支援計画の基準等を定める法務省令';

const ITEMS = [
  {
    item_code: 'PRE_GUIDANCE', item_name: '事前ガイダンスの提供',
    description: '雇用契約締結後、入国前（または在留資格変更前）に、労働条件・活動内容・入国手続き等について外国人が十分理解できる言語で提供する。',
    sort_order: 1,
  },
  {
    item_code: 'PICKUP', item_name: '出入国する際の送迎',
    description: '入国時は港・飛行場から住居又は勤務先までの送迎、帰国時は港・飛行場の保安検査場入場までの送迎を行う。',
    sort_order: 2,
  },
  {
    item_code: 'HOUSING', item_name: '住居確保・生活に必要な契約支援',
    description: '住居確保の支援（賃貸契約の連署・保証等）、及び生活に必要な契約（銀行口座・携帯電話・ライフライン等）に係る支援を行う。',
    sort_order: 3,
  },
  {
    item_code: 'ORIENTATION', item_name: '生活オリエンテーションの実施',
    description: '本邦での生活一般に関する事項、相談・苦情対応窓口、医療機関、防災・防犯情報等について生活オリエンテーションを実施する。',
    sort_order: 4,
  },
  {
    item_code: 'PROCEDURES', item_name: '公的手続等への同行',
    description: '住民登録、社会保障・税手続き等の必要な手続きについて、同行し必要に応じ書類作成の補助を行う。',
    sort_order: 5,
  },
  {
    item_code: 'JAPANESE_STUDY', item_name: '日本語学習の機会の提供',
    description: '日本語教室や日本語学習用教材の情報提供等、日本語を学習する機会を提供する。',
    sort_order: 6,
  },
  {
    item_code: 'CONSULTATION', item_name: '相談・苦情への対応',
    description: '職場や生活上の相談・苦情について、外国人が十分理解できる言語で相談に応じ、必要な助言・支援を行う。',
    sort_order: 7,
  },
  {
    item_code: 'EXCHANGE', item_name: '日本人との交流促進',
    description: '地域住民との交流の場に関する情報提供、地域の自治会等への同行など、日本人との交流を促進する。',
    sort_order: 8,
  },
  {
    item_code: 'JOB_CHANGE_SUPPORT', item_name: '転職支援（人員整理等の場合）',
    description: '受入れ側の事情により雇用契約を解除する場合、次の受入れ先を探す転職支援や、当該支援に要する期間の生活支援等を行う。',
    sort_order: 9,
  },
  {
    item_code: 'INTERVIEW', item_name: '定期的な面談の実施・行政機関への通報',
    description: '外国人と定期的な面談（3か月に1回以上）を実施し、労働基準法違反等の問題を確認した場合は関係行政機関へ通報する。',
    sort_order: 10,
  },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO support_plan_items (item_code, item_name, description, legal_basis, sort_order)
    VALUES (?,?,?,?,?)
  `);
  for (const item of ITEMS) {
    insert.run(item.item_code, item.item_name, item.description, LEGAL_BASIS, item.sort_order);
  }
  console.log(`support_plan_items: ${ITEMS.length}件`);
}

module.exports = { seed };
