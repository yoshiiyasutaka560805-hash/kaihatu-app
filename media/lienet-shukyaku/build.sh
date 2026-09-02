#!/usr/bin/env bash
# 株式会社Lienet（有料職業紹介）求職者向け 15秒リールのビルド
#   ./build.sh assets  … BGM・背景ループ・テロップを作り直す
#   ./build.sh reel    … リールを組む（lienet_reel_15s.mp4）
set -euo pipefail
cd "$(dirname "$0")"
FF="${FF:-ffmpeg}"
BGM="${BGM:-bgm_odayaka.wav}"
TOPIC="${TOPIC:-service}"
OUT="$(TOPIC=$TOPIC python3 -c 'import os,topics;print(topics.get(os.environ["TOPIC"])["out"])')"

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
  cut bg_sky.mp4  ov_title.png c1.mp4  90 0.30 fadein
  cut bg_air.mp4 ov_step1.png c2.mp4 102 0.35
  cut bg_air.mp4 ov_step2.png c3.mp4 102 0.35
  cut bg_air.mp4 ov_step3.png c4.mp4  99 0.35
  cut bg_sky.mp4  ov_end.png   c5.mp4 105 0.30
  "$FF" -y -hide_banner -loglevel error -i c1.mp4 -i c2.mp4 -i c3.mp4 -i c4.mp4 -i c5.mp4 -i "$BGM" \
   -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=0.4:offset=2.6[x1];\
[x1][2:v]xfade=transition=fade:duration=0.4:offset=5.6[x2];\
[x2][3:v]xfade=transition=fade:duration=0.4:offset=8.6[x3];\
[x3][4:v]xfade=transition=fade:duration=0.4:offset=11.5[x4];\
[x4]fade=t=out:st=14.3:d=0.7,format=yuv420p,fps=30[v];\
[5:a]loudnorm=I=-14:TP=-1.0:LRA=9:linear=true,afade=t=out:st=14.35:d=0.65,atrim=0:15,asetpts=N/SR/TB[a]" \
   -map "[v]" -map "[a]" -c:v libx264 -crf 19 -preset slow -profile:v high -level 4.1 \
   -pix_fmt yuv420p -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 15 "$OUT.mp4"
  rm -f c1.mp4 c2.mp4 c3.mp4 c4.mp4 c5.mp4
  echo "$OUT.mp4"
}

case "${1:-reel}" in
  assets) assets ;;
  reel)   reel ;;
  *) echo "使い方: ./build.sh [assets|reel]"; exit 1 ;;
esac
