'use strict';

// 施設の現在の算定状況を初期データとして投入
// 施設管理表（2026年5月時点）に基づく
// INSERT OR IGNORE を使用 → 既存データを上書きしない

const INITIAL_ASSESSMENTS = [
  // ── ユニット型特養 (service_type_id: 1) ──────────────────────
  { subsidy_id: 1,  service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    responsible_name: '施設長' },
  { subsidy_id: 2,  service_type_id: 1, claiming_status: 'claiming', claiming_tier: null },
  { subsidy_id: 3,  service_type_id: 1, claiming_status: 'claiming', claiming_tier: null },
  { subsidy_id: 10, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null },
  { subsidy_id: 11, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    current_concerns: '令和7年の研修が1回のみ計画中。追加実施が必要。' },
  { subsidy_id: 12, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null },
  { subsidy_id: 13, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    current_concerns: '令和7年のBCP研修が未計画。年2回の実施が必要。' },
  { subsidy_id: 14, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    responsible_name: '阿部', notes: '外部研修修了者：阿部・波間' },
  { subsidy_id: 20, service_type_id: 1, claiming_status: 'not_claiming', claiming_tier: null,
    current_concerns: '介護福祉士7.7名・要介護度70%を目標に移行中（ユニット型は現時点で非算定）' },
  { subsidy_id: 21, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 23, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅰ・Ⅱ' },
  { subsidy_id: 24, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    current_concerns: '2025年5月以降はユニット58.33名・従来45.25名の計算から管理栄養士2名必要になる見込み' },
  { subsidy_id: 30, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅰ・Ⅱ',
    requires_life: 1 },
  { subsidy_id: 31, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    notes: '認知症診断率64%（基準1/3以上を充足）。担当：堀船クリニック' },
  { subsidy_id: 40, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null,
    requires_life: 1 },
  { subsidy_id: 41, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅰ',
    notes: 'テクノロジー：aams（見守り機器）・ツナグ（連絡調整）・ほのぼの（介護記録）' },
  { subsidy_id: 50, service_type_id: 1, claiming_status: 'claiming', claiming_tier: null },
  { subsidy_id: 60, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 62, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 70, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅲ',
    notes: '常勤職員75%以上で算定' },
  { subsidy_id: 71, service_type_id: 1, claiming_status: 'claiming', claiming_tier: 'Ⅱ',
    responsible_name: '副施設長', notes: '別紙様式２・３は副施設長PCで管理' },

  // ── 従来型特養 (service_type_id: 2) ──────────────────────────
  { subsidy_id: 1,  service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 2,  service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 4,  service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 10, service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 11, service_type_id: 2, claiming_status: 'claiming',
    current_concerns: '令和7年の研修が1回のみ計画中。追加実施が必要。' },
  { subsidy_id: 12, service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 13, service_type_id: 2, claiming_status: 'claiming',
    current_concerns: '令和7年のBCP研修が未計画。年2回の実施が必要。' },
  { subsidy_id: 14, service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 20, service_type_id: 2, claiming_status: 'claiming', claiming_tier: '３ あり',
    notes: '従来型は日常生活継続支援加算算定中' },
  { subsidy_id: 21, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 23, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅰ・Ⅱ' },
  { subsidy_id: 24, service_type_id: 2, claiming_status: 'not_claiming',
    notes: '従来型は栄養マネジメント強化体制加算は非算定' },
  { subsidy_id: 30, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅰ・Ⅱ' },
  { subsidy_id: 31, service_type_id: 2, claiming_status: 'claiming',
    notes: '認知症診断率64%' },
  { subsidy_id: 40, service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 41, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 50, service_type_id: 2, claiming_status: 'claiming' },
  { subsidy_id: 60, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 62, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 70, service_type_id: 2, claiming_status: 'not_claiming',
    notes: '従来型はサービス提供体制強化加算は非算定' },
  { subsidy_id: 71, service_type_id: 2, claiming_status: 'claiming', claiming_tier: 'Ⅱ' },

  // ── ショートステイ (service_type_id: 3) ──────────────────────
  { subsidy_id: 10, service_type_id: 3, claiming_status: 'claiming',
    current_concerns: '2025年4月の届出が未提出。身体拘束廃止届出の経過措置終了後に届出が必要。' },
  { subsidy_id: 11, service_type_id: 3, claiming_status: 'claiming' },
  { subsidy_id: 12, service_type_id: 3, claiming_status: 'claiming' },
  { subsidy_id: 13, service_type_id: 3, claiming_status: 'claiming' },
  { subsidy_id: 21, service_type_id: 3, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 23, service_type_id: 3, claiming_status: 'claiming', claiming_tier: 'Ⅰ・Ⅱ' },
  { subsidy_id: 30, service_type_id: 3, claiming_status: 'claiming' },
  { subsidy_id: 70, service_type_id: 3, claiming_status: 'claiming', claiming_tier: 'Ⅱ',
    notes: '常勤職員75%以上で算定' },
  { subsidy_id: 71, service_type_id: 3, claiming_status: 'claiming', claiming_tier: 'Ⅱ' },
  { subsidy_id: 81, service_type_id: 3, claiming_status: 'claiming' },
  { subsidy_id: 82, service_type_id: 3, claiming_status: 'claiming' },

  // ── ショートステイ予防 (service_type_id: 4) ──────────────────
  { subsidy_id: 10, service_type_id: 4, claiming_status: 'claiming' },
  { subsidy_id: 21, service_type_id: 4, claiming_status: 'claiming', claiming_tier: 'Ⅰ' },
  { subsidy_id: 23, service_type_id: 4, claiming_status: 'claiming' },
  { subsidy_id: 71, service_type_id: 4, claiming_status: 'claiming', claiming_tier: 'Ⅱ' },
  { subsidy_id: 81, service_type_id: 4, claiming_status: 'claiming' },
  { subsidy_id: 82, service_type_id: 4, claiming_status: 'claiming' },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO assessments
      (subsidy_id, service_type_id, claiming_status, claiming_tier,
       responsible_name, responsible_role, current_concerns,
       has_past_findings, notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  let count = 0;
  for (const a of INITIAL_ASSESSMENTS) {
    const info = insert.run(
      a.subsidy_id, a.service_type_id, a.claiming_status,
      a.claiming_tier || null, a.responsible_name || null,
      a.responsible_role || null, a.current_concerns || null,
      a.has_past_findings || 0, a.notes || null,
    );
    if (info.changes > 0) count++;
  }
  console.log(`assessments: ${count}件 INSERT (${INITIAL_ASSESSMENTS.length - count}件は既存データを保持)`);
}

module.exports = { seed };
