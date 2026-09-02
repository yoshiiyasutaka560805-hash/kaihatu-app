#!/usr/bin/env bash
# 株式会社Lienet（有料職業紹介）求職者向け 15秒リールのビルド
#   ./build.sh assets  … BGM・背景ループ・テロップを作り直す
#   ./build.sh reel    … リールを組む（lienet_reel_15s.mp4）
set -euo pipefail
cd "$(dirname "$0")"
FF="${FF:-ffmpeg}"
BGM="${BGM:-bgm_odayaka.wav}"
TOPIC="${TOPIC:-service}"
cfg(){ TOPIC=$TOPIC python3 -c "import os,topics;t=topics.get(os.environ['TOPIC']);print($1)"; }
OUT="$(cfg 't["out"]')"
BG_SKY="$(cfg 't["bg"][0]')"   # タイトル・エンドカード用
BG_AIR="$(cfg 't["bg"][1]')"   # 本文カット用

assets(){
  python3 make_bgm.py
  python3 make_se.py
  FF="$FF" python3 make_bg.py
  TOPIC="$TOPIC" python3 make_reel_overlays.py
}

# $1=背景mp4 $2=テロップpng $3=出力 $4=フレーム数 $5=テロップ表示開始秒 $6=先頭を黒からフェードするか
cut(){
  local dur; dur=$(python3 -c "print($4/30+0.3)")
  local extra=""
  [ "${6:-no}" = "fadein" ] && extra=",fade=t=in:st=0:d=0.5"
  "$FF" -y -v error -stream_loop -1 -i "$1" -loop 1 -framerate 30 -t "$dur" -i "$2" \
   -filter_complex "[0:v]trim=0:$dur,setpts=PTS-STARTPTS,fps=30[bg];\
[1:v]format=rgba,fade=t=in:st=$5:d=0.55:alpha=1[o];\
[bg][o]overlay=0:'if(lt(t,0.9),34-34*t/0.9,0)'$extra,format=yuv420p[v]" \
   -map "[v]" -frames:v "$4" -c:v libx264 -crf 19 -preset medium "$3"
}

reel(){
  local i=0 ins=() tmp=() bgf rows=() line kind ov nf st fi
  # 行はまず配列に読む。ループ内で回す ffmpeg が標準入力を食ってしまうため、
  # while read をパイプで回すと2件目以降が壊れる。
  mapfile -t rows < <(TOPIC=$TOPIC python3 -c '
import os, topics
for c in topics.get(os.environ["TOPIC"])["cuts"]:
    print("\t".join(str(x) for x in c))')
  for line in "${rows[@]}"; do
    IFS=$'\t' read -r kind ov nf st fi <<<"$line"
    i=$((i+1))
    case "$kind" in sky) bgf="$BG_SKY" ;; air) bgf="$BG_AIR" ;; *) echo "背景の指定が不正: $kind"; exit 1 ;; esac
    cut "$bgf" "$ov" "cut_$i.mp4" "$nf" "$st" "$fi"
    ins+=(-i "cut_$i.mp4"); tmp+=("cut_$i.mp4")
  done
  "$FF" -y -hide_banner -loglevel error "${ins[@]}" -i "$BGM" \
   -filter_complex "$(TOPIC=$TOPIC python3 make_chain.py)" \
   -map "[v]" -map "[a]" -c:v libx264 -crf 19 -preset slow -profile:v high -level 4.1 \
   -pix_fmt yuv420p -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 15 "$OUT.mp4"
  rm -f "${tmp[@]}"
  echo "$OUT.mp4"
}

case "${1:-reel}" in
  assets) assets ;;
  reel)   reel ;;
  *) echo "使い方: ./build.sh [assets|reel]"; exit 1 ;;
esac
