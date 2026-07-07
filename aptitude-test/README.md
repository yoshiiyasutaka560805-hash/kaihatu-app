# 適性検査（論理思考力） / Aptitude Screening (Logical Reasoning)

このディレクトリは、採用選考の参考情報を得るためのツールです。kaihatu-appのバックエンド（Express + SQLite）から配信され、受検結果は既存のデータベース（`data/kaihatu.db`）に保存されます。

This directory contains a tool to support hiring decisions. It is served by the kaihatu-app backend (Express + SQLite), and test results are saved to the existing database (`data/kaihatu.db`).

## 1. これは何か／何でないか　What this is / is not

- 図形パターンを使った**非言語的な論理思考力**を測る社内スクリーニングツールです。国籍や言語による有利・不利をできるだけ減らすため、設問は図形・色・回転・個数などの視覚的な要素のみで構成されています。
- **標準化・妥当性検証された心理測定学的な知能検査ではありません。** 「IQスコア」のような較正済みの指数は算出しません。結果画面には素点・正答率・カテゴリ別の内訳のみを表示します。
- 結果は採用選考における**参考情報の一つ**として扱ってください。この結果のみで採否を決定しないでください。面接など他の選考要素と必ず併せて判断してください。

- This is an internal screening tool that measures **non-verbal logical reasoning** using visual shape patterns, designed to minimize any advantage or disadvantage based on nationality or language.
- **It is not a standardized, professionally validated intelligence test.** It does not produce a calibrated "IQ score." The results screen shows only a raw score, percentage, and category breakdown.
- Treat the results as **one input among several** in a hiring decision. Never use this result alone to decide whether to hire someone -- always combine it with interviews and other selection criteria.

## 2. 起動方法　How to run it

### 通常の使い方（結果がデータベースに保存されます）　Normal use (results are saved to the database)

1. リポジトリ直下の `start.bat` を実行するか、バックエンドのみ起動します:
   ```
   cd backend
   npm install   # 初回のみ
   npm run dev   # または npm start
   ```
2. ブラウザで **http://localhost:3001/aptitude-test/** を開くと受検画面が表示されます。
3. 受検が完了すると、結果は自動的に `data/kaihatu.db` の `aptitude_results` テーブルに保存され、結果画面に「結果を保存しました / Result saved」と表示されます。
4. 保存された結果は **http://localhost:3001/aptitude-test/admin.html** （管理ページ）で一覧・詳細の閲覧、印刷、削除ができます。

1. Run `start.bat` at the repo root, or start just the backend: `cd backend && npm install` (first time only) then `npm run dev` (or `npm start`).
2. Open **http://localhost:3001/aptitude-test/** in a browser to show the candidate test screen.
3. When a candidate finishes, the result is saved automatically to the `aptitude_results` table in `data/kaihatu.db`, and the results screen shows "結果を保存しました / Result saved".
4. Saved results can be listed, viewed in detail, printed, and deleted at **http://localhost:3001/aptitude-test/admin.html** (admin page).

**管理ページ（admin.html）のURLは候補者に見せない・操作させないでください。** 受検用端末では受検画面（`/aptitude-test/`）のみを開いた状態で渡してください。

**Never show or hand the admin page (admin.html) URL to candidates.** On the test device, open only the candidate screen (`/aptitude-test/`) before handing it over.

保存された結果データは、kaihatu-appの既存の自動バックアップ機能（`backend/services/backup.js` による `data/backups/` へのDBバックアップ）の対象に含まれます。

Saved results are covered by kaihatu-app's existing automatic backup (`backend/services/backup.js`, which backs up the DB into `data/backups/`).

### オフラインモード（保存されません）　Offline mode (results are NOT saved)

`aptitude-test/index.html` をダブルクリックして直接開くことも可能です。この場合もテストは最後まで動作しますが、**結果はサーバーに保存されません**（結果画面にその旨が表示されます）。印刷での保存のみになります。

You can also double-click `aptitude-test/index.html` to open it directly. The test still works end to end, but **results are not saved to the server** (the results screen says so). Printing is then the only way to keep a record.

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

## 5. セキュリティ上の制限　Security limitations

受検画面はブラウザ上で動作するため、正解データは `questions.js` としてブラウザにそのまま読み込まれます。技術的な知識のある候補者であれば、ブラウザの開発者ツールで正解を閲覧できてしまう可能性があります。また、結果保存API・管理ページには認証がなく、ローカルネットワーク内での社内利用を前提としています。

- **必ず対面で、社内管理端末を使い、監督者のもとで実施してください。**
- 候補者にこのツール一式を配布したり、持ち帰り・オンラインでの無監督実施をさせたりしないでください。
- このバックエンドをインターネット上に公開しないでください（正解データと候補者の個人情報の両方が露出します）。

Because the candidate screen runs in the browser, the answer key in `questions.js` is loaded directly into the browser, and a technically sophisticated candidate could view it via developer tools. The results API and admin page have no authentication and are intended for internal, local-network use only.

- **Always administer this test in person, on a company-controlled device, under supervision.**
- Do not distribute the tool's files to candidates, or allow unsupervised/take-home/online use.
- Do not expose this backend to the public internet (it would expose both the answer key and candidates' personal data).

## 6. カスタマイズ・拡張　Customizing and extending

- 設問はすべて `questions.js` 内のデータ（図形記述子＋正解インデックス）として定義されています。描画ロジック（`shapes.js`）や画面遷移ロジック（`app.js`）を変更せずに、設問の追加・編集が可能です。
- カテゴリ見出しや注意書きの文言（日本語・英語）も `questions.js` にまとめてあります。

- All questions are defined as data (shape descriptors + correct-answer index) in `questions.js`. You can add or edit questions without touching the rendering logic (`shapes.js`) or the screen-flow logic (`app.js`).
- Category headings and disclaimer copy (Japanese/English) are also centralized in `questions.js`.

## ファイル構成　File layout

```
aptitude-test/
├── index.html      # 受検画面のシェル（開始／設問／レビュー／結果）
├── admin.html      # 管理ページのシェル（結果一覧・詳細）※候補者に見せない
├── style.css       # スタイル＋印刷用スタイル
├── shapes.js       # 図形記述子 → SVG描画エンジン
├── questions.js    # 設問データ＋バイリンガル文言
├── app.js          # 受検画面の遷移・採点・結果保存ロジック
├── admin.js        # 管理ページのロジック（一覧・詳細・削除・印刷）
└── README.md       # このファイル
```

関連するバックエンド側のファイル / Related backend files:

- `backend/routes/aptitudeResults.js` — 結果の保存・一覧・詳細・削除API
- `backend/database/schema.sql` — `aptitude_results` テーブル定義
- `backend/server.js` — このディレクトリの静的配信とAPIのマウント
