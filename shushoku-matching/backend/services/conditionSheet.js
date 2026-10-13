'use strict';

// 求職者の「条件表」（Excel・Word・PDF）の取込
//  1) ファイルからテキストを取り出す（xlsx: exceljs / docx: jszip / pdf: unpdf。画像のみのPDFはテキストなし）
//  2) 自社の条件表テンプレート（項目名：値 の2列）なら、AIを使わずに項目名で読み取る
//  3) それ以外の様式は、氏名・連絡先等をマスキングしてから AI で希望条件を抽出する
//  4) 結果は下書き（drafts.kind = 'seeker_sheet'）として保存し、担当者が確認・修正して承認する

const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { maskText } = require('./ai/pii');
const { callStructured } = require('./ai/client');
const { SCHEMA: MEMO_SCHEMA } = require('./ai/memoExtract');
const { FACILITY_TYPES, JOB_KINDS } = require('../models/specs');

// テンプレートの項目名 → 求職者の項目（表記ゆれも受け付ける）
const LABELS = {
  name: ['氏名', '名前', 'お名前'], name_kana: ['フリガナ', 'ふりがな', '氏名（カナ）'], birth_date: ['生年月日'],
  phone: ['電話番号', '電話', '携帯電話'], email: ['メールアドレス', 'メール', 'E-mail'], address: ['住所', '現住所'],
  prefecture: ['都道府県'], city: ['市区町村', '居住市区町村'], nearest_station: ['最寄り駅', '最寄駅'],
  acceptable_cities: ['通勤可能な市区町村', '希望勤務地', '勤務希望地'], transport: ['通勤手段'], max_commute_minutes: ['通勤時間の上限（分）', '通勤時間上限', '通勤時間'],
  desired_categories: ['希望職種'], desired_job_kinds: ['希望職務'], desired_facility_types: ['希望施設', '希望施設種別'],
  excluded_facility_types: ['希望しない施設', '不可の施設'], desired_employment: ['希望雇用形態', '雇用形態'],
  desired_wage_type: ['賃金形態', '給与形態'], desired_wage_min: ['希望賃金', '希望給与', '希望月給', '希望時給'],
  available_start: ['勤務可能時間（開始）', '勤務開始可能時刻'], available_end: ['勤務可能時間（終了）', '勤務終了可能時刻'],
  shift_ok: ['夜勤・交替制', '夜勤可否', '夜勤'], night_max_per_month: ['夜勤回数の上限（月）', '夜勤回数上限'],
  night_only: ['夜勤専従希望'], max_days_per_week: ['週の勤務日数上限', '勤務日数（週）'], min_annual_holidays: ['希望年間休日', '年間休日'],
  available_from: ['就業可能日', '入職可能日', '勤務開始可能日'], licenses: ['保有資格', '資格', '免許・資格'],
  experience_years: ['経験年数', '介護経験年数'], experience_note: ['職務経歴', '経験内容', '経歴'], priorities: ['優先順位', '重視する条件'],
  is_foreign_national: ['外国籍'], visa_status: ['在留資格'], residence_expiry: ['在留期限'], jlpt_level: ['日本語能力', 'JLPT'],
  care_japanese_test: ['介護日本語評価試験'], skill_test: ['技能試験'], notes: ['備考', 'その他'],
};
const LABEL_INDEX = new Map(Object.entries(LABELS).flatMap(([f, ls]) => ls.map(l => [l.replace(/\s/g, ''), f])));
const WAGE_TYPE_WORDS = { 月給: 'monthly', 時給: 'hourly', 日給: 'daily', 年俸: 'annual' };

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
  }
  return String(v);
}

// 自社テンプレート（A列=項目、B列=記入欄、C列=記入例）は列位置で読む。それ以外は空セルを詰めて読む
async function xlsxToRows(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const rows = [];
  wb.eachSheet(ws => {
    const header = [1, 2].map(i => cellText(ws.getRow(1).getCell(i).value).trim());
    const isTemplate = header[0] === '項目' && header[1] === '記入欄';
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (isTemplate) {
        if (n === 1) return;
        const label = cellText(row.getCell(1).value).trim();
        const value = cellText(row.getCell(2).value).trim();
        if (label && value) rows.push([label, value]);
        return;
      }
      const cells = [];
      row.eachCell({ includeEmpty: false }, c => { const t = cellText(c.value).trim(); if (t) cells.push(t); });
      if (cells.length) rows.push(cells);
    });
  });
  return rows;
}

async function docxToText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw Object.assign(new Error('Wordファイルを読み取れません'), { status: 400 });
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function pdfToText(buf) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text || '').trim();
}

