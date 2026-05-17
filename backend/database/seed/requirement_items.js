'use strict';

// service_type_id = 0 は全サービス共通
// 法令文言に準拠した実用的なチェック項目（最大8項目/加算）

const ITEMS = [
  // ── 身体拘束廃止取組 (id:10) ────────────────────────────────
  { subsidy_id: 10, service_type_id: 0, item_code: 'B01', sort_order: 1,
    item_name: '委員会の定期開催（3か月に1回以上）',
    description: '身体的拘束等の適正化のための委員会を3か月に1回以上開催していること',
    check_frequency: '3か月ごと' },
  { subsidy_id: 10, service_type_id: 0, item_code: 'B02', sort_order: 2,
    item_name: '指針の整備',
    description: '身体的拘束等の適正化のための指針を整備していること' },
  { subsidy_id: 10, service_type_id: 0, item_code: 'B03', sort_order: 3,
    item_name: '定期的な研修の実施',
    description: '身体的拘束等の適正化のための定期的な研修を実施していること',
    check_frequency: '年2回以上' },
  { subsidy_id: 10, service_type_id: 0, item_code: 'B04', sort_order: 4,
    item_name: '拘束実施時の記録',
    description: '身体拘束を行った場合は態様・時間・理由を記録していること' },

  // ── 安全管理体制 (id:11) ────────────────────────────────────
  { subsidy_id: 11, service_type_id: 0, item_code: 'B11', sort_order: 1,
    item_name: '事故発生防止のための指針の整備',
    description: '事故発生防止のための指針を整備していること' },
  { subsidy_id: 11, service_type_id: 0, item_code: 'B12', sort_order: 2,
    item_name: '事故防止委員会の開催',
    description: '事故発生防止のための委員会を定期的に開催していること',
    check_frequency: '年2回以上' },
  { subsidy_id: 11, service_type_id: 0, item_code: 'B13', sort_order: 3,
    item_name: '職員研修の実施（年2回以上）',
    description: '事故発生防止のための研修を年2回以上実施していること',
    check_frequency: '年2回以上',
    threshold_value: '年2回以上' },
  { subsidy_id: 11, service_type_id: 0, item_code: 'B14', sort_order: 4,
    item_name: '安全対策担当者の設定',
    description: '事故発生防止のための担当者を設置していること' },

  // ── 高齢者虐待防止 (id:12) ──────────────────────────────────
  { subsidy_id: 12, service_type_id: 0, item_code: 'B21', sort_order: 1,
    item_name: '虐待防止委員会の定期開催',
    description: '高齢者虐待防止のための委員会を定期的に開催していること' },
  { subsidy_id: 12, service_type_id: 0, item_code: 'B22', sort_order: 2,
    item_name: '虐待防止指針の整備',
    description: '高齢者虐待防止のための指針を整備していること' },
  { subsidy_id: 12, service_type_id: 0, item_code: 'B23', sort_order: 3,
    item_name: '職員研修の実施（年2回以上）',
    description: '高齢者虐待防止のための研修を年2回以上実施していること',
    threshold_value: '年2回以上' },
  { subsidy_id: 12, service_type_id: 0, item_code: 'B24', sort_order: 4,
    item_name: '虐待防止担当者（委員長）の設定',
    description: '高齢者虐待防止のための委員長を設置していること' },

  // ── BCP (id:13) ─────────────────────────────────────────────
  { subsidy_id: 13, service_type_id: 0, item_code: 'B31', sort_order: 1,
    item_name: '業務継続計画書の策定',
    description: '感染症・非常災害の業務継続計画（BCP）を策定していること' },
  { subsidy_id: 13, service_type_id: 0, item_code: 'B32', sort_order: 2,
    item_name: 'BCP研修の実施（年2回）',
    description: 'BCPに基づく研修を年2回以上実施していること',
    threshold_value: '年2回以上',
    check_frequency: '年2回以上' },
  { subsidy_id: 13, service_type_id: 0, item_code: 'B33', sort_order: 3,
    item_name: 'BCP訓練の実施（年1回）',
    description: 'BCPに基づく訓練を年1回以上実施していること',
    threshold_value: '年1回以上' },

  // ── 夜勤職員配置加算 (id:23) ────────────────────────────────
  { subsidy_id: 23, service_type_id: 0, item_code: 'C41', sort_order: 1,
    item_name: '夜勤職員の基準超配置',
    description: '夜勤職員数を施設の基準数に1以上加えた員数を配置していること',
    check_frequency: '毎月' },
  { subsidy_id: 23, service_type_id: 0, item_code: 'C42', sort_order: 2,
    item_name: '体制届の提出',
    description: '東京都に体制届を適切に提出していること' },
  { subsidy_id: 23, service_type_id: 3, item_code: 'C43', sort_order: 3,
    item_name: 'ショートステイ併設時の合算配置確認',
    description: 'ショートステイ併設の場合、特養と合算して夜勤職員を1人以上加配していること' },

  // ── 日常生活継続支援加算 (id:20) ────────────────────────────
  { subsidy_id: 20, service_type_id: 0, item_code: 'C11', sort_order: 1,
    item_name: '重度者要件または介護福祉士配置要件の充足',
    description: '①新規入所者の要介護4・5が70%以上、または②認知症65%以上、または③喀痰吸引等15%以上、または④介護福祉士を常勤換算で入所者6人につき1人以上配置',
    threshold_value: '要介護4・5 70%以上 or 介護福祉士 入所者6人に1人以上' },
  { subsidy_id: 20, service_type_id: 0, item_code: 'C12', sort_order: 2,
    item_name: '介護福祉士の常勤換算数の確認',
    description: 'ほのぼの統計またはシフトで介護福祉士の常勤換算数を確認する（目標：7.7名）',
    check_frequency: '毎月' },

  // ── 看護体制加算Ⅰ (id:21) ──────────────────────────────────
  { subsidy_id: 21, service_type_id: 0, item_code: 'C21', sort_order: 1,
    item_name: '常勤の看護師を1名以上配置',
    description: '常勤の看護師を1名以上配置していること',
    check_frequency: '毎月' },
  { subsidy_id: 21, service_type_id: 0, item_code: 'C22', sort_order: 2,
    item_name: '定員超過・人員基準欠如がないこと',
    description: 'ほのぼの統計で入居者数が定員（ユニット96名・従来54名）を超えていないか確認',
    check_frequency: '毎月' },
  { subsidy_id: 21, service_type_id: 0, item_code: 'C23', sort_order: 3,
    item_name: '体制届の提出',
    description: '東京都に体制届を適切に提出していること' },

  // ── 栄養マネジメント強化体制 (id:24) ───────────────────────
  { subsidy_id: 24, service_type_id: 0, item_code: 'C51', sort_order: 1,
    item_name: '管理栄養士の配置数（常勤換算）',
    description: '入所者50人につき1人以上の管理栄養士を常勤換算で配置（常勤栄養士がいれば70人につき1人）。2025年5月以降はユニット・従来型合計で2名必要になる見込み',
    threshold_value: '入所者50人に1人（または70人に1人）以上' },
  { subsidy_id: 24, service_type_id: 0, item_code: 'C52', sort_order: 2,
    item_name: '多職種共同の栄養管理計画の作成',
    description: 'ほのぼの計画書でサービス担当者会議記録とともに多職種共同で栄養管理計画を作成していること' },
  { subsidy_id: 24, service_type_id: 0, item_code: 'C53', sort_order: 3,
    item_name: '食事観察と早期対応の記録',
    description: 'ほのぼの実施記録（+紙記録）で食事観察時の変化把握・早期対応を記録していること' },
  { subsidy_id: 24, service_type_id: 0, item_code: 'C54', sort_order: 4,
    item_name: 'LIFEへのデータ提出（四半期）',
    description: '栄養関連情報をLIFEに四半期ごとに提出していること',
    check_frequency: '四半期ごと' },

  // ── 精神科医師定期的療養指導 (id:31) ────────────────────────
  { subsidy_id: 31, service_type_id: 0, item_code: 'D21', sort_order: 1,
    item_name: '入所者の1/3以上が認知症診断を受けていること',
    description: '全入所者のうち1/3以上が認知症の診断を受けていること（施設実態：64%）',
    threshold_value: '1/3以上（33%以上）' },
  { subsidy_id: 31, service_type_id: 0, item_code: 'D22', sort_order: 2,
    item_name: '月2回以上の療養指導の実施',
    description: 'ほのぼのケース スケジュールで月2回以上の精神科医師による療養指導が記録されていること',
    threshold_value: '月2回以上',
    check_frequency: '毎月' },
  { subsidy_id: 31, service_type_id: 0, item_code: 'D23', sort_order: 3,
    item_name: '常勤医師加算との重複算定なし',
    description: '常勤専従医師配置加算を算定していないこと（重複不可）' },

  // ── 個別機能訓練加算 (id:30) ────────────────────────────────
  { subsidy_id: 30, service_type_id: 0, item_code: 'D11', sort_order: 1,
    item_name: '専従の機能訓練指導員（常勤1名以上）の配置',
    description: '専ら機能訓練指導員の職務に従事する常勤の理学療法士等を1名以上配置していること',
    check_frequency: '毎月' },
  { subsidy_id: 30, service_type_id: 0, item_code: 'D12', sort_order: 2,
    item_name: '個別機能訓練計画書の作成（同意あり）',
    description: 'ほのぼの計画書で個別機能訓練計画書を作成し、本人同意を得ていること' },
  { subsidy_id: 30, service_type_id: 0, item_code: 'D13', sort_order: 3,
    item_name: '3か月ごとの評価実施',
    description: 'ほのぼのケース「再評価」で3か月ごとに評価を実施していること',
    check_frequency: '3か月ごと' },
  { subsidy_id: 30, service_type_id: 0, item_code: 'D14', sort_order: 4,
    item_name: '計画内容の説明記録',
    description: 'ほのぼのケース「説明」の文字検索で計画内容の説明実施記録があること' },
  { subsidy_id: 30, service_type_id: 0, item_code: 'D15', sort_order: 5,
    item_name: '家屋調査票（41番様式）の作成',
    description: '個人ファイルに家屋調査票（41番様式）が作成されていること' },
  { subsidy_id: 30, service_type_id: 0, item_code: 'D16', sort_order: 6,
    item_name: 'LIFEへのデータ提出（四半期）',
    description: '個別機能訓練関連データをLIFEに四半期ごとに提出していること',
    check_frequency: '四半期ごと' },

  // ── 科学的介護推進体制加算 (id:40) ─────────────────────────
  { subsidy_id: 40, service_type_id: 0, item_code: 'E11', sort_order: 1,
    item_name: '全入所者のLIFEデータ提出（四半期）',
    description: '全対象入所者の心身状況等のデータをLIFEに四半期ごとに提出していること',
    check_frequency: '四半期ごと' },
  { subsidy_id: 40, service_type_id: 0, item_code: 'E12', sort_order: 2,
    item_name: 'フィードバックを活用したPDCAサイクルの実施',
    description: 'LIFEフィードバック情報等を活用して多職種で検証し、施設サービス計画を見直していること' },
  { subsidy_id: 40, service_type_id: 0, item_code: 'E13', sort_order: 3,
    item_name: 'ほのぼのLIFE連携画面の確認',
    description: 'ほのぼのLIFE連携画面でデータ提出状況を確認していること',
    check_frequency: '四半期ごと' },

  // ── 生産性向上推進体制加算 (id:41) ─────────────────────────
  { subsidy_id: 41, service_type_id: 0, item_code: 'E21', sort_order: 1,
    item_name: '生産性向上委員会の開催記録',
    description: '利用者安全・サービス質確保・職員負担軽減を検討する委員会の開催記録があること' },
  { subsidy_id: 41, service_type_id: 0, item_code: 'E22', sort_order: 2,
    item_name: 'テクノロジー活用の実態',
    description: 'aams（見守り機器）・ツナグ（連絡調整）・ほのぼの（介護記録）等のテクノロジーが実際に活用されていること' },
  { subsidy_id: 41, service_type_id: 0, item_code: 'E23', sort_order: 3,
    item_name: '業務改善効果データのオンライン提出',
    description: '1年以内ごとに業務改善効果データをオンラインで提出していること',
    check_frequency: '年1回' },

  // ── 療養食加算 (id:50) ──────────────────────────────────────
  { subsidy_id: 50, service_type_id: 0, item_code: 'F11', sort_order: 1,
    item_name: '医師発行の食事箋',
    description: '医師が発行した食事箋に基づいて適切な療養食を提供していること' },
  { subsidy_id: 50, service_type_id: 0, item_code: 'F12', sort_order: 2,
    item_name: '管理栄養士または栄養士による管理',
    description: '管理栄養士または栄養士が療養食の管理を行っていること' },
  { subsidy_id: 50, service_type_id: 0, item_code: 'F13', sort_order: 3,
    item_name: '療養食の献立表の作成',
    description: '療養食の献立表が作成されていること' },

  // ── 看取り介護加算Ⅰ (id:60) ────────────────────────────────
  { subsidy_id: 60, service_type_id: 0, item_code: 'G11', sort_order: 1,
    item_name: '看取り指針の整備と入所時の説明・同意',
    description: '看取りに関する指針を整備し、入所時に入所者・家族への説明・同意を得ていること' },
  { subsidy_id: 60, service_type_id: 0, item_code: 'G12', sort_order: 2,
    item_name: '24時間連絡体制（看護師）',
    description: '常勤看護師1名以上の配置と協力医療機関との24時間連絡体制が確保されていること' },
  { subsidy_id: 60, service_type_id: 0, item_code: 'G13', sort_order: 3,
    item_name: '看取り委員会による指針見直し',
    description: '関係職種で構成する委員会で看取り指針の見直しを定期的に行っていること' },
  { subsidy_id: 60, service_type_id: 0, item_code: 'G14', sort_order: 4,
    item_name: '看取りカンファレンスの記録',
    description: '看取り期の多職種カンファレンスの記録があること（医師の回復見込みなし診断確認）' },
  { subsidy_id: 60, service_type_id: 0, item_code: 'G15', sort_order: 5,
    item_name: '看取り同意書と多職種共同計画',
    description: '多職種共同作成の介護計画の説明・同意（看取り同意書）があること' },
  { subsidy_id: 60, service_type_id: 0, item_code: 'G16', sort_order: 6,
    item_name: '職員研修の実施',
    description: '看取りに関する研修を職員に実施していること' },

  // ── 協力医療機関連携加算Ⅰ (id:62) ──────────────────────────
  { subsidy_id: 62, service_type_id: 0, item_code: 'G31', sort_order: 1,
    item_name: '3要件を備えた協力医療機関との契約',
    description: '①入所者の病状等に関する相談対応体制、②診療体制、③入院受入体制の3要件を備えた協力医療機関との契約' },
  { subsidy_id: 62, service_type_id: 0, item_code: 'G32', sort_order: 2,
    item_name: '月1回以上の定期的な会議等の実施',
    description: '協力医療機関と概ね月1回以上の定期的な会議等を実施していること（電子システムで情報共有できる場合は年3回以上でも可）',
    threshold_value: '月1回以上（電子システム活用時は年3回以上）' },
  { subsidy_id: 62, service_type_id: 0, item_code: 'G33', sort_order: 3,
    item_name: '入所者情報の共有記録',
    description: 'ほのぼのケースで入所者・新規入所者の情報共有・対応確認の記録があること' },

  // ── サービス提供体制強化加算 (id:70) ────────────────────────
  { subsidy_id: 70, service_type_id: 0, item_code: 'H11', sort_order: 1,
    item_name: '常勤職員比率75%以上（または介護福祉士50%以上等）',
    description: '①介護福祉士50%以上、または②常勤職員75%以上、または③勤続7年以上の職員30%以上のいずれかを満たすこと（施設は常勤職員75%以上で算定）',
    threshold_value: '常勤職員75%以上（施設の算定根拠）',
    check_frequency: '毎月' },
  { subsidy_id: 70, service_type_id: 0, item_code: 'H12', sort_order: 2,
    item_name: '体制届の提出',
    description: '東京都に体制届を適切に提出していること' },

  // ── 介護職員等処遇改善加算 (id:71) ─────────────────────────
  { subsidy_id: 71, service_type_id: 0, item_code: 'H21', sort_order: 1,
    item_name: '別紙様式２（計画書）の提出',
    description: '老発0315第1号に基づく処遇改善計画書（別紙様式２）を提出していること',
    official_form: '別紙様式２' },
  { subsidy_id: 71, service_type_id: 0, item_code: 'H22', sort_order: 2,
    item_name: '別紙様式３（実績報告）の提出',
    description: '処遇改善加算の実績報告（別紙様式３）を期限内に提出していること',
    official_form: '別紙様式３' },
  { subsidy_id: 71, service_type_id: 0, item_code: 'H23', sort_order: 3,
    item_name: '職員への周知（見える化）',
    description: '処遇改善加算の取得状況を職員に周知・説明していること' },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO requirement_items
      (subsidy_id, service_type_id, item_code, item_name, description,
       legal_basis, official_form, required_for, threshold_value,
       check_frequency, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const it of ITEMS) {
    insert.run(
      it.subsidy_id, it.service_type_id ?? 0, it.item_code,
      it.item_name, it.description,
      it.legal_basis || null, it.official_form || null,
      it.required_for || 'all',
      it.threshold_value || null, it.check_frequency || null,
      it.sort_order ?? 0,
    );
  }
  console.log(`requirement_items: ${ITEMS.length}件`);
}

module.exports = { seed };
