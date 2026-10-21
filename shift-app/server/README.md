# 勤務表アプリ 社内サーバー版（第2段階）

職員名・休暇などの個人情報を扱うため、**社内LAN限定・外部送信なし**で運用します。Node.js 22 の標準モジュールのみ（`npm install` 不要）。

## 構成
- `server.js` … 本体（静的配信 `../index.html`、認証、API、監査ログ、バックアップ）
- `adduser.js` … ユーザー管理CLI（個別・`--csv` 一括登録）
- `deploy/` … 設置用ファイル（systemd・Windows(NSSM)・nginx・IIS・バックアップ・証明書・`env.example`）
- `OPERATIONS.md` … **運用手順書（情シス・施設長向け。構築・ユーザー管理・バックアップ訓練・障害対応・個人情報保護・依頼チェックリスト）**
- `tests/server.test.js` … 自動テスト（`node shift-app/server/tests/server.test.js`。一時フォルダ・架空データのみ）
- `data/`（自動作成・Git管理外）… `users.json`、`months/YYYY-MM.json`、`backups/YYYY-MM/`、`audit.log`、`audit/`（ローテーション済みログ）、`sessions.json`（ログイン状態・ロック状態。トークンはSHA-256のみ）

## 権限モデル（e3Shift に準拠）。グループ＝勤務表の部署名（例 `2階`）
| role | 表示 | 閲覧 | 更新 |
|---|---|---|---|
| `admin` | システム管理者 | 全部署 | 全部署 |
| `editor` | 編集者（作成関係者・約10名） | 全部署 | 全部署（監査ログ閲覧は不可） |
| `manager1` | 管理者(Ⅰ) | 全部署 | 自グループのみ |
| `manager2` | 管理者(Ⅱ) | 自グループのみ | 自グループのみ |
| `staff` | 一般職員 | 自グループのみ | 不可（403） |

**運用の想定**：サーバーを使うのは作成関係者 約10名のみ（推奨：全員 `editor`、施設長＝`admin`）。全職員はログインせず、確定後に出力したファイル（閲覧用HTML・印刷・Excel）を受け取ります。

**確定（ロック）**：`POST /api/month/:ym/finalize` / `unfinalize`。確定済みの月は `PUT` が 423 で拒否されます。実行できるのは `admin` と、`users.json` の権限フラグ `canFinalize` を持つユーザーのみ（`adduser.js --grant finalize <ID>` / `--revoke finalize <ID>`、`--list` に `[確定権限]` 表示、`GET /api/me` に `canFinalize`）。確定時に下書きのバックアップを1世代作成し、監査ログに記録します（勤務内容は記録しない）。`GET /api/month/:ym/version` は版番号・保存者の職員ID・時刻・確定状態だけを返す軽量エンドポイントで、画面が30秒ごとに他の人の保存を検知するために使います。

権限判定は**すべてサーバー側**で行います（閲覧は部署単位でデータ自体を除外、更新は許可部署の職員・必要人数だけを既存データへマージ）。
管理者が更新できるのは `sections` / `staff` / `needs` / `minNeeds` の自部署分のみです。祝日・記号マスタなど月全体の共通設定は、システム管理者（または月の新規作成時）だけが変更できます。部署名の一致で判定するため、ユーザーのグループ名は勤務表の部署名と完全一致させてください。

## 初期セットアップ
```
cd kaihatu-app
# 1) 最初のシステム管理者（パスワード省略→ランダム生成、画面に一度だけ表示）
node shift-app/server/adduser.js admin01 "システム管理者" admin "*"
# 2) 起動（既定は 127.0.0.1:8443。この端末のみ）
node shift-app/server/server.js
# 3) ブラウザで http://127.0.0.1:8443/ を開きログイン → 「取込」で勤務表を貼り付け、または「架空データで試す」
# 4) 他のユーザー
node shift-app/server/adduser.js k.tanaka "（氏名）" editor "*"          # 作成関係者（全部署を編集）
node shift-app/server/adduser.js --grant finalize k.tanaka             # 確定できる人（設定で付け外し）
node shift-app/server/adduser.js k.tanaka2 "（氏名）" manager1 "2階,3階"
node shift-app/server/adduser.js y.sato  "（氏名）" manager2 "2階"
node shift-app/server/adduser.js --passwd k.tanaka     # 再発行（ランダム表示。既存ログインは失効）
node shift-app/server/adduser.js --disable g.suzuki    # 退職者・異動者は無効化（ログイン中でも即失効）
node shift-app/server/adduser.js --list
# 5) 一括登録（CSV: 職員ID,氏名,ロール,グループ（;区切り）。初期パスワードは標準出力にのみ表示）
node shift-app/server/adduser.js --csv staff.csv --dry-run          # 検証のみ（1件でも不正なら全件登録しない）
node shift-app/server/adduser.js --csv staff.csv                    # 登録＋初期パスワードを画面表示
node shift-app/server/adduser.js --csv staff.csv --out pw.tsv       # 0600の新規ファイルにのみ出力（標準出力には出さない。配布後は安全に削除）
```
- 初期パスワード・再発行パスワードは scrypt（ソルト付き）でハッシュ保存。**作成/再発行されたパスワードは初回ログイン時に本人が変更必須**（変更するまで他APIは403、画面は変更ダイアログに誘導）。自動化用に `--no-change-required` で無効化可。
- 利用者は画面下部の「パスワード変更」から自分で変更できる（`POST /api/password`）。ポリシー：12文字以上・職員ID/氏名を含まない・現在および直近3回と同一でない・2種類以上の文字種・同一文字の繰り返し不可。変更すると**他の端末のセッションは失効**し、監査ログに記録（パスワードは記録しない）。現パスワードの誤りはログインと同じロック対象。