// 「項目名：値」「項目名<TAB>値」の行をテンプレート項目に対応付ける
function parseLabeled(rows) {
  const data = {};
  for (const cells of rows) {
    let label, value;
    if (cells.length >= 2) { [label, value] = [cells[0], cells[1]]; }
    else {
      const m = String(cells[0]).match(/^(.{1,20}?)[：:\t]\s*(.+)$/);
      if (!m) continue;
      [label, value] = [m[1], m[2]];
    }
    const f = LABEL_INDEX.get(String(label).replace(/[\s*＊※]/g, ''));
    if (f && value && !/^例[：:]/.test(value) && !(f in data)) data[f] = String(value).trim();
  }
  if (data.desired_wage_type) data.desired_wage_type = WAGE_TYPE_WORDS[data.desired_wage_type] || data.desired_wage_type;
  for (const b of ['shift_ok', 'night_only', 'is_foreign_national', 'care_japanese_test']) {
    if (b in data) data[b] = /^(可|はい|あり|有|○|〇|yes|合格)/i.test(data[b]) ? 1 : 0;
  }
  return data;
}

// 電話・メールはローカルで読み取り（AIには送らない）
function localIdentity(text) {
  const phone = text.match(/(?<!\d)0\d{1,4}[-(]?\d{1,4}[-)]?\d{3,4}(?!\d)/)?.[0];
  const email = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0];
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
}

const AI_SYSTEM = `職業紹介の「求職者の条件表」から、希望条件を抽出してください。
- 書かれていることだけを抽出し、不明な項目は null。推測で埋めない。曖昧な点は uncertain_points に書く。
- 複数値はカンマ区切り。施設種別は次から選ぶ：${FACILITY_TYPES.join('/')}。職務は次から選ぶ：${JOB_KINDS.join('/')}。
- 賃金は円単位の整数（「22万」→220000）。時刻は HH:MM。日付は YYYY-MM-DD。
- 本籍・出生地・宗教・思想信条・支持政党・労働組合・家族の職業など、職業紹介で収集してはならない情報は抽出しない。
- ［氏名］［電話］等は伏字です。復元しようとしないこと。`;

/**
 * @returns {{ method: 'template'|'ai', data: object, uncertain: string[], textChars: number }}
 */
async function readConditionSheet(buf, filename, mimetype, { knownNames = [], allowAi = false, seekerId = null } = {}) {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  let rows = null, text = '';
  if (ext === 'xlsx' || mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    rows = await xlsxToRows(buf);
    text = rows.map(r => r.join('\t')).join('\n');
  } else if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = await docxToText(buf);
    rows = text.split('\n').map(l => l.split('\t').map(s => s.trim()).filter(Boolean)).filter(r => r.length);
  } else if (ext === 'pdf' || mimetype === 'application/pdf') {
    text = await pdfToText(buf);
    rows = text.split('\n').map(l => l.split(/\t| {2,}/).map(s => s.trim()).filter(Boolean)).filter(r => r.length);
  } else if (ext === 'xls' || ext === 'doc') {
    throw Object.assign(new Error('古い形式（.xls / .doc）は読み取れません。Excel・Wordで「名前を付けて保存」から .xlsx / .docx に変換してください'), { status: 400 });
  } else {
    throw Object.assign(new Error('Excel（.xlsx）・Word（.docx）・PDF に対応しています'), { status: 400 });
  }
  if (!text.trim()) {
    throw Object.assign(new Error('文字を読み取れませんでした（画像だけのPDFなど）。テキストを含むファイルにするか、内容を手入力してください'), { status: 400 });
  }

  const labeled = parseLabeled(rows);
  const conditionKeys = Object.keys(labeled).filter(k => !['name', 'name_kana', 'phone', 'email', 'address', 'birth_date'].includes(k));
  if (conditionKeys.length >= 5) {
    return { method: 'template', data: labeled, uncertain: [], textChars: text.length };
  }

  // テンプレート以外：AI抽出（同意確認済みの場合のみ）
  const identity = { ...localIdentity(text), ...Object.fromEntries(['name', 'name_kana', 'birth_date', 'address'].filter(k => labeled[k]).map(k => [k, labeled[k]])) };
  if (!allowAi) {
    return { method: 'manual', data: { ...identity, ...labeled }, uncertain: ['自社テンプレート以外の様式のため、AI抽出の同意がない場合は内容を手入力してください'], textChars: text.length, preview: text.slice(0, 3000) };
  }
  const masked = maskText(text, [...knownNames, identity.name, identity.name_kana]);
  const ai = await callStructured({
    purpose: 'sheet_extract', system: AI_SYSTEM, content: masked.slice(0, 30000), schema: MEMO_SCHEMA, seekerId,
    fieldsSent: { sheet: 'masked', chars: masked.length, file_type: ext }, effort: 'low',
  });
  const uncertain = ai.uncertain_points || [];
  delete ai.uncertain_points;
  for (const k of Object.keys(ai)) if (ai[k] === null) delete ai[k];
  for (const b of ['shift_ok', 'night_only']) if (b in ai) ai[b] = ai[b] ? 1 : 0;
  return { method: 'ai', data: { ...identity, ...ai }, uncertain, textChars: text.length };
}

module.exports = { readConditionSheet, parseLabeled, LABELS };
