'use strict';

/**
 * questions.js - pure data: the question bank + bilingual category copy + disclaimer copy.
 * No rendering or app-flow logic lives here; see shapes.js and app.js.
 *
 * Shape descriptor: { type, color, fill, size, rotation }
 *   type:     circle | square | diamond | triangle | pentagon | hexagon | star | cross
 *   color:    navy | coral | teal | amber | plum | slate
 *   fill:     solid | outline | striped | dotted
 *   size:     sm | md | lg
 *   rotation: 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315
 *
 * All items below are original combinations over this invented shape/color vocabulary.
 * None reproduce or trace any real published/standardized test (e.g. Raven's Progressive
 * Matrices, Cattell, WAIS-style matrices).
 */

function S(type, color, fill, size, rotation) {
  return { type: type, color: color, fill: fill || 'solid', size: size || 'md', rotation: rotation || 0 };
}
function rep(descriptor, n) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(descriptor);
  return out;
}

var CATEGORIES = {
  matrix: {
    label: { ja: 'マトリクス推論', en: 'Matrix Reasoning' },
    instructions: {
      ja: '3×3の図形パターンを見て、規則性から空欄（?）に当てはまる図形を4つの選択肢から選んでください。',
      en: 'Study the 3x3 grid of shapes, find the pattern, and choose the option that belongs in the blank (?) cell.',
    },
  },
  sequence: {
    label: { ja: '系列完成', en: 'Sequence Completion' },
    instructions: {
      ja: '図形が並ぶ規則性を見つけ、次に続く図形を4つの選択肢から選んでください。',
      en: 'Find the rule behind the sequence of shapes and choose what comes next.',
    },
  },
  oddOneOut: {
    label: { ja: '仲間はずれ探し', en: 'Odd One Out' },
    instructions: {
      ja: '5つの図形のうち、規則から外れているものを1つ選んでください。',
      en: 'Of the 5 shapes shown, choose the one that breaks the shared rule.',
    },
  },
  analogy: {
    label: { ja: '図形類推', en: 'Visual Analogy' },
    instructions: {
      ja: '「AはBに変化する」という関係を見つけ、「CはDに変化する」のDにあたる図形を選んでください。',
      en: 'Find how A changes into B, then choose the option that shows C changing the same way.',
    },
  },
};

var STRINGS = {
  appTitle: { ja: '適性検査（論理思考力）', en: 'Aptitude Screening (Logical Reasoning)' },
  introDisclaimer: {
    ja: '本テストは、採用選考の参考情報を得るための社内スクリーニングツールです。心理測定学的に標準化・妥当性検証された知能検査ではありません。結果画面に表示される「IQ換算値」は一般的な受検者分布を仮定した簡易的な推定値であり、専門機関で実施される標準化された知能検査のIQとは異なります。結果は数ある選考材料の一つとしてご参照いただき、これのみをもって採否を決定しないでください。国籍・言語的背景にかかわらず、すべての候補者に同一の条件・時間・方法で実施してください。結果は候補者の個人情報として厳重に管理し、目的外に利用しないでください。',
    en: 'This tool is an internal screening aid to support hiring decisions. It is not a standardized or professionally normed intelligence test. The "estimated IQ-equivalent" shown on the results screen is a rough conversion based on an assumed test-taker distribution, and differs from an IQ obtained through a professionally administered standardized test. Treat the results as one input among several, never as the sole basis for a hiring decision. Administer this test identically to every candidate, regardless of nationality or language background. Results are confidential personal information and must be stored and used accordingly.',
  },
  resultsDisclaimer: {
    ja: 'この結果は参考情報であり、標準化された知能検査のスコアではありません。IQ換算値も仮定分布に基づく簡易推定値です。単独で採否を判断せず、面接など他の選考要素と併せてご検討ください。',
    en: 'These results are for reference only and are not a standardized intelligence-test score. The estimated IQ-equivalent is a rough estimate based on an assumed distribution. Do not use them alone to make a hiring decision -- combine them with interviews and other selection criteria.',
  },
  iqLabel: {
    ja: 'IQ換算値（簡易推定・参考値）',
    en: 'Estimated IQ-equivalent (approximate, for reference)',
  },
  iqNote: {
    ja: '※ 平均100・標準偏差15のスケールに、想定受検者分布（平均18問正答・標準偏差5問）を仮定して換算した参考値です（表示範囲60〜145）。標準化された知能検査の結果ではありません。',
    en: '* Converted to a mean-100 / SD-15 scale assuming a typical test-taker distribution (mean 18 correct, SD 5); displayed range 60-145. This is not a standardized intelligence-test result.',
  },
  printFooter: {
    ja: '社内選考参考資料（非標準化ツール）／取扱厳重注意',
    en: 'Internal screening reference -- non-standardized tool. Confidential.',
  },
};

