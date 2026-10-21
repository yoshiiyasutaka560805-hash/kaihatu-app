<#
.SYNOPSIS
  勤務表アプリを Windows サービス（NSSM）として登録するためのひな形。管理者権限の PowerShell で実行する。
.DESCRIPTION
  - NSSM のダウンロードは行わない。情シスが入手・検証した nssm.exe を -NssmPath に置くこと。
  - 先に -DryRun で、実行される内容を確認する（何も変更しない）。
  - 専用の低権限ローカルアカウント（例 svc_shiftapp）を事前に作成しておく（パスワードは情シスが管理。ここには書かない）。
.USAGE
  .\install-windows.ps1 -AppDir C:\kaihatu-app -DataDir D:\shift-app-data -NssmPath C:\tools\nssm.exe `
      -ServiceAccount .\svc_shiftapp -PublicOrigin https://shift.example.local -DryRun
  （確認後 -DryRun を外して実行。アカウントのパスワードは実行時に入力を求める）
#>
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [Parameter(Mandatory = $true)][string]$DataDir,
  [Parameter(Mandatory = $true)][string]$NssmPath,
  [Parameter(Mandatory = $true)][string]$ServiceAccount,
  [string]$PublicOrigin = '',
  [string]$NodePath = 'C:\Program Files\nodejs\node.exe',
  [string]$ServiceName = 'ShiftApp',
  [int]$Port = 8443,
  [string]$AllowedRemote = '',          # ファイアウォールで許可する接続元（例 192.168.10.0/24）。プロキシ構成なら空（ローカルのみ）
  [switch]$ReverseProxy,                # IIS/nginx の背後で動かす（HOST=127.0.0.1, TRUST_PROXY=1, SECURE_COOKIE=1）
  [string]$TlsCert = '', [string]$TlsKey = '',   # プロキシなしで直接HTTPSにする場合
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
function Run([string]$desc, [scriptblock]$sb) {
  Write-Output "==> $desc"
  if ($DryRun) { Write-Output "    (DryRun) $($sb.ToString().Trim())" } else { & $sb }
}
if (-not $DryRun) {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw '管理者として実行してください' }
}
foreach ($f in @($NssmPath, $NodePath, (Join-Path $AppDir 'shift-app\server\server.js'))) {
  if (-not (Test-Path -LiteralPath $f)) { throw "見つかりません: $f" }
}
if (-not $ReverseProxy -and -not ($TlsCert -and $TlsKey)) { Write-Warning 'プロキシなし・TLSなしです。社内LAN公開にはHTTPS（-TlsCert/-TlsKey）またはリバースプロキシを使ってください（HOST=127.0.0.1 のまま起動します）。' }

# 環境変数（秘密情報は含めない）
$envs = @("DATA_DIR=$DataDir", "PORT=$Port", 'SESSION_HOURS=8')
if ($ReverseProxy) { $envs += @('HOST=127.0.0.1', 'TRUST_PROXY=1', 'SECURE_COOKIE=1'); if ($PublicOrigin) { $envs += "PUBLIC_ORIGIN=$PublicOrigin" } }
elseif ($TlsCert -and $TlsKey) { $envs += @('HOST=0.0.0.0', "TLS_CERT=$TlsCert", "TLS_KEY=$TlsKey") }
else { $envs += 'HOST=127.0.0.1' }
# 監査ログの保管日数を決めたら次行を有効化（未設定=削除しない）: $envs += 'AUDIT_RETENTION_DAYS=1095'

Run "データフォルダ作成: $DataDir" { New-Item -ItemType Directory -Force -Path $DataDir | Out-Null }
Run 'データフォルダのACL（専用アカウントとAdministratorsのみ）' {
  icacls $DataDir /inheritance:r /grant:r "${ServiceAccount}:(OI)(CI)M" 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' | Out-Null
}
if ($TlsKey) { Run "秘密鍵のACL: $TlsKey" { icacls $TlsKey /inheritance:r /grant:r "${ServiceAccount}:R" 'Administrators:F' | Out-Null } }
Run "アプリフォルダは読み取り専用（サービスアカウントに書込権限を与えない）: $AppDir" {
  icacls $AppDir /grant:r "${ServiceAccount}:(OI)(CI)RX" | Out-Null
}
Run "サービス登録: $ServiceName" {
  & $NssmPath install $ServiceName $NodePath (Join-Path $AppDir 'shift-app\server\server.js')
  & $NssmPath set $ServiceName AppDirectory $AppDir
  & $NssmPath set $ServiceName AppEnvironmentExtra $envs
  & $NssmPath set $ServiceName DisplayName '勤務表アプリ（社内）'
  & $NssmPath set $ServiceName Start SERVICE_AUTO_START
  & $NssmPath set $ServiceName AppExit Default Restart
  & $NssmPath set $ServiceName AppRestartDelay 5000
  $pw = Read-Host "サービスアカウント $ServiceAccount のパスワード" -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBigUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
  & $NssmPath set $ServiceName ObjectName $ServiceAccount $plain
  $plain = $null
  # ログ（標準出力/標準エラー）。サーバーはパスワード・トークンを出力しないが、保管場所と期間は方針に従う
  $logDir = Join-Path $DataDir 'service-logs'; New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  & $NssmPath set $ServiceName AppStdout (Join-Path $logDir 'stdout.log')
  & $NssmPath set $ServiceName AppStderr (Join-Path $logDir 'stderr.log')
  & $NssmPath set $ServiceName AppRotateFiles 1
  & $NssmPath set $ServiceName AppRotateBytes 5242880
}
if ($AllowedRemote -and -not $ReverseProxy) {
  Run "ファイアウォール: ポート $Port を $AllowedRemote のみ許可" {
    New-NetFirewallRule -DisplayName "$ServiceName ($Port)" -Direction Inbound -Protocol TCP -LocalPort $Port -RemoteAddress $AllowedRemote -Action Allow | Out-Null
  }
} else { Write-Output '==> ファイアウォール: ルールは作成しません（プロキシ構成はローカル待受のため不要／直接公開は -AllowedRemote を指定）' }
Run "サービス開始: $ServiceName" { Start-Service $ServiceName }

Write-Output ''
Write-Output '次の手順:'
Write-Output "  1) 最初の管理者を作成:  `$env:DATA_DIR='$DataDir'; & '$NodePath' '$AppDir\shift-app\server\adduser.js' admin01 `"施設長`" admin '*'"
Write-Output "     ※ adduser.js は専用アカウントで実行する（runas /user:$ServiceAccount ...）か、作成後に $DataDir の ACL を再適用する"
Write-Output '  2) ブラウザで公開URLにアクセスし、初期パスワードでログイン→パスワード変更'
Write-Output '  3) backup.ps1 をタスクスケジューラに登録（日次）'
