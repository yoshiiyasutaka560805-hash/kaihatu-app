# 求職者マッチング（株式会社リアネット） 起動スクリプト
# 初回のみ: backend / frontend で npm install を実行してください。
# AI補足を使う場合は、起動前に環境変数 ANTHROPIC_API_KEY を設定してください。

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "求職者マッチング 起動中..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Start-Sleep -Seconds 4
Start-Process "http://127.0.0.1:5180"

Write-Host "ブラウザで http://127.0.0.1:5180 を確認してください。" -ForegroundColor Green
Write-Host "終了するには、開いているPowerShellウィンドウを閉じてください。" -ForegroundColor Yellow
