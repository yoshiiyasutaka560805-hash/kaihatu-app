<#
.SYNOPSIS
  data フォルダを別媒体（NAS・USB・別サーバーの共有フォルダ等）へ退避し、世代管理する（Windows用）。
.USAGE
  powershell -ExecutionPolicy Bypass -File backup.ps1 -DataDir D:\shift-app-data -Dest \\nas\backup\shift-app [-Keep 14] [-Method Zip|Robocopy]
.NOTES
  - Zip（既定）: 1世代1ファイルの zip。Robocopy: 日付フォルダへコピー。どちらも sessions.json（ログイン情報）は除外。
  - ログは退避先の backup.log と標準出力。失敗時は終了コード 1（タスクスケジューラの失敗通知に使える）。
  - 退避物には users.json（パスワードのハッシュ）と勤務データが含まれる。退避先は暗号化・アクセス制限し、
    持ち出し・委託先への預け入れは法人の個人情報保護方針に従うこと。
  - 実行アカウントは DataDir を読め、Dest に書き込めること。
#>
param(
  [Parameter(Mandatory = $true)][string]$DataDir,
  [Parameter(Mandatory = $true)][string]$Dest,
  [int]$Keep = 14,
  [ValidateSet('Zip', 'Robocopy')][string]$Method = 'Zip'
)
$ErrorActionPreference = 'Stop'
$log = Join-Path $Dest 'backup.log'
function Log([string]$m) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Write-Output $line
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
}
try {
  if ($Keep -lt 1) { throw 'Keep は1以上' }
  if (-not (Test-Path -LiteralPath $DataDir -PathType Container)) { throw "DataDir が見つかりません: $DataDir" }
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Log "開始 method=$Method data=$DataDir dest=$Dest keep=$Keep"

  if ($Method -eq 'Zip') {
    # sessions.json を除いた作業コピーを作ってから圧縮
    $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("shift-app-stage-" + $stamp)
    robocopy $DataDir $stage /E /XF sessions.json /R:2 /W:2 /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy 失敗 (exit $LASTEXITCODE)" }
    try {
      $zip = Join-Path $Dest ("shift-app-data-$stamp.zip")
      Compress-Archive -Path (Join-Path $stage '*') -DestinationPath ($zip + '.part') -CompressionLevel Optimal
      Rename-Item -LiteralPath ($zip + '.part') -NewName (Split-Path $zip -Leaf)
      Log ("作成: {0} ({1:N0} bytes)" -f $zip, (Get-Item -LiteralPath $zip).Length)
    } finally { Remove-Item -Recurse -Force -LiteralPath $stage -ErrorAction SilentlyContinue }
    Get-ChildItem -LiteralPath $Dest -Filter 'shift-app-data-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep |
      ForEach-Object { Remove-Item -Force -LiteralPath $_.FullName; Log "削除(世代超過): $($_.FullName)" }
  } else {
    $d = Join-Path $Dest ("shift-app-data-$stamp")
    robocopy $DataDir $d /E /XF sessions.json /R:2 /W:2 /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy 失敗 (exit $LASTEXITCODE)" }   # 0-7 は成功系
    Log "作成: $d"
    Get-ChildItem -LiteralPath $Dest -Directory -Filter 'shift-app-data-*' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep |
      ForEach-Object { Remove-Item -Recurse -Force -LiteralPath $_.FullName; Log "削除(世代超過): $($_.FullName)" }
  }
  Log '完了'
  exit 0
} catch {
  Log "ERROR: $($_.Exception.Message)"
  exit 1
}
