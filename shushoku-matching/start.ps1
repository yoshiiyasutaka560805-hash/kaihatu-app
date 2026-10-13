# 求職者マッチング（株式会社リアネット） 起動スクリプト（本番運用）
#
# 初回のみ：
#   cd backend;  npm ci
#   cd frontend; npm ci; npm run build
# 画面を更新（git pull）した後は frontend で npm run build を再実行してください。
#
# 環境変数（任意。Windowsの「システム環境変数」に設定するか、下の行のコメントを外す）
#   ANTHROPIC_API_KEY   … AI補足・面談メモ抽出・翻訳・求人票読取に使用（未設定ならAI機能なしで動作）
#   BACKUP_PASSWORD     … バックアップの暗号化キー（外部媒体へのバックアップに必須。紛失すると復元不可）
#   GOOGLE_MAPS_API_KEY … 通勤時間の自動計算（未設定なら手入力）
# $env:ANTHROPIC_API_KEY = "..."

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path "$root\frontend\dist\index.html")) {
  Write-Host "画面がビルドされていません。frontend フォルダで npm run build を実行してください。" -ForegroundColor Red
  exit 1
}

Write-Host "求職者マッチング 起動中..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; node server.js"
Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:3101"

Write-Host "ブラウザで http://127.0.0.1:3101 を開いてください。" -ForegroundColor Green
Write-Host "受付フォーム（求職者本人入力）: http://127.0.0.1:3101/intake" -ForegroundColor Green
Write-Host "終了するには、開いているPowerShellウィンドウを閉じてください。" -ForegroundColor Yellow