## 環境変数
| 変数 | 既定 | 説明 |
|---|---|---|
| `PORT` | 8443 | 待受ポート |
| `HOST` | **127.0.0.1** | 社内公開時のみ `0.0.0.0` または社内NICのIPを**明示** |
| `DATA_DIR` | `server/data` | データ保存先（暗号化ディスク・バックアップ対象に） |
| `TLS_CERT` / `TLS_KEY` | なし | 指定で HTTPS（Secure Cookie・HSTS も自動） |
| `SECURE_COOKIE` | なし | `1` で Secure 付与（リバースプロキシでTLS終端する場合） |
| `SESSION_HOURS` | 8 | セッション有効時間（固定。延長なし） |
| `BACKUP_KEEP` | 30 | 月ごとのバックアップ保持世代 |
| `TRUST_PROXY` | なし | `1` のときだけ `X-Forwarded-For` の先頭をクライアントIPとする（既定は信用しない）。直接の接続元がループバック（または `TRUST_PROXY_IPS`）のときのみ有効 |
| `TRUST_PROXY_IPS` | なし | 別ホストのプロキシIPをカンマ区切りで追加 |
| `PUBLIC_ORIGIN` | なし | ブラウザが使う公開Origin（例 `https://shift.example.local`。カンマ区切り可）。CSRFのOrigin検証に追加。プロキシがHostを書き換える構成では必須 |
| `AUDIT_RETENTION_DAYS` | 未設定（削除しない） | `data/audit/` の退避済みログを、この日数を超えたら削除（起動時と6時間ごと） |
| `AUDIT_MAX_BYTES` | 5242880 | 監査ログのサイズによるローテーション閾値（月替わりでも退避） |

全変数の説明は `deploy/env.example` を参照。

## 社内LAN公開（HTTPS 必須）
パスワードと勤務データが流れるため、LAN内でも **HTTPS（社内CA/社内証明書）** を使います。
```
HOST=0.0.0.0 PORT=8443 TLS_CERT=/etc/shiftapp/server.crt TLS_KEY=/etc/shiftapp/server.key node shift-app/server/server.js
```
証明書の CN/SAN は職員が使うホスト名（例 `shift.corp.local`）に。秘密鍵は実行ユーザーのみ読める権限に。IIS/nginx 等で TLS 終端する場合は `HOST=127.0.0.1 SECURE_COOKIE=1 TRUST_PROXY=1 PUBLIC_ORIGIN=https://（公開ホスト名）` で本サーバーをローカル待受にします（設定例は `deploy/nginx.conf.example`・`deploy/web.config.example`）。**`TRUST_PROXY` を付けない場合は `X-Forwarded-For` を無視**し、ロック判定・監査ログのIPがプロキシのIP単位になります。`TRUST_PROXY=1` のときは、プロキシ側で `X-Forwarded-For` を接続元IPで**上書き**する設定が必須です（追記方式だとクライアントが偽装できます）。

## 常駐化
- Linux（systemd）: `deploy/shift-app.service`（堅牢化済み）。専用ユーザー `shift-app`、`/etc/shift-app/env`（`deploy/env.example`）。
- Windows（NSSM）: `deploy/install-windows.ps1`（`-DryRun` で内容確認。NSSM本体は管理者が配置）。
- IIS / nginx の背後に置く場合: `deploy/web.config.example` / `deploy/nginx.conf.example`。検証用の自己署名証明書: `deploy/make-selfsigned.sh`（本番は社内CA）。
- 手順の詳細は **OPERATIONS.md**。

