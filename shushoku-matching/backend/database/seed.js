'use strict';

// 動作確認用サンプルデータ（すべて架空）
const { getDb } = require('./db');
const { importRows } = require('../services/postingStore');
const { todayJst, addDays, addMonths } = require('../utils/dates');

const today = todayJst();
const future = addDays(today, 60);
const db = getDb();

importRows([
  { 求人番号: '99000-00000001', 事業所名: 'サンプル特養A', 都道府県: '大阪府', 市区町村: '堺市北区', 職種: '介護職員（特養）', 職種分類: '介護',
    施設種別: '特養', 職務区分: '介護職', 雇用形態: '正社員', 雇用期間の定め: '定めなし', 賃金形態: '月給', 賃金下限: '22万', 賃金上限: '28万',
    定額的手当: '15000', 夜勤手当: '6000', 夜勤回数: '4', 賞与月数: '3.0', 交替制: 'あり', 週所定労働日数: '5', 年間休日数: '110',
    必須資格: '介護職員初任者研修', 歓迎資格: '介護福祉士', 外国人雇用: '可', 特定技能受入: 'あり', 紹介期限日: future, 仕事内容: '特別養護老人ホームでの介護業務全般' },
  { 求人番号: '99000-00000002', 事業所名: 'サンプルデイB', 都道府県: '大阪府', 市区町村: '堺市堺区', 職種: 'デイサービス介護職', 職種分類: '介護',
    施設種別: 'デイ', 職務区分: '介護職', 雇用形態: 'パート', 雇用期間の定め: '有期', 賃金形態: '時給', 賃金下限: '1,200', 賃金上限: '1,400',
    始業時刻: '9:00', 終業時刻: '16:00', 週所定労働日数: '4', 紹介期限日: future, 仕事内容: '入浴・食事介助、送迎補助' },
  { 求人番号: '99000-00000003', 事業所名: 'サンプル訪問介護C', 都道府県: '大阪府', 市区町村: '和泉市', 職種: '訪問介護員', 職種分類: '介護',
    施設種別: '訪問', 訪問系業務: 'あり', 雇用形態: '正社員', 賃金形態: '月給', 賃金下限: '240000', 賃金上限: '300000', 始業時刻: '8:30',
    終業時刻: '17:30', 週所定労働日数: '5', 年間休日数: '115', 必須資格: '介護職員初任者研修', 紹介期限日: future },
  { 求人番号: '99000-00000004', 事業所名: 'サンプル病院D', 都道府県: '東京都', 市区町村: '府中市', 職種: '看護師', 職種分類: '医療',
    施設種別: '病院', 雇用形態: '正社員', 賃金形態: '月給', 賃金下限: '300000', 賃金上限: '380000', 交替制: 'あり', 必須資格: '看護師', 紹介期限日: future },
], 'manual');

if (!db.prepare('SELECT COUNT(*) c FROM employers').get().c) {
  db.prepare(`INSERT INTO employers (name, prefecture, city, contact_person, phone, contract_date, fee_rate_percent, facility_types, council_joined)
    VALUES ('社会福祉法人サンプル会（サンプル特養A）', '大阪府', '堺市北区', '採用担当 架空', '000-0000-0000', ?, NULL, '特養', 1)`).run(today);
}

if (!db.prepare('SELECT COUNT(*) c FROM job_seekers').get().c) {
  const ins = (o) => {
    const keys = Object.keys(o);
    db.prepare(`INSERT INTO job_seekers (${keys.join(',')}) VALUES (${keys.map(k => '@' + k).join(',')})`).run(o);
  };
  ins({ name: '架空 太郎', prefecture: '大阪府', city: '堺市', acceptable_cities: '和泉市,高石市', desired_categories: '介護',
    desired_facility_types: '特養,老健', desired_employment: '正社員', desired_wage_type: 'monthly', desired_wage_min: 230000,
    shift_ok: 1, night_max_per_month: 5, min_annual_holidays: 105, licenses: '介護職員初任者研修', experience_years: 2,
    birth_date: '1990-04-01', consent_date: today, accepted_date: today, validity_end: addMonths(today, 3), ai_consent: 0, status: '受付' });
  ins({ name: 'グエン ヴァン アー（架空）', prefecture: '大阪府', city: '堺市', acceptable_cities: '和泉市', desired_categories: '介護',
    desired_employment: '正社員', desired_wage_type: 'monthly', desired_wage_min: 200000, shift_ok: 1, licenses: '介護職員初任者研修',
    experience_years: 1, birth_date: '1999-02-02', consent_date: today, accepted_date: today, validity_end: addMonths(today, 3),
    is_foreign_national: 1, visa_status: '特定技能1号', residence_expiry: addDays(today, 70), jlpt_level: 'N3', care_japanese_test: 1,
    skill_test: '介護技能評価試験', preferred_language: 'vi', ai_consent: 0, status: '受付' });
}
console.log('seed: done');
