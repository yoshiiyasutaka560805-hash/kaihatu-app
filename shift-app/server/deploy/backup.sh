#!/usr/bin/env bash
# data/ を別媒体（NAS・USB・別サーバーのマウント先など）へ退避し、世代管理する。
# 使い方: backup.sh <DATA_DIR> <退避先ディレクトリ> [保持世代数=14]
#   環境変数 METHOD=tar（既定: tar.gz を1世代1ファイル） | rsync（日付ディレクトリ＋ハードリンクで差分保存）
#   環境変数 BACKUP_LOG=ログファイル（省略時は退避先/backup.log）。標準出力にも出す。
# 終了コード: 0=成功 / 1=失敗（cron・タスクの失敗通知に使える）
# 注意: 退避物には users.json（パスワードのハッシュ）と勤務データが含まれる。退避先は暗号化・アクセス制限し、
#       持ち出し・委託先への預け入れは法人の個人情報保護方針に従うこと。sessions.json（ログイン情報）は除外する。
set -euo pipefail
umask 077
DATA="${1:?使い方: $0 <DATA_DIR> <退避先> [世代数]}"; DEST="${2:?退避先を指定してください}"; KEEP="${3:-14}"
METHOD="${METHOD:-tar}"
[[ "$KEEP" =~ ^[0-9]+$ ]] && [ "$KEEP" -ge 1 ] || { echo "世代数は1以上の整数" >&2; exit 1; }
[ -d "$DATA" ] || { echo "DATA_DIR が見つかりません: $DATA" >&2; exit 1; }
mkdir -p "$DEST"; chmod 700 "$DEST"
LOG="${BACKUP_LOG:-$DEST/backup.log}"
log() { local m; m="$(date '+%Y-%m-%d %H:%M:%S') $*"; echo "$m"; echo "$m" >> "$LOG"; }
trap 'log "ERROR: バックアップに失敗しました（行 $LINENO）"; exit 1' ERR

STAMP="$(date '+%Y%m%d-%H%M%S')"
log "開始 method=$METHOD data=$DATA dest=$DEST keep=$KEEP"
case "$METHOD" in
  tar)
    F="$DEST/shift-app-data-$STAMP.tar.gz"
    tar -czf "$F.part" -C "$(dirname "$DATA")" --exclude='sessions.json' "$(basename "$DATA")"
    tar -tzf "$F.part" >/dev/null                       # 読み取り検証
    mv "$F.part" "$F"
    log "作成: $F ($(du -h "$F" | cut -f1))"
    # 古い世代を削除
    ls -1t "$DEST"/shift-app-data-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; log "削除(世代超過): $old"; done
    ;;
  rsync)
    command -v rsync >/dev/null || { echo "rsync がありません" >&2; exit 1; }
    D="$DEST/shift-app-data-$STAMP"
    PREV="$(ls -1dt "$DEST"/shift-app-data-*/ 2>/dev/null | head -n1 || true)"
    LINK=(); [ -n "$PREV" ] && LINK=(--link-dest="$PREV")
    rsync -a --exclude='sessions.json' ${LINK[@]+"${LINK[@]}"} "$DATA"/ "$D.part"/
    mv "$D.part" "$D"
    log "作成: $D"
    ls -1dt "$DEST"/shift-app-data-*/ 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -rf -- "$old"; log "削除(世代超過): $old"; done
    ;;
  *) echo "METHOD は tar か rsync" >&2; exit 1 ;;
esac
log "完了"
