# 介護保険加算管理アプリ 起動スクリプト

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "介護保険加算管理アプリ 起動中..." -ForegroundColor Cyan

# バックエンド起動
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"

Start-Sleep -Seconds 3

# フロントエンド起動
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Start-Sleep -Seconds 4

# ブラウザを開く
Start-Process "http://localhost:5173"

Write-Host "アプリを起動しました。" -ForegroundColor Green
Write-Host "ブラウザで http://localhost:5173 を確認してください。" -ForegroundColor Green
Write-Host "適性検査（受検画面）: http://localhost:3001/aptitude-test/" -ForegroundColor Green
Write-Host "適性検査（結果管理）: http://localhost:3001/aptitude-test/admin.html" -ForegroundColor Green
Write-Host "終了するには、開いているPowerShellウィンドウを閉じてください。" -ForegroundColor Yellow
