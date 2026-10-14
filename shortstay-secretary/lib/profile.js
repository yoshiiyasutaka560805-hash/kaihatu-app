// 利用者の送迎プロフィール（歩行状態・注意事項）の共通定義
const GAITS = ['独歩', '歩行', '杖', 'シルバーカー', '歩行器', '手引き', '片手引き'];
const WHEELCHAIR_TYPES = ['', '車椅子', 'リクライニング車椅子'];
// 標準タグ: key=表示名, re=自由記述から自動検出する語
const TAGS = [
  ['道が狭い', /道.{0,2}狭/], ['オートロック', /オートロック/], ['出発前に電話', /出発前.{0,3}電話|電話して|留守電/],
  ['下で待ち合わせ', /下で待|待ち合わせ|下待/], ['LINE連絡可', /ライン|LINE/i], ['要添乗', /添乗/],
  ['台車持参', /台車/], ['キーボックス', /キーボックス/], ['ヘルパー立会', /ヘルパー/], ['独居', /独居/],
];
const TAG_NAMES = TAGS.map((t) => t[0]);
const normTags = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => x.trim()).filter((x) => TAG_NAMES.includes(x));

function parseWheelchair(text) {
  const t = String(text || '');
  if (/リクライニング/.test(t)) return 'リクライニング車椅子';
  if (/車椅子|車いす|車イス/.test(t)) return '車椅子';
  return '';
}
function parseGait(text) {
  const t = String(text || '');
  if (/片手引き/.test(t)) return '片手引き';
  if (/手引き/.test(t)) return '手引き';
  if (/シルバーカー/.test(t)) return 'シルバーカー';
  if (/歩行器/.test(t)) return '歩行器';
  if (/杖/.test(t)) return '杖';
  if (/独歩/.test(t)) return '独歩';
  if (/歩行/.test(t)) return '歩行';
  return '';
}
// 注意事項の自由記述 → タグ・車種指定・キーボックス暗証番号を分離（暗証番号は注意事項本文から除く）
function parseAttention(text) {
  let t = String(text || '');
  let keybox = '';
  t = t.replace(/キーボックス[\s　:：]*([0-9]{3,8})/, (m) => { keybox = m.replace(/\D/g, ''); return 'キーボックス'; });
  const tags = TAGS.filter(([, re]) => re.test(t)).map(([n]) => n);
  const vehicle = /バネット/.test(t) ? 'バネット' : /タント/.test(t) ? 'タント' : '';
  return { attention: t.trim(), tags, vehicle_hint: vehicle, keybox };
}
module.exports = { GAITS, WHEELCHAIR_TYPES, TAGS, TAG_NAMES, normTags, parseWheelchair, parseGait, parseAttention };
