#!/usr/bin/env bash
# 広報・採用リールの素材キット ビルドスクリプト
#
#   ./build.sh assets   … BGM・効果音・背景ループ・カードを作り直す
#   ./build.sh cards    … カードだけ作り直す（テキストを変えたとき）
#   ./build.sh demo     … 構成が分かる15秒のデモリールを組む
#   ./build.sh reel     … SLOT1..3 に指定した素材で本番のリールを組む
#
# 例: 写真3枚で本番を組む
#   SLOT1=photo1.jpg SLOT2=movie.mp4 SLOT3=photo2.jpg \
#   CAP1="日々の様子" CAP2="先輩と一緒に" CAP3="研修も充実" \
#   BGM=bgm_akarui.wav ./build.sh reel
#
# 必要なもの: ffmpeg / python3 + numpy + Pillow / IPAゴシック
set -euo pipefail
cd "$(dirname "$0")"
FF="${FF:-ffmpeg}"
BGM="${BGM:-bgm_akarui.wav}"

assets(){
  python3 make_bgm.py
  python3 make_se.py
  FF="$FF" python3 make_bg.py
  python3 make_cards.py
  render_cards
}

render_cards(){
  "$FF" -y -v error -stream_loop -1 -i bg_bokeh.mp4 -loop 1 -framerate 30 -t 3.0 -i card_title.png \
   -filter_complex "[0:v]trim=0:3.0,setpts=PTS-STARTPTS,fps=30[bg];\
[1:v]format=rgba,fade=t=in:st=0.25:d=0.7:alpha=1[o];\
[bg][o]overlay=0:'if(lt(t,0.95),46-46*t/0.95,0)',fade=t=in:st=0:d=0.4,format=yuv420p[v]" \
   -map "[v]" -frames:v 90 -c:v libx264 -crf 19 -preset medium -movflags +faststart card_title.mp4
  "$FF" -y -v error -stream_loop -1 -i bg_gradient.mp4 -loop 1 -framerate 30 -t 3.5 -i card_end.png \
   -filter_complex "[0:v]trim=0:3.5,setpts=PTS-STARTPTS,fps=30[bg];\
[1:v]format=rgba,fade=t=in:st=0.2:d=0.7:alpha=1[o];\
[bg][o]overlay=0:'if(lt(t,0.9),40-40*t/0.9,0)',format=yuv420p[v]" \
   -map "[v]" -frames:v 105 -c:v libx264 -crf 19 -preset medium -movflags +faststart card_end.mp4
  echo "card_title.mp4 / card_end.mp4"
}

# 1カット分の映像を作る。写真なら背景ぼかし+ゆっくりズーム、動画ならそのまま縦に切り出す。
# $1=素材 $2=出力 $3=フレーム数 $4=テロップPNG(空なら無し)
slot(){
  local src="$1" out="$2" nf="$3" cap="${4:-}"
  local dur; dur=$(python3 -c "print($nf/30+0.2)")
  local capin=() capfl=""
  if [ -n "$cap" ]; then
    capin=(-loop 1 -framerate 30 -t "$dur" -i "$cap")
    capfl=";[1:v]format=rgba,fade=t=in:st=0.35:d=0.5:alpha=1[o];[base][o]overlay=0:0,format=yuv420p[out]"
  else
    capfl=";[base]format=yuv420p[out]"
  fi
  case "${src,,}" in
    *.mp4|*.mov|*.m4v)
      "$FF" -y -v error -t "$dur" -i "$src" "${capin[@]}" -an -filter_complex \
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.04:saturation=1.06,setsar=1,fps=30[base]$capfl" \
        -map "[out]" -frames:v "$nf" -c:v libx264 -crf 18 -preset medium "$out" ;;
    *)
      "$FF" -y -v error -loop 1 -framerate 30 -t "$dur" -i "$src" "${capin[@]}" -filter_complex \
        "[0:v]format=rgb24,split=2[bg][fg];\
[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:2,eq=brightness=-0.12:saturation=1.2,setsar=1[bgb];\
[fg]scale=2160:-1,zoompan=z='1+0.09*on/$nf':d=1:s=1080x810:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',setsar=1[fgz];\
[bgb][fgz]overlay=(W-w)/2:(H-h)/2:shortest=1,eq=contrast=1.05:saturation=1.08,vignette=PI/5.5,fps=30[base]$capfl" \
        -map "[out]" -frames:v "$nf" -c:v libx264 -crf 18 -preset medium "$out" ;;
  esac
}

# カット5本を0.4秒のクロスフェードで繋ぎ、BGMを -14 LUFS で乗せる（合計15.000秒）
join5(){
  local out="$1"; shift
  "$FF" -y -hide_banner -loglevel error -i "$1" -i "$2" -i "$3" -i "$4" -i "$5" -i "$BGM" \
   -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=0.4:offset=2.6[x1];\
[x1][2:v]xfade=transition=fade:duration=0.4:offset=5.6[x2];\
[x2][3:v]xfade=transition=fade:duration=0.4:offset=8.6[x3];\
[x3][4:v]xfade=transition=fade:duration=0.4:offset=11.6[x4];\
[x4]fade=t=out:st=14.3:d=0.7,format=yuv420p,fps=30[v];\
[5:a]loudnorm=I=-14:TP=-1.0:LRA=9:linear=true,afade=t=out:st=14.35:d=0.65,atrim=0:15,asetpts=N/SR/TB[a]" \
   -map "[v]" -map "[a]" -c:v libx264 -crf 19 -preset slow -profile:v high -level 4.1 \
   -pix_fmt yuv420p -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 15 "$out"
  echo "$out"
}

demo(){
  python3 make_demo_slots.py
  join5 demo_reel.mp4 card_title.mp4 slot_demo1.mp4 slot_demo2.mp4 slot_demo3.mp4 card_end.mp4
  rm -f slot_demo1.mp4 slot_demo2.mp4 slot_demo3.mp4
}

reel(){
  : "${SLOT1:?SLOT1〜SLOT3 に素材のパスを指定してください}"
  python3 make_captions.py "${CAP1:-}" "${CAP2:-}" "${CAP3:-}"
  slot "$SLOT1" slot1.mp4 102 "$([ -n "${CAP1:-}" ] && echo cap1.png)"
  slot "$SLOT2" slot2.mp4 102 "$([ -n "${CAP2:-}" ] && echo cap2.png)"
  slot "$SLOT3" slot3.mp4 102 "$([ -n "${CAP3:-}" ] && echo cap3.png)"
  join5 reel.mp4 card_title.mp4 slot1.mp4 slot2.mp4 slot3.mp4 card_end.mp4
  rm -f slot1.mp4 slot2.mp4 slot3.mp4
}

case "${1:-demo}" in
  assets) assets ;;
  cards)  python3 make_cards.py && render_cards ;;
  demo)   demo ;;
  reel)   reel ;;
  *) echo "使い方: ./build.sh [assets|cards|demo|reel]"; exit 1 ;;
esac
