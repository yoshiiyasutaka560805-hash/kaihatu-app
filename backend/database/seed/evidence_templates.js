'use strict';

// service_type_id = 0 は全サービス共通
// access_path: ほのぼのシステムの操作パス等

const TEMPLATES = [
  // ── 身体拘束廃止取組 (subsidy_id:10) ───────────────────────
  { subsidy_id: 10, service_type_id: 0, evidence_type: 'committee_minutes',
    evidence_name: '委員会議事録（3か月に1回以上）',
    access_path: '委員会議事録ファイル（紙またはPC保存）',
    description: '3か月に1回以上の開催を確認', sort_order: 1 },
  { subsidy_id: 10, service_type_id: 0, evidence_type: 'guidelines',
    evidence_name: '身体拘束適正化指針',
    description: '施設として整備した指針の存在を確認', sort_order: 2 },
  { subsidy_id: 10, service_type_id: 0, evidence_type: 'training_report',
    evidence_name: '研修報告書（年2回以上）',
    description: '定期的な研修の実施記録', sort_order: 3 },

  // ── 安全管理体制 (subsidy_id:11) ───────────────────────────
  { subsidy_id: 11, service_type_id: 0, evidence_type: 'guidelines',
    evidence_name: '事故発生防止のための指針',
    description: '指針が整備・最新化されていることを確認', sort_order: 1 },
  { subsidy_id: 11, service_type_id: 0, evidence_type: 'committee_minutes',
    evidence_name: '事故防止委員会議事録',
    description: '定期開催の記録', sort_order: 2 },
  { subsidy_id: 11, service_type_id: 0, evidence_type: 'training_report',
    evidence_name: '研修報告書（年2回以上）',
    access_path: '研修予定表・報告書ファイル',
    description: '年2回以上の実施記録。令和7年は追加実施が必要。', sort_order: 3 },

  // ── 高齢者虐待防止 (subsidy_id:12) ─────────────────────────
  { subsidy_id: 12, service_type_id: 0, evidence_type: 'committee_minutes',
    evidence_name: '虐待防止委員会議事録',
    description: '定期開催の記録', sort_order: 1 },
  { subsidy_id: 12, service_type_id: 0, evidence_type: 'guidelines',
    evidence_name: '虐待防止のための指針',
    description: '指針が整備されていることを確認', sort_order: 2 },
  { subsidy_id: 12, service_type_id: 0, evidence_type: 'training_report',
    evidence_name: '研修報告書（年2回以上）',
    description: '年2回以上の研修実施記録', sort_order: 3 },

  // ── BCP (subsidy_id:13) ─────────────────────────────────────
  { subsidy_id: 13, service_type_id: 0, evidence_type: 'bcp_doc',
    evidence_name: '業務継続計画書（BCP）',
    description: 'BCPが策定・最新化されていることを確認', sort_order: 1 },
  { subsidy_id: 13, service_type_id: 0, evidence_type: 'training_report',
    evidence_name: 'BCP研修報告書（年2回）',
    description: '年2回の研修実施記録。令和7年分の追加実施が必要。', sort_order: 2 },

  // ── 夜勤職員配置加算 (subsidy_id:23) ───────────────────────
  { subsidy_id: 23, service_type_id: 0, evidence_type: 'shift',
    evidence_name: 'シフト（勤務体系一覧表）',
    access_path: 'シフト表（毎月）',
    description: '夜勤職員数が基準数+1以上であることを確認', sort_order: 1 },
  { subsidy_id: 23, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '体制届（東京都）',
    description: '東京都への体制届が適切に提出されていること', sort_order: 2 },

  // ── 日常生活継続支援加算 (subsidy_id:20) ────────────────────
  { subsidy_id: 20, service_type_id: 0, evidence_type: 'honobo_statistics',
    evidence_name: 'ほのぼの 月間利用者数統計',
    access_path: 'ほのぼの「利用状況」→「統計」→「月間利用者数」',
    description: '要介護度分布・認知症割合・喀痰吸引割合を確認', sort_order: 1 },
  { subsidy_id: 20, service_type_id: 0, evidence_type: 'shift',
    evidence_name: 'シフト（介護福祉士の常勤換算）',
    description: '介護福祉士の常勤換算数を確認（目標7.7名）', sort_order: 2 },

  // ── 看護体制加算Ⅰ (subsidy_id:21) ─────────────────────────
  { subsidy_id: 21, service_type_id: 0, evidence_type: 'shift',
    evidence_name: 'シフト（看護師配置確認）',
    description: '常勤の看護師が1名以上配置されていることを確認', sort_order: 1 },
  { subsidy_id: 21, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '体制届（東京都）',
    description: '体制届が提出されていること', sort_order: 2 },
  { subsidy_id: 21, service_type_id: 0, evidence_type: 'honobo_statistics',
    evidence_name: 'ほのぼの 月間利用者数統計',
    access_path: 'ほのぼの「利用状況」→「統計」→「月間利用者数」',
    description: '定員超過・人員基準欠如に該当していないか確認', sort_order: 3 },

  // ── 栄養マネジメント強化体制加算 (subsidy_id:24) ──────────
  { subsidy_id: 24, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '体制届（東京都）',
    description: '体制届が提出されていること', sort_order: 1 },
  { subsidy_id: 24, service_type_id: 0, evidence_type: 'shift',
    evidence_name: 'シフト（管理栄養士の常勤換算）',
    description: '管理栄養士の常勤換算数を確認（2025年5月以降は2名必要の見込み）', sort_order: 2 },
  { subsidy_id: 24, service_type_id: 0, evidence_type: 'honobo_care_plan',
    evidence_name: 'ほのぼの 栄養管理計画書',
    access_path: 'ほのぼの 個別サービス計画書（栄養）',
    description: '多職種共同の栄養管理計画が作成されていること', sort_order: 3 },
  { subsidy_id: 24, service_type_id: 0, evidence_type: 'honobo_statistics',
    evidence_name: 'ほのぼの 月間利用者数統計',
    access_path: 'ほのぼの「利用状況」→「統計」→「月間利用者数」',
    description: '算定期間の入所者数確認（前年度平均）', sort_order: 4 },
  { subsidy_id: 24, service_type_id: 0, evidence_type: 'life_system',
    evidence_name: 'LIFEシステム（栄養データ提出確認）',
    access_path: 'ほのぼの LIFE連携 → LIFEシステム',
    description: '四半期ごとのデータ提出を確認', sort_order: 5 },

  // ── 精神科医師定期的療養指導 (subsidy_id:31) ────────────────
  { subsidy_id: 31, service_type_id: 0, evidence_type: 'honobo_case',
    evidence_name: 'ほのぼのケース スケジュール（療養指導）',
    access_path: 'ほのぼのケース → スケジュール（月2回以上の記録）',
    description: '月2回以上の精神科医師による療養指導記録を確認', sort_order: 1 },
  { subsidy_id: 31, service_type_id: 0, evidence_type: 'honobo_case',
    evidence_name: 'ほのぼのケース「堀船クリニック」検索',
    access_path: 'ほのぼのケース → 文字検索「堀船クリニック」',
    description: '療養指導の記録が入力されていることを確認', sort_order: 2 },

  // ── 個別機能訓練加算 (subsidy_id:30) ───────────────────────
  { subsidy_id: 30, service_type_id: 0, evidence_type: 'shift',
    evidence_name: '勤務体系一覧表（機能訓練指導員）',
    description: '専従の機能訓練指導員（理学療法士等）が常勤1名以上であること', sort_order: 1 },
  { subsidy_id: 30, service_type_id: 0, evidence_type: 'qualification_cert',
    evidence_name: '機能訓練指導員の資格証の写し',
    description: '理学療法士・作業療法士等の資格証があること', sort_order: 2 },
  { subsidy_id: 30, service_type_id: 0, evidence_type: 'honobo_care_plan',
    evidence_name: 'ほのぼの 個別機能訓練計画書（同意あり）',
    access_path: 'ほのぼの 個別サービス計画書（機能訓練）',
    description: '本人同意のある個別機能訓練計画書があること', sort_order: 3 },
  { subsidy_id: 30, service_type_id: 0, evidence_type: 'honobo_case',
    evidence_name: 'ほのぼのケース「再評価」（3か月ごと）',
    access_path: 'ほのぼのケース → 「再評価」',
    description: '3か月ごとの評価実施記録があること', sort_order: 4 },
  { subsidy_id: 30, service_type_id: 0, evidence_type: 'care_plan_individual',
    evidence_name: '家屋調査票（41番様式）',
    access_path: '個人ファイル → 家屋調査票',
    description: '家屋調査票（41番様式）が作成されていること', sort_order: 5 },
  { subsidy_id: 30, service_type_id: 0, evidence_type: 'life_system',
    evidence_name: 'LIFEシステム（機能訓練データ提出確認）',
    access_path: 'ほのぼの LIFE連携 → LIFEシステム',
    description: '四半期ごとのデータ提出を確認', sort_order: 6 },

  // ── 科学的介護推進体制加算 (subsidy_id:40) ─────────────────
  { subsidy_id: 40, service_type_id: 0, evidence_type: 'honobo_life',
    evidence_name: 'ほのぼの LIFE連携（全員のデータ提出確認）',
    access_path: 'ほのぼの「LIFE連携」',
    description: '全入所者のデータ提出状況を確認', sort_order: 1 },
  { subsidy_id: 40, service_type_id: 0, evidence_type: 'life_system',
    evidence_name: 'LIFEシステム（提出履歴確認）',
    description: '四半期ごとの提出履歴をLIFEシステムで確認', sort_order: 2 },

  // ── 生産性向上推進体制加算 (subsidy_id:41) ─────────────────
  { subsidy_id: 41, service_type_id: 0, evidence_type: 'committee_minutes',
    evidence_name: '生産性向上委員会議事録',
    description: '利用者安全・サービス質・職員負担軽減を検討した委員会の議事録', sort_order: 1 },

  // ── 療養食加算 (subsidy_id:50) ──────────────────────────────
  { subsidy_id: 50, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '体制届（東京都）',
    description: '体制届が提出されていること', sort_order: 1 },
  { subsidy_id: 50, service_type_id: 0, evidence_type: 'qualification_cert',
    evidence_name: '管理栄養士・栄養士の資格証',
    description: '管理栄養士または栄養士が管理していること', sort_order: 2 },
  { subsidy_id: 50, service_type_id: 0, evidence_type: 'care_plan_individual',
    evidence_name: '食事箋（医師発行）',
    description: '医師が発行した食事箋があること', sort_order: 3 },

  // ── 看取り介護加算Ⅰ (subsidy_id:60) ────────────────────────
  { subsidy_id: 60, service_type_id: 0, evidence_type: 'guidelines',
    evidence_name: '看取り介護指針',
    description: '看取りに関する指針が整備されていること', sort_order: 1 },
  { subsidy_id: 60, service_type_id: 0, evidence_type: 'care_plan_individual',
    evidence_name: '看取り同意書（入所時）',
    description: '入所時に入所者・家族への説明・同意書があること', sort_order: 2 },
  { subsidy_id: 60, service_type_id: 0, evidence_type: 'contract',
    evidence_name: '協力医療機関との24時間連絡体制確認書',
    description: '協力医療機関との24時間連絡体制が文書化されていること', sort_order: 3 },
  { subsidy_id: 60, service_type_id: 0, evidence_type: 'committee_minutes',
    evidence_name: '看取り委員会議事録（指針見直し）',
    description: '看取り指針の定期的な見直し記録', sort_order: 4 },
  { subsidy_id: 60, service_type_id: 0, evidence_type: 'training_report',
    evidence_name: '看取り関連研修報告書',
    description: '職員向け看取り研修の実施記録', sort_order: 5 },
  { subsidy_id: 60, service_type_id: 0, evidence_type: 'honobo_case',
    evidence_name: 'ほのぼのケース（看取りカンファ記録）',
    access_path: 'ほのぼのケース → 看取りカンファレンス記録',
    description: '多職種カンファレンスの記録・医師の診断確認', sort_order: 6 },

  // ── 協力医療機関連携加算Ⅰ (subsidy_id:62) ──────────────────
  { subsidy_id: 62, service_type_id: 0, evidence_type: 'contract',
    evidence_name: '協力医療機関との契約書（3要件確認）',
    description: '相談対応・診療・入院受入の3要件が記載された契約書', sort_order: 1 },
  { subsidy_id: 62, service_type_id: 0, evidence_type: 'committee_minutes',
    evidence_name: '協力医療機関との定期会議記録（月1回以上）',
    description: '月1回以上の定期的な会議等の記録', sort_order: 2 },
  { subsidy_id: 62, service_type_id: 0, evidence_type: 'honobo_case',
    evidence_name: 'ほのぼのケース（情報共有記録）',
    access_path: 'ほのぼのケース → 協力医療機関との情報共有記録',
    description: '入所者情報の共有・対応確認の記録', sort_order: 3 },

  // ── サービス提供体制強化加算 (subsidy_id:70) ────────────────
  { subsidy_id: 70, service_type_id: 0, evidence_type: 'shift',
    evidence_name: '勤務体系一覧表（常勤職員比率確認）',
    description: '常勤職員比率75%以上であることをシフトから確認', sort_order: 1 },
  { subsidy_id: 70, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '体制届（東京都）',
    description: '体制届が提出されていること', sort_order: 2 },

  // ── 処遇改善加算 (subsidy_id:71) ────────────────────────────
  { subsidy_id: 71, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '別紙様式２（処遇改善計画書）',
    access_path: '副施設長PC管理（別紙様式２）',
    description: '処遇改善計画書の提出記録', sort_order: 1 },
  { subsidy_id: 71, service_type_id: 0, evidence_type: 'notification',
    evidence_name: '別紙様式３（実績報告）',
    access_path: '副施設長PC管理（別紙様式３）',
    description: '処遇改善の実績報告書の提出記録', sort_order: 2 },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO evidence_template_definitions
      (subsidy_id, service_type_id, evidence_type, evidence_name,
       access_path, description, is_required, sort_order)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  for (const t of TEMPLATES) {
    insert.run(
      t.subsidy_id, t.service_type_id ?? 0,
      t.evidence_type, t.evidence_name,
      t.access_path || null, t.description || null,
      t.is_required ?? 1, t.sort_order ?? 0,
    );
  }
  console.log(`evidence_template_definitions: ${TEMPLATES.length}件`);
}

module.exports = { seed };