// IQ換算（簡易推定）: 想定受検者分布に基づき平均100・標準偏差15のスケールへ変換する。
// 実受検データが蓄積されたら mean / sd を実測値に更新すること（README参照）。
var IQ_SCALE = { mean: 18, sd: 5, min: 60, max: 145 };

function estimateIQ(correctCount) {
  var z = (correctCount - IQ_SCALE.mean) / IQ_SCALE.sd;
  var iq = Math.round(100 + 15 * z);
  return Math.max(IQ_SCALE.min, Math.min(IQ_SCALE.max, iq));
}

var QUESTIONS = [
  // ---------------- Matrix reasoning (3x3 grid, index 8 = blank) ----------------
  {
    id: 'm01', category: 'matrix', difficulty: 'easy',
    grid: [
      [S('circle', 'navy', 'solid', 'sm')], [S('circle', 'navy', 'solid', 'md')], [S('circle', 'navy', 'solid', 'lg')],
      [S('circle', 'navy', 'solid', 'sm')], [S('circle', 'navy', 'solid', 'md')], [S('circle', 'navy', 'solid', 'lg')],
      [S('circle', 'navy', 'solid', 'sm')], [S('circle', 'navy', 'solid', 'md')], null,
    ],
    options: [
      [S('circle', 'navy', 'solid', 'md')],
      [S('circle', 'navy', 'solid', 'lg')],
      [S('circle', 'coral', 'solid', 'lg')],
      [S('circle', 'navy', 'outline', 'lg')],
    ],
    correctIndex: 1,
  },
  {
    id: 'm02', category: 'matrix', difficulty: 'easy',
    grid: [
      [S('square', 'navy', 'solid', 'md')], [S('square', 'coral', 'solid', 'md')], [S('square', 'teal', 'solid', 'md')],
      [S('square', 'navy', 'solid', 'md')], [S('square', 'coral', 'solid', 'md')], [S('square', 'teal', 'solid', 'md')],
      [S('square', 'navy', 'solid', 'md')], [S('square', 'coral', 'solid', 'md')], null,
    ],
    options: [
      [S('square', 'navy', 'solid', 'md')],
      [S('square', 'teal', 'solid', 'md')],
      [S('square', 'amber', 'solid', 'md')],
      [S('square', 'coral', 'solid', 'md')],
    ],
    correctIndex: 1,
  },
  {
    id: 'm03', category: 'matrix', difficulty: 'medium',
    grid: [
      [S('triangle', 'coral', 'solid', 'md', 0)], [S('triangle', 'coral', 'solid', 'md', 90)], [S('triangle', 'coral', 'solid', 'md', 180)],
      [S('triangle', 'coral', 'solid', 'md', 90)], [S('triangle', 'coral', 'solid', 'md', 180)], [S('triangle', 'coral', 'solid', 'md', 270)],
      [S('triangle', 'coral', 'solid', 'md', 180)], [S('triangle', 'coral', 'solid', 'md', 270)], null,
    ],
    options: [
      [S('triangle', 'coral', 'solid', 'md', 270)],
      [S('triangle', 'coral', 'solid', 'md', 0)],
      [S('triangle', 'coral', 'solid', 'md', 90)],
      [S('triangle', 'coral', 'solid', 'md', 180)],
    ],
    correctIndex: 1,
  },
  {
    id: 'm04', category: 'matrix', difficulty: 'medium',
    grid: [
      rep(S('hexagon', 'amber', 'outline', 'sm'), 1), rep(S('hexagon', 'amber', 'outline', 'sm'), 2), rep(S('hexagon', 'amber', 'outline', 'sm'), 3),
      rep(S('hexagon', 'amber', 'outline', 'sm'), 1), rep(S('hexagon', 'amber', 'outline', 'sm'), 2), rep(S('hexagon', 'amber', 'outline', 'sm'), 3),
      rep(S('hexagon', 'amber', 'outline', 'sm'), 1), rep(S('hexagon', 'amber', 'outline', 'sm'), 2), null,
    ],
    options: [
      rep(S('hexagon', 'amber', 'outline', 'sm'), 1),
      rep(S('hexagon', 'amber', 'outline', 'sm'), 2),
      rep(S('hexagon', 'amber', 'outline', 'sm'), 3),
      rep(S('hexagon', 'amber', 'outline', 'sm'), 4),
    ],
    correctIndex: 2,
  },
  {
    id: 'm05', category: 'matrix', difficulty: 'hard',
    grid: [
      [S('diamond', 'navy', 'solid', 'md')], [S('diamond', 'navy', 'outline', 'md')], [S('diamond', 'navy', 'striped', 'md')],
      [S('diamond', 'coral', 'solid', 'md')], [S('diamond', 'coral', 'outline', 'md')], [S('diamond', 'coral', 'striped', 'md')],
      [S('diamond', 'teal', 'solid', 'md')], [S('diamond', 'teal', 'outline', 'md')], null,
    ],
    options: [
      [S('diamond', 'teal', 'outline', 'md')],
      [S('diamond', 'teal', 'striped', 'md')],
      [S('diamond', 'coral', 'striped', 'md')],
      [S('diamond', 'teal', 'solid', 'md')],
    ],
    correctIndex: 1,
  },
  {
    id: 'm06', category: 'matrix', difficulty: 'hard',
    grid: [
      [S('triangle', 'slate', 'solid', 'md', 0)], [S('square', 'slate', 'solid', 'md', 0)], [S('pentagon', 'slate', 'solid', 'md', 0)],
      [S('triangle', 'slate', 'solid', 'md', 45)], [S('square', 'slate', 'solid', 'md', 45)], [S('pentagon', 'slate', 'solid', 'md', 45)],
      [S('triangle', 'slate', 'solid', 'md', 90)], [S('square', 'slate', 'solid', 'md', 90)], null,
    ],
    options: [
      [S('pentagon', 'slate', 'solid', 'md', 45)],
      [S('pentagon', 'slate', 'solid', 'md', 90)],
      [S('hexagon', 'slate', 'solid', 'md', 90)],
      [S('square', 'slate', 'solid', 'md', 90)],
    ],
    correctIndex: 1,
  },
  {
    id: 'm07', category: 'matrix', difficulty: 'medium',
    grid: [
      [S('star', 'plum', 'solid', 'md')], [S('star', 'plum', 'outline', 'md')], [S('star', 'plum', 'solid', 'md')],
      [S('star', 'plum', 'outline', 'md')], [S('star', 'plum', 'solid', 'md')], [S('star', 'plum', 'outline', 'md')],
      [S('star', 'plum', 'solid', 'md')], [S('star', 'plum', 'outline', 'md')], null,
    ],
    options: [
      [S('star', 'plum', 'outline', 'md')],
      [S('star', 'plum', 'solid', 'md')],
      [S('star', 'coral', 'solid', 'md')],
      [S('circle', 'plum', 'solid', 'md')],
    ],
    correctIndex: 1,
  },

  // ---------------- Sequence completion ----------------
  {
    id: 's01', category: 'sequence', difficulty: 'easy',
    sequence: [
      [S('triangle', 'navy', 'solid', 'md', 0)], [S('triangle', 'navy', 'solid', 'md', 45)],
      [S('triangle', 'navy', 'solid', 'md', 90)], [S('triangle', 'navy', 'solid', 'md', 135)],
    ],
    options: [
      [S('triangle', 'navy', 'solid', 'md', 135)],
      [S('triangle', 'navy', 'solid', 'md', 180)],
      [S('triangle', 'navy', 'solid', 'md', 225)],
      [S('triangle', 'navy', 'solid', 'md', 90)],
    ],
    correctIndex: 1,
  },
  {
    id: 's02', category: 'sequence', difficulty: 'easy',
    sequence: [
      rep(S('circle', 'coral', 'solid', 'sm'), 1), rep(S('circle', 'coral', 'solid', 'sm'), 2),
      rep(S('circle', 'coral', 'solid', 'sm'), 3), rep(S('circle', 'coral', 'solid', 'sm'), 4),
    ],
    options: [
      rep(S('circle', 'coral', 'solid', 'sm'), 3),
      rep(S('circle', 'coral', 'solid', 'sm'), 4),
      rep(S('circle', 'coral', 'solid', 'sm'), 5),
      rep(S('circle', 'coral', 'solid', 'sm'), 6),
    ],
    correctIndex: 2,
  },
  {
    id: 's03', category: 'sequence', difficulty: 'medium',
    sequence: [
      [S('triangle', 'teal', 'solid', 'sm')], [S('triangle', 'teal', 'solid', 'md')],
      [S('triangle', 'teal', 'solid', 'lg')], [S('triangle', 'teal', 'solid', 'sm')],
    ],
    options: [
      [S('triangle', 'teal', 'solid', 'sm')],
      [S('triangle', 'teal', 'solid', 'md')],
      [S('triangle', 'teal', 'solid', 'lg')],
      [S('triangle', 'navy', 'solid', 'md')],
    ],
    correctIndex: 1,
  },
  {
    id: 's04', category: 'sequence', difficulty: 'medium',
    sequence: [
      [S('square', 'navy', 'outline', 'md')], [S('square', 'coral', 'outline', 'md')],
      [S('square', 'teal', 'outline', 'md')], [S('square', 'navy', 'outline', 'md')],
    ],
    options: [
      [S('square', 'navy', 'outline', 'md')],
      [S('square', 'coral', 'outline', 'md')],
      [S('square', 'teal', 'outline', 'md')],
      [S('square', 'amber', 'outline', 'md')],
    ],
    correctIndex: 1,
  },
  {
    id: 's05', category: 'sequence', difficulty: 'hard',
    sequence: [
      [S('triangle', 'amber', 'solid', 'md')], [S('square', 'amber', 'solid', 'md')],
      [S('pentagon', 'amber', 'solid', 'md')], [S('hexagon', 'amber', 'solid', 'md')],
    ],
    options: [
      [S('hexagon', 'amber', 'solid', 'md')],
      [S('star', 'amber', 'solid', 'md')],
      [S('circle', 'amber', 'solid', 'md')],
      [S('pentagon', 'amber', 'solid', 'md')],
    ],
    correctIndex: 2,
  },
  {
    id: 's06', category: 'sequence', difficulty: 'hard',
    sequence: [
      [S('diamond', 'navy', 'solid', 'md')], [S('diamond', 'navy', 'striped', 'md')],
      [S('diamond', 'navy', 'dotted', 'md')], [S('diamond', 'navy', 'outline', 'md')],
    ],
    options: [
      [S('diamond', 'navy', 'outline', 'md')],
      [S('diamond', 'navy', 'striped', 'md')],
      [S('diamond', 'navy', 'solid', 'md')],
      [S('diamond', 'navy', 'dotted', 'md')],
    ],
    correctIndex: 2,
  },
  {
    id: 's07', category: 'sequence', difficulty: 'medium',
    sequence: [
      rep(S('cross', 'plum', 'solid', 'md'), 1), rep(S('cross', 'plum', 'solid', 'md'), 3),
      rep(S('cross', 'plum', 'solid', 'md'), 1), rep(S('cross', 'plum', 'solid', 'md'), 3),
    ],
    options: [
      rep(S('cross', 'plum', 'solid', 'md'), 3),
      rep(S('cross', 'plum', 'solid', 'md'), 1),
      rep(S('cross', 'plum', 'solid', 'md'), 2),
      rep(S('cross', 'plum', 'solid', 'md'), 4),
    ],
    correctIndex: 1,
  },

  // ---------------- Odd one out (5 items; items[] doubles as the choices) ----------------
  {
    id: 'o01', category: 'oddOneOut', difficulty: 'easy',
    items: [
      [S('circle', 'navy', 'solid', 'sm')], [S('circle', 'navy', 'solid', 'sm')],
      [S('square', 'navy', 'solid', 'sm')], [S('circle', 'navy', 'solid', 'sm')], [S('circle', 'navy', 'solid', 'sm')],
    ],
    correctIndex: 2,
  },
  {
    id: 'o02', category: 'oddOneOut', difficulty: 'easy',
    items: [
      [S('triangle', 'coral', 'solid', 'md')], [S('triangle', 'coral', 'solid', 'md')],
      [S('triangle', 'teal', 'solid', 'md')], [S('triangle', 'coral', 'solid', 'md')], [S('triangle', 'coral', 'solid', 'md')],
    ],
    correctIndex: 2,
  },
  {
    id: 'o03', category: 'oddOneOut', difficulty: 'medium',
    items: [
      [S('hexagon', 'amber', 'outline', 'md')], [S('hexagon', 'amber', 'outline', 'md')],
      [S('hexagon', 'amber', 'solid', 'md')], [S('hexagon', 'amber', 'outline', 'md')], [S('hexagon', 'amber', 'outline', 'md')],
    ],
    correctIndex: 2,
  },
  {
    id: 'o04', category: 'oddOneOut', difficulty: 'medium',
    items: [
      [S('triangle', 'slate', 'solid', 'md', 0)], [S('triangle', 'slate', 'solid', 'md', 0)],
      [S('triangle', 'slate', 'solid', 'md', 180)], [S('triangle', 'slate', 'solid', 'md', 0)], [S('triangle', 'slate', 'solid', 'md', 0)],
    ],
    correctIndex: 2,
  },
  {
    id: 'o05', category: 'oddOneOut', difficulty: 'hard',
    items: [
      rep(S('circle', 'navy', 'solid', 'sm'), 2), rep(S('circle', 'navy', 'solid', 'sm'), 2),
      rep(S('circle', 'navy', 'solid', 'sm'), 3), rep(S('circle', 'navy', 'solid', 'sm'), 2), rep(S('circle', 'navy', 'solid', 'sm'), 2),
    ],
    correctIndex: 2,
  },
  {
    id: 'o06', category: 'oddOneOut', difficulty: 'hard',
    items: [
      [S('pentagon', 'amber', 'outline', 'md', 0)], [S('pentagon', 'amber', 'outline', 'md', 45)],
      [S('pentagon', 'amber', 'solid', 'md', 90)], [S('pentagon', 'amber', 'outline', 'md', 135)], [S('pentagon', 'amber', 'outline', 'md', 180)],
    ],
    correctIndex: 2,
  },
  {
    id: 'o07', category: 'oddOneOut', difficulty: 'medium',
    items: [
      [S('circle', 'navy', 'solid', 'md'), S('circle', 'navy', 'solid', 'md')],
      [S('circle', 'navy', 'solid', 'md'), S('circle', 'navy', 'solid', 'md')],
      [S('circle', 'navy', 'solid', 'md'), S('square', 'navy', 'solid', 'md')],
      [S('circle', 'navy', 'solid', 'md'), S('circle', 'navy', 'solid', 'md')],
      [S('circle', 'navy', 'solid', 'md'), S('circle', 'navy', 'solid', 'md')],
    ],
    correctIndex: 2,
  },

  // ---------------- Visual analogy (A:B :: C:?) ----------------
  {
    id: 'an01', category: 'analogy', difficulty: 'easy',
    analogy: { a: [S('circle', 'navy', 'solid', 'md')], b: [S('circle', 'coral', 'solid', 'md')], c: [S('square', 'navy', 'solid', 'md')] },
    options: [
      [S('square', 'navy', 'solid', 'md')],
      [S('square', 'coral', 'solid', 'md')],
      [S('square', 'teal', 'solid', 'md')],
      [S('circle', 'coral', 'solid', 'md')],
    ],
    correctIndex: 1,
  },
  {
    id: 'an02', category: 'analogy', difficulty: 'easy',
    analogy: { a: [S('hexagon', 'teal', 'solid', 'sm')], b: [S('hexagon', 'teal', 'solid', 'lg')], c: [S('circle', 'amber', 'solid', 'sm')] },
    options: [
      [S('circle', 'amber', 'solid', 'sm')],
      [S('circle', 'amber', 'solid', 'lg')],
      [S('circle', 'amber', 'solid', 'md')],
      [S('hexagon', 'amber', 'solid', 'lg')],
    ],
    correctIndex: 1,
  },
  {
    id: 'an03', category: 'analogy', difficulty: 'medium',
    analogy: { a: [S('triangle', 'amber', 'solid', 'md', 0)], b: [S('triangle', 'amber', 'solid', 'md', 90)], c: [S('triangle', 'amber', 'solid', 'md', 180)] },
    options: [
      [S('triangle', 'amber', 'solid', 'md', 180)],
      [S('triangle', 'amber', 'solid', 'md', 270)],
      [S('triangle', 'amber', 'solid', 'md', 0)],
      [S('triangle', 'amber', 'solid', 'md', 315)],
    ],
    correctIndex: 1,
  },
  {
    id: 'an04', category: 'analogy', difficulty: 'medium',
    analogy: { a: [S('star', 'coral', 'solid', 'md')], b: [S('star', 'coral', 'outline', 'md')], c: [S('square', 'teal', 'solid', 'md')] },
    options: [
      [S('square', 'teal', 'solid', 'md')],
      [S('square', 'teal', 'outline', 'md')],
      [S('square', 'navy', 'outline', 'md')],
      [S('star', 'teal', 'outline', 'md')],
    ],
    correctIndex: 1,
  },
  {
    id: 'an05', category: 'analogy', difficulty: 'hard',
    analogy: { a: rep(S('circle', 'navy', 'solid', 'sm'), 2), b: rep(S('circle', 'navy', 'solid', 'sm'), 3), c: rep(S('hexagon', 'plum', 'solid', 'sm'), 3) },
    options: [
      rep(S('hexagon', 'plum', 'solid', 'sm'), 3),
      rep(S('hexagon', 'plum', 'solid', 'sm'), 4),
      rep(S('hexagon', 'plum', 'solid', 'sm'), 2),
      rep(S('circle', 'plum', 'solid', 'sm'), 4),
    ],
    correctIndex: 1,
  },
  {
    id: 'an06', category: 'analogy', difficulty: 'hard',
    analogy: { a: [S('square', 'navy', 'solid', 'md', 0)], b: [S('square', 'coral', 'solid', 'md', 90)], c: [S('square', 'navy', 'solid', 'md', 180)] },
    options: [
      [S('square', 'coral', 'solid', 'md', 180)],
      [S('square', 'coral', 'solid', 'md', 270)],
      [S('square', 'navy', 'solid', 'md', 270)],
      [S('square', 'teal', 'solid', 'md', 270)],
    ],
    correctIndex: 1,
  },
  {
    id: 'an07', category: 'analogy', difficulty: 'medium',
    analogy: { a: [S('triangle', 'navy', 'solid', 'md')], b: [S('square', 'navy', 'solid', 'md')], c: [S('pentagon', 'amber', 'solid', 'md')] },
    options: [
      [S('pentagon', 'amber', 'solid', 'md')],
      [S('hexagon', 'amber', 'solid', 'md')],
      [S('star', 'amber', 'solid', 'md')],
      [S('hexagon', 'navy', 'solid', 'md')],
    ],
    correctIndex: 1,
  },
];
