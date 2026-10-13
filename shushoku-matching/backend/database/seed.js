'use strict';

// 動作確認用サンプルデータ（架空）
const { getDb } = require('./db');
const { importRows } = require('../services/postingStore');

const future = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

const postings = [
  { 求人番号: '99000-00000001', 事業所名: 'サンプル特養A', 都道府県: '大阪府', 市区町村: '堺市', 職種: '介護職員（特養）',
    職種分類: '介護', 雇用形態: '正社員', 賃金形態: '月給', 賃金下限: '220000', 賃金上限: '280000', 交替制: 'あり',
    週所定労働日数: '5', 年間休日数: '110', 必須資格: '介護職員初任者研修', 歓迎資格: '介護福祉士', 紹介期限日: future,
    仕事内容: '特別養護老人ホームでの入居者の生活全般の介護' },
  { 求人番号: '99000-00000002', 事業所名: 'サンプルデイB', 都道府県: '大阪府', 市区町村: '堺市', 職種: 'デイサービス介護職',
    職種分類: '介護', 雇用形態: 'パート', 賃金形態: '時給', 賃金下限: '1200', 賃金上限: '1400', 始業時刻: '9:00', 終業時刻: '16:00',
    週所定労働日数: '4', 必須資格: '', 紹介期限日: future, 仕事内容: 'デイサービスでの入浴・食事介助、送迎補助' },
  { 求人番号: '99000-00000003', 事業所名: 'サンプル商事C', 都道府県: '大阪府', 市区町村: '大阪市', 職種: '一般事務',
    職種分類: '事務', 雇用形態: '正社員', 賃金形態: '月給', 賃金下限: '200000', 賃金上限: '230000', 始業時刻: '9:00', 終業時刻: '18:00',
    週所定労働日数: '5', 年間休日数: '120', 紹介期限日: future, 仕事内容: '受発注、電話応対、データ入力' },
  { 求人番号: '99000-00000004', 事業所名: 'サンプル病院D', 都道府県: '大阪府', 市区町村: '和泉市', 職種: '看護師',
    職種分類: '医療', 雇用形態: '正社員', 賃金形態: '月給', 賃金下限: '300000', 賃金上限: '380000', 交替制: 'あり',
    必須資格: '看護師', 紹介期限日: future, 仕事内容: '病棟看護業務' },
];

const seekers = [
  { name: '架空 太郎', prefecture: '大阪府', city: '堺市', acceptable_cities: '和泉市,高石市', desired_categories: '介護',
    desired_employment: '正社員', desired_wage_type: 'monthly', desired_wage_min: 210000, shift_ok: 1,
    min_annual_holidays: 105, licenses: '介護職員初任者研修', experience_years: 2, birth_date: '1990-04-01',
    consent_date: new Date().toISOString().slice(0, 10), ai_consent: 0, status: '受付' },
  { name: '架空 花子', prefecture: '大阪府', city: '大阪市', acceptable_cities: '堺市', desired_categories: '事務,介護',
    desired_employment: '正社員,パート', desired_wage_type: 'monthly', desired_wage_min: 190000, shift_ok: 0,
    available_start: '08:30', available_end: '18:30', licenses: '', experience_years: 0, birth_date: '1985-10-10',
    consent_date: new Date().toISOString().slice(0, 10), ai_consent: 0, status: '受付' },
];

const db = getDb();
const r = importRows(postings, 'manual');
if (!db.prepare('SELECT COUNT(*) c FROM job_seekers').get().c) {
  const keys = [...new Set(seekers.flatMap(Object.keys))];
  const ins = db.prepare(`INSERT INTO job_seekers (${keys.join(',')})
    VALUES (${keys.map(k => '@' + k).join(',')})`);
  for (const s of seekers) ins.run(Object.fromEntries(keys.map(k => [k, s[k] ?? null])));
}
console.log('seed:', r);
