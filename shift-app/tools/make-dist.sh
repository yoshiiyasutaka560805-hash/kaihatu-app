#!/bin/sh
# 社内サーバーへ持ち込む配布ZIP（コードのみ。テスト・実データ・秘密情報は含めない）を作る
# 使い方: sh shift-app/tools/make-dist.sh [出力先ZIP]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/../shift-app-dist.zip}"
TMP="$(mktemp -d)"
mkdir -p "$TMP/shift-app/server/deploy"
cp "$ROOT/index.html" "$TMP/shift-app/"
cp "$ROOT/README.md" "$TMP/shift-app/" 2>/dev/null || true
cp "$ROOT/server/server.js" "$ROOT/server/userstore.js" "$ROOT/server/adduser.js" "$ROOT/server/README.md" "$ROOT/server/OPERATIONS.md" "$ROOT/server/WINDOWS-QUICKSTART.md" "$TMP/shift-app/server/"
cp "$ROOT/server/deploy/"* "$TMP/shift-app/server/deploy/"
cp "$ROOT/tools/START-HERE.txt" "$TMP/"
cp "$ROOT/tools/start-test.bat" "$TMP/shift-app/server/"
rm -f "$OUT"; (cd "$TMP" && zip -qr "$OUT" .)
rm -rf "$TMP"; echo "作成しました: $OUT"
