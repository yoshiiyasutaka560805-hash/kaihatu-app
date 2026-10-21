#!/usr/bin/env bash
# 検証用の自己署名証明書を作る。※本番は社内CA（または情シス管理の証明書）を使うこと。
# 自己署名はブラウザ警告が出るうえ、職員が警告を無視する習慣がつく恐れがある。
# 使い方: ./make-selfsigned.sh <ホスト名> [出力先ディレクトリ=./tls] [IPアドレス]
set -euo pipefail
HOST="${1:?使い方: $0 <ホスト名 例 shift.example.local> [出力先] [IP]}"
OUT="${2:-./tls}"; IP="${3:-}"
umask 077
mkdir -p "$OUT"; chmod 700 "$OUT"
SAN="DNS:${HOST}"; [ -n "$IP" ] && SAN="${SAN},IP:${IP}"
openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 365 \
  -keyout "$OUT/server.key" -out "$OUT/server.crt" \
  -subj "/CN=${HOST}" -addext "subjectAltName=${SAN}" -addext "basicConstraints=CA:FALSE"
chmod 600 "$OUT/server.key"; chmod 644 "$OUT/server.crt"
echo "作成しました: $OUT/server.crt（公開可）, $OUT/server.key（秘密鍵。実行ユーザー以外に渡さない）"
echo "有効期限365日。本番では社内CAの証明書に差し替えてください。"
