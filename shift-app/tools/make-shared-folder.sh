#!/bin/sh
# 共有フォルダ運用の配布ZIP（アプリ1ファイル＋手順）を作る。使い方: sh shift-app/tools/make-shared-folder.sh [出力先ZIP]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/../shared-folder-package.zip}"
TMP="$(mktemp -d)"; mkdir -p "$TMP/勤務表/アプリ" "$TMP/勤務表/作業データ" "$TMP/勤務表/配布用"
cp "$ROOT/index.html" "$TMP/勤務表/アプリ/勤務表アプリ.html"
cp "$ROOT/tools/SHARED-FOLDER.txt" "$TMP/勤務表/共有フォルダ運用手順.txt"
echo "ここに作業データ（.json）を保存します。アクセス権は作成関係者のみにしてください。" > "$TMP/勤務表/作業データ/ここに作業データを保存.txt"
echo "ここに確定後の閲覧用ファイルを置きます（全職員に読み取り専用で公開）。" > "$TMP/勤務表/配布用/ここに配布用ファイルを置く.txt"
rm -f "$OUT"; (cd "$TMP" && zip -qr "$OUT" .); rm -rf "$TMP"; echo "作成しました: $OUT"
