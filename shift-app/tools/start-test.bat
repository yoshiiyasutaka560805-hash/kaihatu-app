@echo off
chcp 65001 >nul
rem ===== 勤務表アプリ 試験起動（サービス登録の前に動作確認する用。本運用はWINDOWS-QUICKSTART.mdの手順） =====
rem 使い方：このファイルをダブルクリック → ブラウザで http://localhost:8443/ を開く（このサーバー上で）。止めるときは Ctrl+C。
rem データは、このフォルダの上の「test-data」に保存されます（試験用。本番では DATA_DIR を専用フォルダにします）。
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。Node.js 22 LTS をインストールしてから、もう一度実行してください。
  pause
  exit /b 1
)
node -v
set DATA_DIR=%~dp0..\test-data
set HOST=127.0.0.1
set PORT=8443
if not exist "%DATA_DIR%\users.json" (
  echo 試験用の管理者を作成します。職員ID・氏名・初期パスワードを控えてください。
  node adduser.js test01 試験管理者 admin *
)
echo.
echo 起動します。ブラウザで http://localhost:8443/ を開いてください。
node server.js
pause
