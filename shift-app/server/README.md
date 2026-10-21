# 勤務表アプリ 社内サーバー版（第2段階）

職員名・休暇などの個人情報を扱うため、**社内LAN限定・外部送信なし**で運用します。Node.js 22 の標準モジュールのみ（`npm install` 不要）。

## 構成
- `server.js` … 本体（静的配信 `../index.html`、認証、API、監査ログ、バックアップ）
- `adduser.js` … ユーザー管理CLI
- `tests/server.test.js` … 自動テスト（`node shift-app/server/tests/server.test.js`。一時フォルダ・架空データのみ）
- `data/`（自動作成・Git管理外）… `users.json`、`months/YYYY-MM.json`、`backups/YYYY-MM/`、`audit.log`

## 権限モデル（e3Shift に準拠）。グループ＝勤務表の部署名（例 `2階`）
| role | 表示 | 閲覧 | 更新 |
|---|---|---|---|
| `admin` | システム管理者 | 全部署 | 全部署 |
| `manager1` | 管理者(Ⅰ) | 全部署 | 自グループのみ |
| `manager2` | 管理者(Ⅱ) | 自グループのみ | 自グループのみ |
| `staff` | 一般職員 | 自グループのみ | 不可（403） |

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
node shift-app/server/adduser.js k.tanaka "（氏名）" manager1 "2階,3階"
node shift-app/server/adduser.js y.sato  "（氏名）" manager2 "2階"
node shift-app/server/adduser.js g.suzuki "（氏名）" staff    "2階"
node shift-app/server/adduser.js --passwd k.tanaka     # 再発行（ランダム表示）
node shift-app/server/adduser.js --disable g.suzuki    # 退職者・異動者は無効化
node shift-app/server/adduser.js --list
```
パスワードは10文字以上、scrypt（ソルト付き）でハッシュ保存。初期パスワードは本人にだけ安全な方法で伝え、変更は `--passwd` で（現状は利用者自身による変更画面なし）。

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

## 社内LAN公開（HTTPS 必須）
パスワードと勤務データが流れるため、LAN内でも **HTTPS（社内CA/社内証明書）** を使います。
```
HOST=0.0.0.0 PORT=8443 TLS_CERT=/etc/shiftapp/server.crt TLS_KEY=/etc/shiftapp/server.key node shift-app/server/server.js
```
証明書の CN/SAN は職員が使うホスト名（例 `shift.corp.local`）に。秘密鍵は実行ユーザーのみ読める権限に。IIS/nginx 等で TLS 終端する場合は `HOST=127.0.0.1 SECURE_COOKIE=1` で本サーバーをローカル待受にし、プロキシは `X-Forwarded-For` を付けても**本サーバーは信用しません**（ロック判定はプロキシのIP単位になる点に注意）。

## 常駐化
### Linux（systemd） `/etc/systemd/system/shiftapp.service`
```
[Unit]
Description=Shift app server
After=network.target
[Service]
User=shiftapp
WorkingDirectory=/opt/kaihatu-app
Environment=HOST=0.0.0.0 PORT=8443 DATA_DIR=/var/lib/shiftapp
Environment=TLS_CERT=/etc/shiftapp/server.crt TLS_KEY=/etc/shiftapp/server.key
ExecStart=/usr/bin/node shift-app/server/server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/shiftapp
PrivateTmp=true
[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now shiftapp`。ユーザー追加は `sudo -u shiftapp env DATA_DIR=/var/lib/shiftapp node shift-app/server/adduser.js ...`（サーバー再起動不要）。
### Windows（NSSM）
```
nssm install ShiftApp "C:\Program Files\nodejs\node.exe" "C:\kaihatu-app\shift-app\server\server.js"
nssm set ShiftApp AppDirectory C:\kaihatu-app
nssm set ShiftApp AppEnvironmentExtra HOST=0.0.0.0 PORT=8443 DATA_DIR=D:\shiftapp-data TLS_CERT=C:\shiftapp\server.crt TLS_KEY=C:\shiftapp\server.key
nssm set ShiftApp ObjectName ".\svc_shiftapp"   :: 専用の低権限アカウント
nssm start ShiftApp
```
`DATA_DIR` は専用アカウントのみ読み書きできる ACL にしてください。

## 動作仕様メモ
- 保存は操作の約3秒後に自動（デバウンス）。画面下部に「保存済み／保存中／競合」を表示。
- 楽観的排他制御：保存のたびに `version` が+1。他の人が先に保存していると 409 → 「最新版を取り込む（自分の変更は破棄）」または「自分の版で上書き」を選択。
- ログイン失敗は IP＋職員ID単位で 5回/10分でロック（IP全体では30回/10分）。ロック状態はメモリ保持（再起動で解除）。
- 変更系APIは `X-Requested-With: shiftapp` 必須＋Origin照合（CSRF対策）。Cookie は HttpOnly / SameSite=Strict。リクエスト上限 5MB。
- セッションはメモリ保持のため、サーバー再起動で全員ログアウトになります（データは保存済み）。
- `file://` で `index.html` を直接開いた場合は従来どおり localStorage 動作（サーバー保存されません）。

## 監査ログ（`data/audit.log`、JSON Lines）
ログイン成功/失敗/ロック、閲覧（月・部署）、保存（誰が・いつ・月・部署・version）、保存拒否/競合、監査ログ閲覧を追記。**パスワード・トークン・氏名・勤務内容は記録しません**（IPアドレスと職員IDは記録）。システム管理者は `GET /api/audit?n=200` で直近を確認可。ログは自動ローテーションしないため、保管期間を決めて定期的に退避・削除してください。

## バックアップ運用
- 保存のたびに `data/backups/YYYY-MM/` へタイムスタンプ・version付きコピー（月ごと直近30世代）。誤操作時は該当ファイルを `data/months/YYYY-MM.json` に戻して再起動なしで反映（**version は戻した値になるため、開いている画面は再読込**）。
- ただし同一ディスク内のため、`DATA_DIR` 全体を日次で別媒体・別拠点へ退避してください（バックアップ先も暗号化・アクセス制限）。
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
- [ ] 監査ログ（`audit.log`）の保管期間・閲覧権限・定期退避の方針確認（個人情報取扱規程と整合）
- [ ] 利用者（約130名のうち閲覧50・編集10名程度）の登録・無効化の運用担当と、入退職時の手順
- [ ] 時刻同期（NTP）：監査ログの時刻が正確であること
- [ ] 障害時の連絡先と、バックアップからの復旧手順の訓練