## 動作仕様メモ
- 保存は操作の約3秒後に自動（デバウンス）。画面下部に「保存済み／保存中／競合」を表示。
- 楽観的排他制御：保存のたびに `version` が+1。他の人が先に保存していると 409 → 「最新版を取り込む（自分の変更は破棄）」または「自分の版で上書き」を選択。
- ログイン失敗は IP＋職員ID単位で 5回/10分でロック（IP全体では30回/10分）。ロック状態は `data/sessions.json` に保存し、**再起動しても解除されません**。
- 変更系APIは `X-Requested-With: shiftapp` 必須＋Origin照合（CSRF対策）。Cookie は HttpOnly / SameSite=Strict。リクエスト上限 5MB。
- セッションは `data/sessions.json` にトークンのSHA-256ハッシュで保存（0600）。**再起動しても有効期限内は有効**（期限切れは自動掃除）。ログアウト・パスワード変更/再発行・無効化で失効。
- `file://` で `index.html` を直接開いた場合は従来どおり localStorage 動作（サーバー保存されません）。

## 監査ログ（`data/audit.log`、JSON Lines）
ログイン成功/失敗/ロック、閲覧（月・部署）、保存（誰が・いつ・月・部署・version）、保存拒否/競合、監査ログ閲覧を追記。**パスワード・トークン・氏名・勤務内容は記録しません**（IPアドレスと職員IDは記録）。システム管理者は `GET /api/audit?n=200` で直近を確認可。ログは**月替わりまたは5MB超で自動ローテーション**し、`data/audit/audit-YYYY-MM.log` に退避します。保管期間は法人の方針で決め、`AUDIT_RETENTION_DAYS` を設定すると超過分を自動削除（**未設定なら削除しない**）。`/api/audit` が返すのは現在のログのみ。

## バックアップ運用
- 保存のたびに `data/backups/YYYY-MM/` へタイムスタンプ・version付きコピー（月ごと直近30世代）。誤操作時は該当ファイルを `data/months/YYYY-MM.json` に戻して再起動なしで反映（**version は戻した値になるため、開いている画面は再読込**）。
- ただし同一ディスク内のため、`DATA_DIR` 全体を日次で別媒体・別拠点へ退避してください（バックアップ先も暗号化・アクセス制限）。退避スクリプト: Linux `deploy/backup.sh <DATA_DIR> <退避先> [世代数]`（`METHOD=tar|rsync`）、Windows `deploy/backup.ps1 -DataDir … -Dest … [-Keep 14] [-Method Zip|Robocopy]`。結果は退避先の `backup.log` に記録、失敗時は終了コード1。
- 復元手順・訓練は OPERATIONS.md の「バックアップと復元」を参照。
- 職員退職後の保管・廃棄期間（バックアップ含む）は法人の個人情報取扱規程に合わせて定める。

## 個人情報保護上の注意
- 外部ネットワークへの通信・CDN・外部フォントは一切使いません（CSP でも禁止）。インターネット非公開の社内LANのみで運用。
- `data/` はGit管理外（`.gitignore` 済み）。リポジトリ・メール・チャットに実データを載せない。
- 共有ID・パスワードの使い回しは禁止（1人1ID。退職・異動時は `--disable`）。
- 画面の「閲覧用ファイルを保存」で出力したHTMLは個人情報を含むため、保存先を制限する。
- テスト・開発では架空データのみ使用。

## 情シス依頼用チェックリスト
- [ ] サーバーのOSアカウント：専用の低権限アカウントで実行（管理者/root不可）、`DATA_DIR` はそのアカウントのみアクセス可
- [ ] ファイアウォール：インターネットから到達不可（ポート開放・ポートフォワード・クラウド公開をしない）
- [ ] アクセス元IP制限：職員用VLAN/拠点の社内セグメントだけ `PORT` に許可
- [ ] 社内CAまたは社内証明書の発行・配布（ブラウザ警告なしでHTTPS）、秘密鍵の保護、更新期限の管理
- [ ] ディスク暗号化（BitLocker/LUKS）と、`DATA_DIR` のバックアップ（別媒体・暗号化・世代管理）
- [ ] 常駐化（NSSM/systemd）・自動再起動・OS/Node.js のセキュリティ更新計画（Node 22 LTS）
- [ ] 監査ログ（`audit.log`・`audit/`）の保管期間・閲覧権限・定期退避の方針確認（個人情報取扱規程と整合）。印刷用の詳細チェックリストは OPERATIONS.md 末尾
- [ ] 利用者（約130名のうち閲覧50・編集10名程度）の登録・無効化の運用担当と、入退職時の手順
- [ ] 時刻同期（NTP）：監査ログの時刻が正確であること
- [ ] 障害時の連絡先と、バックアップからの復旧手順の訓練
