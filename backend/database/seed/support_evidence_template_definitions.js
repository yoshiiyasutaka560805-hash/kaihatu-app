'use strict';

const EVIDENCE_BY_ITEM_CODE = {
  PRE_GUIDANCE: ['事前ガイダンス実施記録', '説明に使用した資料の写し'],
  PICKUP: ['送迎実施記録（日時・場所）'],
  HOUSING: ['賃貸契約書の写し又は社宅提供に関する書類', '生活に必要な契約支援の実施記録'],
  ORIENTATION: ['生活オリエンテーション実施記録', '使用した説明資料の写し'],
  PROCEDURES: ['同行した公的手続きの実施記録'],
  JAPANESE_STUDY: ['日本語学習の機会に関する情報提供記録'],
  CONSULTATION: ['相談・苦情対応記録'],
  EXCHANGE: ['交流促進の実施記録'],
  JOB_CHANGE_SUPPORT: ['転職支援の実施記録（該当する場合のみ）'],
  INTERVIEW: ['定期面談記録', '行政機関への通報記録（該当する場合のみ）'],
};

function seed(db) {
  const getItemId = db.prepare('SELECT id FROM support_plan_items WHERE item_code = ?');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO support_evidence_template_definitions
      (support_plan_item_id, evidence_name, is_required, sort_order)
    VALUES (?,?,1,?)
  `);

  let count = 0;
  for (const [itemCode, evidenceNames] of Object.entries(EVIDENCE_BY_ITEM_CODE)) {
    const item = getItemId.get(itemCode);
    if (!item) continue;
    evidenceNames.forEach((name, idx) => {
      insert.run(item.id, name, idx + 1);
      count++;
    });
  }
  console.log(`support_evidence_template_definitions: ${count}件`);
}

module.exports = { seed };
