# Windows サーバーへの設置：最短手順（情シス向け）

社内の Windows サーバー1台に、IIS なしで設置する最短の構成です。詳細・運用は `OPERATIONS.md`（第3章 3-C）を参照してください。
**この手順書は、この開発環境では実機検証していません（PowerShell・IIS が無いため）。** 必ずテスト用サーバーで一度通してから本番に進んでください。

## 構成（IIS なし・直接HTTPS）
職員のブラウザ ──HTTPS(8443)──▶ Windows サーバー（Node.js が直接待受。NSSM でサービス化）
データは専用フォルダにJSON保存。インターネットには公開しない（社内LANのみ）。

## 事前に決めること（施設長・情シス）
1. サーバー名・社内URL（例 `https://shift.○○.local:8443`）と、社内DNSへの登録
2. HTTPS用の証明書（社内CA発行を推奨。PEM形式の `server.crt` と `server.key`）。検証用だけなら `deploy/make-selfsigned.sh`（Git for Windows の openssl 等で実行）
3. 接続を許可する社内ネットワークの範囲（例 192.168.10.0/24）
4. 監査ログ・バックアップの保管期間（法人の個人情報保護方針に従う）
5. 初期の管理者（施設長）の職員ID・氏名

## 手順
1. **Node.js** をインストール（22 LTS 推奨・本アプリは 22 で検証）。**NSSM** は情シスが入手・検証して `C:\tools\nssm.exe` に置く。
2. **専用アカウント** `svc_shiftapp`（ローカル・低権限・パスワードは情シスが管理）を作る。管理者権限では動かさない。
3. リポジトリ（またはその一式）を `C:\kaihatu-app` に配置。データ用フォルダ `D:\shift-app-data`（別ドライブ推奨）。
4. 証明書 `server.crt` / `server.key` を `C:\shift-app-cert\` に置く（秘密鍵はサービスアカウントだけが読める権限にする。スクリプトが設定）。
5. 管理者の PowerShell で、まず **ドライラン**（何も変更しない）：
   ```powershell
   cd C:\kaihatu-app\shift-app\server\deploy
   .\install-windows.ps1 -AppDir C:\kaihatu-app -DataDir D:\shift-app-data -NssmPath C:\tools\nssm.exe `
     -ServiceAccount .\svc_shiftapp -TlsCert C:\shift-app-cert\server.crt -TlsKey C:\shift-app-cert\server.key `
     -AllowedRemote 192.168.10.0/24 -DryRun
   ```
   内容を確認し、`-DryRun` を外して実行（アカウントのパスワードを聞かれる）。
6. **最初の管理者を作成**（初回ログイン時にパスワード変更が必須になる）：
   ```powershell
   $env:DATA_DIR = 'D:\shift-app-data'
   node C:\kaihatu-app\shift-app\server\adduser.js 1001 施設長氏名 admin '*'
   ```
   表示される初期パスワードは、その場で本人に渡し、記録を残さない。
7. ブラウザで `https://サーバー名:8443/` を開き、ログイン → パスワード変更 →「架空データで試す」で動作確認（確認後、データを消す）。
8. 作成関係者（約10名・全員 `editor`）の登録（一括：CSV。全職員のアカウントは作らない。確定できる人には `adduser.js --grant finalize 職員ID`）：
   ```powershell
   node C:\kaihatu-app\shift-app\server\adduser.js --csv users.csv --out C:\secure\initial-passwords.txt
   ```
   （列：職員ID,氏名,ロール,グループ（;区切り）。ロールは admin / editor / manager1 / manager2 / staff。editor は全部署のためグループ列は空欄可）
9. **バックアップ**：タスクスケジューラで `deploy\backup.ps1` を毎日実行し、**別のサーバー／NAS** へ退避。復元訓練を一度行う。

## ファイアウォール（社内の指定範囲だけ許可）
スクリプトが設定します。手動の場合：
```powershell
New-NetFirewallRule -DisplayName 'ShiftApp 8443' -Direction Inbound -Protocol TCP -LocalPort 8443 -RemoteAddress 192.168.10.0/24 -Action Allow
```
境界のファイアウォール／ルーターで、このポートをインターネットへ公開しないこと。

## IIS を使う場合
すでに社内で IIS を標準としている場合のみ。`deploy\web.config.example`（ARR）と `-ReverseProxy` オプションを使う。`PUBLIC_ORIGIN` の設定が必須。詳細は `OPERATIONS.md` と各ファイルのコメント。

## 確認チェック
- [ ] 社内PCからHTTPSで開ける／社外（スマホのモバイル回線）から開けない
- [ ] 管理者・フロア責任者・一般職員の3種類でログインし、見える範囲が違う（一般職員は自部署のみ・照会のみ）
- [ ] サービスを再起動してもログイン状態が維持され、異常終了時に自動再起動する
- [ ] バックアップが別媒体に出来ており、復元できた
- [ ] 監査ログ（`D:\shift-app-data\audit.log`）に、ログイン・保存が記録されている（勤務内容・パスワードは記録されない）
