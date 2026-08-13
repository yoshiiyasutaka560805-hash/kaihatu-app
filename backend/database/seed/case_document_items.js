'use strict';

const AUTHORITY = '出入国在留管理庁';

const ITEMS = [
  // 在留資格認定証明書交付申請（海外から呼び寄せる場合）
  { case_type: 'certificate_of_eligibility', item_name: '在留資格認定証明書交付申請書', submit_to: AUTHORITY, sort_order: 1 },
  { case_type: 'certificate_of_eligibility', item_name: '証明写真', submit_to: AUTHORITY, sort_order: 2 },
  { case_type: 'certificate_of_eligibility', item_name: '特定技能雇用契約書の写し', submit_to: AUTHORITY, sort_order: 3 },
  { case_type: 'certificate_of_eligibility', item_name: '雇用の経緯に関する説明書', submit_to: AUTHORITY, sort_order: 4 },
  { case_type: 'certificate_of_eligibility', item_name: '賃金の支払いに関する説明書', submit_to: AUTHORITY, sort_order: 5 },
  { case_type: 'certificate_of_eligibility', item_name: '支援計画書', submit_to: AUTHORITY, sort_order: 6 },
  { case_type: 'certificate_of_eligibility', item_name: '技能試験・日本語試験の合格証明書の写し', submit_to: AUTHORITY, sort_order: 7 },
  { case_type: 'certificate_of_eligibility', item_name: 'パスポートの写し', submit_to: AUTHORITY, sort_order: 8 },

  // 在留資格変更許可申請（技能実習等から特定技能へ変更する場合）
  { case_type: 'status_change', item_name: '在留資格変更許可申請書', submit_to: AUTHORITY, sort_order: 1 },
  { case_type: 'status_change', item_name: '証明写真', submit_to: AUTHORITY, sort_order: 2 },
  { case_type: 'status_change', item_name: '特定技能雇用契約書の写し', submit_to: AUTHORITY, sort_order: 3 },
  { case_type: 'status_change', item_name: '雇用の経緯に関する説明書', submit_to: AUTHORITY, sort_order: 4 },
  { case_type: 'status_change', item_name: '賃金の支払いに関する説明書', submit_to: AUTHORITY, sort_order: 5 },
  { case_type: 'status_change', item_name: '支援計画書', submit_to: AUTHORITY, sort_order: 6 },
  { case_type: 'status_change', item_name: '技能試験・日本語試験の合格証明書の写し', submit_to: AUTHORITY, sort_order: 7 },
  { case_type: 'status_change', item_name: '健康診断個人票', submit_to: AUTHORITY, sort_order: 8 },
  { case_type: 'status_change', item_name: '在留カードの写し', submit_to: AUTHORITY, sort_order: 9 },
  { case_type: 'status_change', item_name: 'パスポートの写し', submit_to: AUTHORITY, sort_order: 10 },

  // 在留期間更新許可申請（同一資格での期間更新）
  { case_type: 'renewal', item_name: '在留期間更新許可申請書', submit_to: AUTHORITY, sort_order: 1 },
  { case_type: 'renewal', item_name: '証明写真', submit_to: AUTHORITY, sort_order: 2 },
  { case_type: 'renewal', item_name: '特定技能雇用契約書の写し（更新後）', submit_to: AUTHORITY, sort_order: 3 },
  { case_type: 'renewal', item_name: '賃金の支払いに関する説明書', submit_to: AUTHORITY, sort_order: 4 },
  { case_type: 'renewal', item_name: '支援計画の実施状況に関する届出書', submit_to: AUTHORITY, sort_order: 5 },
  { case_type: 'renewal', item_name: '直近の定期報告書の写し', submit_to: AUTHORITY, sort_order: 6 },
  { case_type: 'renewal', item_name: '在留カードの写し', submit_to: AUTHORITY, sort_order: 7 },
  { case_type: 'renewal', item_name: 'パスポートの写し', submit_to: AUTHORITY, sort_order: 8 },

  // その他の在留期間の延長等
  { case_type: 'extension', item_name: '在留期間更新許可申請書', submit_to: AUTHORITY, sort_order: 1 },
  { case_type: 'extension', item_name: '延長理由に関する説明書', submit_to: AUTHORITY, sort_order: 2 },
  { case_type: 'extension', item_name: '在留カードの写し', submit_to: AUTHORITY, sort_order: 3 },
  { case_type: 'extension', item_name: 'パスポートの写し', submit_to: AUTHORITY, sort_order: 4 },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO case_document_items (case_type, item_name, submit_to, is_required, sort_order)
    VALUES (?,?,?,1,?)
  `);
  for (const item of ITEMS) {
    insert.run(item.case_type, item.item_name, item.submit_to, item.sort_order);
  }
  console.log(`case_document_items: ${ITEMS.length}件`);
}

module.exports = { seed };
