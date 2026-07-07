# 適性検査（論理思考力） / Aptitude Screening (Logical Reasoning)

このディレクトリは、採用選考の参考情報を得るための独立したスタンドアロンツールです。`kaihatu-app`（介護保険加算・法令遵守を管理するツール）とは完全に独立しており、依存関係はありません。

This directory contains a standalone tool to support hiring decisions. It is fully independent from `kaihatu-app` (the nursing-care subsidy/compliance tool) and shares no dependencies with it.

## 1. これは何か／何でないか　What this is / is not

- 図形パターンを使った**非言語的な論理思考力**を測る社内スクリーニングツールです。国籍や言語による有利・不利をできるだけ減らすため、設問は図形・色・回転・個数などの視覚的な要素のみで構成されています。
- **標準化・妥当性検証された心理測定学的な知能検査ではありません。** 「IQスコア」のような較正済みの指数は算出しません。結果画面には素点・正答率・カテゴリ別の内訳のみを表示します。
- 結果は採用選考における**参考情報の一つ**として扱ってください。この結果のみで採否を決定しないでください。面接など他の選考要素と必ず併せて判断してください。

- This is an internal screening tool that measures **non-verbal logical reasoning** using visual shape patterns, designed to minimize any advantage or disadvantage based on nationality or language.
- **It is not a standardized, professionally validated intelligence test.** It does not produce a calibrated "IQ score." The results screen shows only a raw score, percentage, and category breakdown.
- Treat the results as **one input among several** in a hiring decision. Never use this result alone to decide whether to hire someone -- always combine it with interviews and other selection criteria.

## 2. 起動方法　How to run it

ビルドや依存パッケージのインストールは不要です。

No build step or dependency installation is required.

1. `aptitude-test/index.html` をダブルクリックしてブラウザで開いてください。
2. ブラウザのセキュリティ設定等で `file://` からの起動がブロックされる場合は、簡易サーバーを使ってください（例）:
   ```
   cd aptitude-test
   npx serve .
   ```
   または `python -m http.server` などでも構いません。表示されたURL（例: `http://localhost:3000`）をブラウザで開いてください。

1. Double-click `aptitude-test/index.html` to open it in a browser.
2. If your browser blocks `file://` access for any reason, serve it with a trivial static server instead, e.g. `npx serve .` from inside `aptitude-test/`, or `python -m http.server`, then open the printed URL.

## 3. 公平な運用　Fair, consistent administration

- **国籍・言語的背景に関わらず、すべての候補者に同一の手順・同一の制限時間・同一の環境で実施してください。** 日本の「公正な採用選考」の考え方に沿い、このツールを外国人応募者限定のものとして案内しないでください。すべての応募者に対する一般的な事前選考ツールとして扱ってください。
- 開始画面の説明・カテゴリ別サンプル例題は日本語・英語を併記していますが、内容自体は図形ベースのため言語依存を最小限に抑えています。

- **Administer this test identically to every candidate** -- same instructions, same time limit, same environment -- regardless of nationality or language background. In line with Japan's fair-recruitment guidance, do not present or market this tool as being specifically for foreign applicants; it is a general pre-employment screening tool for all candidates.
- The start screen's instructions and category examples are bilingual (Japanese/English), but the actual reasoning items are shape-based to keep language dependency to a minimum.

## 4. 機密保持・利用制限　Confidentiality and limited use

- 結果（氏名・スコア等）は候補者本人の個人情報です。採用選考の目的以外に使用せず、厳重に管理してください。
- 印刷した結果用紙は、他の選考書類と同様に安全に保管し、不要になれば適切に廃棄してください。

- Results (name, score, etc.) are the candidate's personal data. Use them only for the stated hiring purpose and keep them securely.
- Store printed result sheets as securely as other hiring documents, and dispose of them appropriately when no longer needed.

## 5. クライアントサイドのみであることによる制限　Client-side security limitation

このツールはサーバーやデータベースを持たない静的なHTML/CSS/JSのみで構成されています。そのため、正解データは `questions.js` にブラウザ上でそのまま読み込まれており、技術的な知識のある候補者であればブラウザの開発者ツールで正解を閲覧できてしまう可能性があります。

- **必ず対面で、社内管理端末を使い、監督者のもとで実施してください。**
- 候補者にこのツール一式を配布したり、持ち帰り・オンラインでの無監督実施をさせたりしないでください。
- このディレクトリを公開Webサーバーに置かないでください。

This is an intentional, accepted limitation of a backend-free static tool (no backend was requested for this use case) -- it is not something this tool attempts to engineer around.

This tool is entirely static HTML/CSS/JS with no server or database. Because of that, the answer key in `questions.js` is loaded directly into the browser, and a technically sophisticated candidate could view it via browser developer tools.

- **Always administer this test in person, on a company-controlled device, under supervision.**
- Do not distribute the tool's files to candidates, or allow unsupervised/take-home/online use.
- Do not publish this directory on a public web server.

## 6. カスタマイズ・拡張　Customizing and extending

- 設問はすべて `questions.js` 内のデータ（図形記述子＋正解インデックス）として定義されています。描画ロジック（`shapes.js`）や画面遷移ロジック（`app.js`）を変更せずに、設問の追加・編集が可能です。
- カテゴリ見出しや注意書きの文言（日本語・英語）も `questions.js` にまとめてあります。

- All questions are defined as data (shape descriptors + correct-answer index) in `questions.js`. You can add or edit questions without touching the rendering logic (`shapes.js`) or the screen-flow logic (`app.js`).
- Category headings and disclaimer copy (Japanese/English) are also centralized in `questions.js`.

## ファイル構成　File layout

```
aptitude-test/
├── index.html      # 画面のシェル（開始／設問／レビュー／結果）
├── style.css       # スタイル＋印刷用スタイル
├── shapes.js       # 図形記述子 → SVG描画エンジン
├── questions.js    # 設問データ＋バイリンガル文言
├── app.js          # 画面遷移・採点ロジック
└── README.md       # このファイル
```
