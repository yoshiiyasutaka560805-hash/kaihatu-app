# 求職者マッチング（株式会社Lienet 有料職業紹介 業務用）— 開発メモ

次回以降の開発で前提とする事項。ユーザー：吉井靖貴（株式会社Lienet 代表／職業紹介責任者。社会福祉法人新生福祉会 特養施設長も兼務）。

## 回答スタイル
- 構成は「結論／理由／具体的手順／注意点（リスク・例外）」。前置きなし・要点のみ。
- 法令・監査対応を最優先。不確実な点は「要確認」と明示し断定しない。

## 目的と前提
- 求職者の条件表（Excel/Word/PDF）や初回面接ヒアリングを取り込み、HW・一般求人サイトの求人に対して「案内可否」と「マッチ度」（4段階：案内不可／要確認／案内可（マッチ度高）／案内可）を判定する、吉井様本人が操作するツール。
- **ローカルPC専用**（127.0.0.1:3101）。スマホ・外部公開なし。求職者の半数以上が外国籍（受付フォーム8言語）。
- 求職者の個人情報は新生福祉会のDB・システムと混在させない（別法人）。

## 事業者情報（許可書類・契約書で確認済み）
- 正式名称：株式会社Lienet（リアネット）／許可番号：13-ユ-318908
- 取扱職種の範囲：国内・全職種（2025-09版「業務の運営に関する規程」様式第1号。2025-08版の「介護職・看護職限定」は旧版）
- 苦情処理・開示請求の担当：職業紹介責任者 吉井 靖貴／yoshii@lie-net.com／090-8516-3481
- 個人情報の保存：紹介終了後2年（`retention_years` 既定2）。求職者から手数料は取らない。
- 要確認：所在地（規程・事業報告は足立区舎人、2026-09契約書は港区北青山）→ 変更届の有無。

## 構成
- backend：Node 22 / Express / better-sqlite3（WAL）。マイグレーションは `database/db.js` の MIGRATIONS（PRAGMA user_version、現在 v4）。設定は `database/defaults.js` → app_settings（INSERT OR IGNORE）。
- frontend：React 18 / react-router 7 / Vite 6。`npm run build` の dist を backend が配信。
- 認証：職員ログイン（scrypt・HttpOnly Cookie・30分）。受付フォーム `/intake` と `/api/intake*` は公開。全APIに `X-Rianet-App: 1` ヘッダ必須（CSRF対策。名称は互換のため変更しない）。
- AI：`@anthropic-ai/sdk`、`services/ai/client.js`。APIキーは `RIANET_ANTHROPIC_API_KEY` または `ANTHROPIC_API_KEY`（PCの環境変数）。送信前に必ず仮名化（`ai/pii.js`）。求職者の AI 利用同意（ai_consent）がなければ送らない。
- ネット求人検索：web_search/web_fetch ツール＋ `submit_jobs`（`ai/webJobSearch.js`）。
- ジョブメドレー求人一覧CSV（職種コード,求人URL,タイトル,…,特徴タグ）は求人画面の「CSV取込」で自動判別（`sources/jobMedleyImport.js`）。origin=web、求人番号は URL から W-<hash>、2週間有効。応募要件の資格列挙は「いずれか」とみなし最下位の1つだけ必須（無資格可・系統違いの並列は歓迎資格へ）。2026-10-14 時点の東京都 介護9,776件・看護6,664件で検証。
- HW 求人情報提供サービス Web API：`services/sources/hwApi.js`。URL・タグ・項目対応は設定で可変、承認前は無効。仕様書（マニュアル）を受け取ったら設定値を埋めて実装を詰める。
- テスト：`cd backend && npm test`（55件。TZ=UTC でも通ること）。

## ヒアリングシート（Google ドキュメント）
- 「求職者ヒアリングシート（介護・看護職共通）」ID `1FLwYnfMp4WL09FCbbn407YDokmyq5OEpaAFHDoSBdO8`
- アプリの項目（job_seekers v2 列・`services/hearing.js`・条件表テンプレート `scripts/make-sheet-template.js`）はこのシートの順番・項目に合わせてある。シートを変えたらアプリも合わせる。
- シートには外部AI（Anthropic社・米国）利用の任意同意欄、事業者情報、保存期間2年を記載済み（2026-10 A4・BIZ UDPゴシックで体裁調整）。

## 運用（ユーザーPC）
- 更新：`git pull --no-edit origin claude/plan-mode-change-pswtwc` → backend と frontend で `npm ci` → frontend で `npm run build` → backend で `node server.js`（または start.ps1）。
- .ps1 は UTF-8（BOM付き）で保存する（Windows PowerShell 5.1 の文字化け対策）。
- git pull で Vim が開いた経緯あり → 常に `--no-edit` を案内。

## 守ること
- APIキー・パスワードを表示・貼り付けさせない。スクリーンショットにキーが写っていたら即失効を案内。
- テストは架空データのみ。実在の求職者データを扱わない。
- 年齢・国籍等による不当な選別をしない。本籍・家族の職業など就職差別につながる情報は収集しない（`detectProhibited`）。
- 判定は補助。最終判断は担当者。

## 未完了・次の候補
- HW Web API：マニュアル受領後に URL・XMLタグ・項目対応を設定し、接続テスト。
- ネット求人検索：PC上の実データで品質確認・調整。
- 受付フォームの翻訳（ネパール語・ミャンマー語・ベトナム語・インドネシア語）の追加文言をネイティブ確認。
- 所在地の届出状況の確認。
