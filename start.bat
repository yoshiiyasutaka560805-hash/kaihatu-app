@echo off
echo 介護保険加算管理アプリ 起動中...
echo.

cd /d "%~dp0"

start "バックエンド" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak > nul

start "フロントエンド" cmd /k "cd frontend && npm run dev"
timeout /t 4 /nobreak > nul

start http://localhost:5173

echo.
echo アプリを起動しました。ブラウザで http://localhost:5173 を開いてください。
echo 適性検査（受検画面）: http://localhost:3001/aptitude-test/
echo 適性検査（結果管理）: http://localhost:3001/aptitude-test/admin.html
echo 終了するには、開いているコマンドプロンプトウィンドウを閉じてください。
