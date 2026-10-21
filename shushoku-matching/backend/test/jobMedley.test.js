'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { stop, api } = require('./helpers');
const { getDb } = require('../database/db');
const jm = require('../services/sources/jobMedleyImport');
const { importCsvBuffer } = require('../services/sources/manualImport');

test.after(() => stop());

test('ジョブメドレー：タイトル・給与・資格の読取', () => {
  assert.deepEqual(jm.splitTitle('フォービスライフ西葛西の介護職/ヘルパー求人（正職員）'), { company: 'フォービスライフ西葛西', job: '介護職/ヘルパー' });
  assert.equal(jm.splitTitle('ベルパーククリニック_八王子【2026年09月オープン】の正看護師求人').company, 'ベルパーククリニック 八王子');
  assert.deepEqual(jm.parseWage('パート・バイト 時給 2,000円 〜 3,150円'), { wage_type: 'hourly', wage_min: 2000, wage_max: 3150 });
  assert.deepEqual(jm.parseWage('正職員 月給 295,000円 〜'), { wage_type: 'monthly', wage_min: 295000, wage_max: null });
  assert.equal(jm.parseWage('正職員 求人の詳細でご確認ください').wage_min, null);
  // 「いずれか」の列挙は最も下位の資格だけを必須に
  assert.equal(jm.parseLicenses('下記いずれかの資格をお持ちの方 ・介護福祉士 ・実務者研修 ・初任者研修', 'hh').required, '初任者研修');
  assert.equal(jm.parseLicenses('看護師もしくは准看護師', 'ans').required, '准看護師');
  assert.equal(jm.parseLicenses('正看護師資格 普通自動車運転免許', 'ans').required, '看護師');
  // 無資格可・資格不問は必須にしない
  assert.equal(jm.parseLicenses('・初任者研修以上 ※無資格の方応相談', 'hh').required, null);
  assert.equal(jm.parseLicenses('資格不問 学歴不問', 'hh').required, null);
  // 優遇は歓迎資格へ
  const r = jm.parseLicenses('未経験可 ・介護福祉士優遇', 'hh');
  assert.equal(r.required, null);
  assert.equal(r.preferred, '介護福祉士');
  assert.equal(jm.facilityOf('特別養護老人ホーム深沢共愛ホームズの介護職/ヘルパー求人', ''), '特養');
  assert.equal(jm.facilityOf('ケア21 落合', '訪問介護・交通費支給'), '訪問');
  assert.equal(jm.stationOf('東京メトロ東西線 西葛西駅から徒歩で5分'), '西葛西駅');
});

test('ジョブメドレーCSV：ネット求人として取込・再取込で更新', () => {
  const csv = '﻿"職種コード","求人URL","タイトル","サブタイトル","雇用形態","給与（原文）","仕事内容（400字まで）","応募要件（400字まで）","住所","アクセス","特徴タグ"\n'
    + '"hh","https://job-medley.com/hh/999001/","テストホームの介護職/ヘルパー求人（正職員）","","正職員","正職員 月給 250,000円 〜 300,000円","介護業務全般","初任者研修以上","東京都世田谷区上馬1-1-1","東急田園都市線 駒沢大学駅から徒歩5分","特別養護老人ホーム・交通費支給"\n';
  const r1 = importCsvBuffer(Buffer.from(csv), 'jm.csv');
  assert.equal(r1.format, 'ジョブメドレー');
  assert.equal(r1.inserted, 1);
  const p = getDb().prepare("SELECT * FROM job_postings WHERE source_url = 'https://job-medley.com/hh/999001/'").get();
  assert.equal(p.origin, 'web');
  assert.match(p.posting_no, /^W-/);
  assert.equal(p.company_name, 'テストホーム');
  assert.equal(p.employment_type, '正社員');
  assert.equal(p.city, '世田谷区');
  assert.equal(p.facility_type, '特養');
  assert.equal(p.required_licenses, '初任者研修');
  assert.equal(p.wage_min, 250000);
  assert.ok(p.expiry_date);
  assert.equal(importCsvBuffer(Buffer.from(csv), 'jm.csv').updated, 1);
});

test('求人一覧：職種・施設・雇用形態で絞込、件数と並び替え', async () => {
  const r = await api('GET', '/api/postings?origin=web&kind=' + encodeURIComponent('介護職') + '&facility=' + encodeURIComponent('特養') + '&employment=' + encodeURIComponent('正社員') + '&sort=wage&limit=10');
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 1 && r.body.every(p => p.facility_type === '特養'));
  const c = await api('GET', '/api/postings/count?origin=web&facility=' + encodeURIComponent('特養'));
  assert.ok(c.body.total >= r.body.length);
});
