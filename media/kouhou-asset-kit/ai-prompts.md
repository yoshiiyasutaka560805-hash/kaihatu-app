# AI素材づくりのプロンプト集（介護事業所の広報・採用向け）

このキットで**すでに用意できているもの**（BGM・効果音・背景ループ・カード）は、
再生成の必要がありません。ここに載せるのは、外部のAIツールで作る分だけです。

---

## はじめに — 人物の扱いだけは先に決めておく

**AIで生成した「職員」「利用者」を、自法人の人として採用広報に使うのは避けてください。**

- 求人・採用の広告で、実在しない職場の様子を実写風に見せると、応募者の誤認を招きます。
- 介護は「どんな人と働くか」が決め手になる分野です。作り物の笑顔は、見る人に伝わります。
- 実在の利用者が写る素材は、本人・ご家族の同意が前提です（AIかどうか以前の問題）。

**現実的な線引き**

| 用途 | 方法 |
|---|---|
| 職員・利用者・実際の現場 | **実写**（スマホで十分） |
| 光・空間・季節・小物などの繋ぎ | AI生成でよい（人物を写さない） |
| タイトル・エンド・背景 | このキットで生成済み |
| 図解・バナー・募集要項 | Canva などのデザインAI |
| BGM・効果音 | このキット、または Suno（有料プラン） |

AI生成素材を使ったときは、投稿文かキャプションに「一部イメージ映像を使用」と入れておくと安全です。

---

## 1. 映像を生成する（Veo / Kling / Runway / Pika）

**共通の設定**: アスペクト比 `9:16`、長さ `5秒`、`30fps`（またはツールの最大）。
生成した5秒を、このキットの `build.sh reel` のスロットにそのまま入れられます。

### 使いやすい8本

英語のほうが指示が通りやすいツールが多いので、英日を併記します。

**① 朝の光が差す廊下**
```
A quiet care-home corridor in early morning light, warm sunlight falling
across a wooden handrail, soft dust motes floating, slow gentle dolly forward,
no people, shallow depth of field, warm natural color, 9:16 vertical
```
> 静かな介護施設の廊下、朝の光が木の手すりに差し込む、ゆっくり前進、人物なし

**② 窓辺の観葉植物**
```
Close-up of a potted plant on a sunlit windowsill, leaves gently moving in a
breeze, soft bokeh background, calm warm light, slow push-in, no people, 9:16
```

**③ 湯呑みから立つ湯気**
```
Macro shot of steam rising from a ceramic tea cup on a wooden table,
soft window light from the side, slow motion, cozy and calm, no people, 9:16
```

**④ 施設の窓から見える空**
```
Looking out a large window at a bright morning sky with slow drifting clouds,
white curtain moving gently, interior in soft silhouette, no people, 9:16
```

**⑤ 季節の差し込み（春）**
```
Cherry blossom petals falling slowly against soft blue sky, gentle breeze,
shallow focus, bright and hopeful mood, no people, 9:16 vertical
```
> 秋なら `cherry blossom petals` を `autumn leaves` に、冬なら `soft falling snow` に。

**⑥ 記録用紙とペン（手元だけ）**
```
Overhead close-up of hands writing on a paper form with a ballpoint pen on a
desk, warm desk lamp light, only hands visible, no face, calm steady pace, 9:16
```
> 手だけなら実在の職員と誤認されにくく、使いやすい。

**⑦ 廊下を歩く足元**
```
Low angle shot of feet in soft indoor shoes walking slowly along a clean
corridor floor, warm light, only feet and floor visible, no faces, 9:16
```

**⑧ 抽象の光（繋ぎ・タイトル下地）**
```
Abstract soft golden light particles drifting slowly on a deep navy blue
background, smooth gentle motion, calm and warm, no objects, 9:16 vertical
```

### 避けるプロンプト

```
✗ smiling caregiver helping an elderly resident
✗ nursing home staff portrait, friendly Japanese care worker
✗ happy elderly people at a day service center
```
実在しない職員・利用者を作ることになります。この画は実写で撮ってください。

### 生成でうまくいかないときの調整

- 人が入ってしまう → プロンプト末尾に `no people, no humans, empty room` を足す
- 動きが速すぎる → `very slow motion, subtle movement, static camera` を足す
- 色が派手 → `muted natural colors, soft daylight` を足す
- 5秒が短い → 2本生成して `build.sh` のスロット2つに分けて使う

---

## 2. 写真を動かす（image-to-video）— 一番おすすめ

**実際に撮った写真をAIで少し動かす**方法。実写なので誤認の問題がなく、
静止画しかない場合でも動画にできます。Kling・Runway・Luma などが対応しています。

```
Add subtle natural motion: gentle camera push-in, soft light shift,
keep everything else still and photorealistic. Do not change faces or add people.
```
> ゆっくり寄る／光がわずかに動く程度に留める。顔は変えない、人を足さない。

写真が横位置でも、このキットの `build.sh reel` に渡せば背景をぼかして縦に収めます。

---

## 3. 静止画・バナーを作る（Canva）

Canva はこのセッションに接続済みなので、**私が直接作って共有リンクを返せます**。
以下をそのまま伝えてもらえれば作ります。

- **募集要項バナー** — 職種 / 勤務時間 / 給与 / 応募先。1080×1350（フィード用）
- **数字で見る職場** — 平均勤続年数、有給取得率、未経験入職の割合など（実数値をください）
- **Q&Aカード** — 「未経験でも大丈夫？」など、4〜6枚のカルーセル
- **1日の流れ** — タイムライン図。見学前の説明にも使える

Canva内の画像生成AIを使う場合も、人物は避けて背景・アイコン・イラストに留めるのが安全です。

---

## 4. BGMをAIで作る（Suno）

このキットの3曲で足りるはずですが、別の雰囲気が欲しいときは。
**必ずPro以上の有料プランで**（無料プランの曲は商用利用不可）。

```
warm uplifting corporate background music, soft piano and marimba, light
percussion, hopeful and gentle, instrumental, no vocals, 100 BPM, 15 seconds
```
> やわらかいピアノとマリンバ、前向きで穏やか、インスト、ボーカルなし

用途別の差し替え語:
- 施設紹介 → `calm ambient piano, warm strings, slow and reassuring, 84 BPM`
- 採用・募集 → `bright optimistic acoustic, claps, forward-moving, 108 BPM`
- 研修・真面目な内容 → `minimal clean piano, sparse, focused, 92 BPM`

生成後は**必ず全部聴いて**、既存曲に似ていないか確認してください。

---

## 5. 投稿文もAIに書かせる

素材が揃ったら、投稿文はこう頼んでもらえれば書きます。

```
【投稿文】
動画の内容：（例）新人職員の1日
狙い：採用応募につなげたい / 施設を知ってもらいたい
入れたい情報：（例）見学随時受付、未経験可
ハッシュタグ：必要 / 不要
```

1行目に検索されたい言葉（地域名＋介護求人 など）を置く構成で書きます。
