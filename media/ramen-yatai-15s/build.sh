#!/usr/bin/env bash
# 屋台ラーメン 15秒リール のビルドスクリプト
#
# 必要なもの:
#   - ffmpeg (zscale / tonemap / zoompan / xfade / alimiter 対応ビルド)
#   - python3 + numpy + Pillow
#   - IPAゴシック (/usr/share/fonts/truetype/fonts-japanese-gothic.ttf)
#
# 素材 (SRC で指定したディレクトリに置く):
#   IMG_4157.mov   … 屋台のパン撮り動画 (HLG HDR / 1920x1080 / 回転メタ -90)
#   IMG_4163.jpeg  … 屋台の引き画
#   IMG_4166.jpeg  … 醤油ラーメンのアップ
#   IMG_4155.jpeg  … 集合セルフィー
#
# 使い方:  SRC=/path/to/photos ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
SRC="${SRC:-./src}"
FF="${FF:-ffmpeg}"
OUT="ramen_yatai_15s.mp4"

MOV="$SRC/IMG_4157.mov"
P_YATAI="$SRC/IMG_4163.jpeg"
P_RAMEN="$SRC/IMG_4166.jpeg"
P_SELFIE="$SRC/IMG_4155.jpeg"

# 1) 音楽 (96BPM / 6小節 = 15.000s) とテロップPNGを生成
python3 make_music.py
python3 make_titles.py

# HLG(HDR10) → BT.709 トーンマップ。これを省くと提灯の赤がくすむ。
TM="zscale=t=linear:npl=100,format=gbrpf32le,tonemap=tonemap=hable:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p"

# 2) 動画カット (縦1080x1920・30fps に統一)
#    S1: 提灯 (90f = 3.000s)
"$FF" -y -v error -ss 0.30 -t 3.2 -i "$MOV" -loop 1 -framerate 30 -t 3.2 -i t1.png -an \
 -filter_complex "[0:v]$TM,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.05:saturation=1.06,setsar=1,fps=30[v];\
[1:v]format=rgba,fade=t=in:st=0.4:d=0.55:alpha=1[o];\
[v][o]overlay=0:0,fade=t=in:st=0:d=0.5,format=yuv420p[out]" \
 -map "[out]" -frames:v 90 -c:v libx264 -crf 17 -preset medium s1.mp4

#    S3: 調理中 (105f = 3.500s)
"$FF" -y -v error -ss 6.60 -t 3.7 -i "$MOV" -loop 1 -framerate 30 -t 3.7 -i t3.png -an \
 -filter_complex "[0:v]$TM,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.05:saturation=1.06,setsar=1,fps=30[v];\
[1:v]format=rgba,fade=t=in:st=0.4:d=0.5:alpha=1[o];[v][o]overlay=0:0,format=yuv420p[out]" \
 -map "[out]" -frames:v 105 -c:v libx264 -crf 17 -preset medium s3.mp4

# 3) 写真カット: 背景ぼかし + ケンバーンズ (横写真を縦画面に収める)
photo_seg() { # $1=画像 $2=出力 $3=フレーム数 $4=テロップ $5=zoom式 $6=テロップ開始秒
  local D; D=$(python3 -c "print($3/30+0.2)")
  "$FF" -y -v error -loop 1 -framerate 30 -t "$D" -i "$1" -loop 1 -framerate 30 -t "$D" -i "$4" \
   -filter_complex "\
[0:v]format=rgb24,split=2[bg][fg];\
[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:2,eq=brightness=-0.12:saturation=1.25,setsar=1[bgb];\
[fg]scale=2160:-1,zoompan=z='$5':d=1:s=1080x810:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',setsar=1[fgz];\
[bgb][fgz]overlay=(W-w)/2:(H-h)/2:shortest=1,eq=contrast=1.06:saturation=1.10,vignette=PI/5.5,fps=30[base];\
[1:v]format=rgba,fade=t=in:st=$6:d=0.55:alpha=1[o];\
[base][o]overlay=0:0,format=yuv420p[out]" \
   -map "[out]" -frames:v "$3" -c:v libx264 -crf 17 -preset medium "$2"
}
photo_seg "$P_YATAI"  s2.mp4  78 t2.png "1+0.085*on/78"     0.35   # 屋台の引き  2.600s
photo_seg "$P_RAMEN"  s4.mp4 125 t4.png "1+0.13*on/125"     0.35   # ラーメン    4.167s
photo_seg "$P_SELFIE" s5.mp4 100 t5.png "1.08-0.08*on/100"  0.55   # セルフィー  3.333s

# 4) 連結 (0.4秒クロスフェード / 切り替わりは96BPMの拍に合わせてある) + 音楽 + 屋台の環境音
"$FF" -y -hide_banner -loglevel error \
 -i s1.mp4 -i s2.mp4 -i s3.mp4 -i s4.mp4 -i s5.mp4 \
 -i music.wav \
 -ss 0.30 -t 3.0 -i "$MOV" \
 -ss 6.60 -t 3.5 -i "$MOV" \
 -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=0.4:offset=2.6[x1];\
[x1][2:v]xfade=transition=fade:duration=0.4:offset=4.8[x2];\
[x2][3:v]xfade=transition=fade:duration=0.4:offset=7.9[x3];\
[x3][4:v]xfade=transition=fade:duration=0.4:offset=11.6667[x4];\
[x4]fade=t=out:st=14.25:d=0.75,format=yuv420p,fps=30[vout];\
[6:a:0]aresample=48000,volume=0.35,afade=t=in:st=0:d=0.35,afade=t=out:st=2.55:d=0.45[amb1];\
[7:a:0]aresample=48000,volume=0.35,afade=t=in:st=0:d=0.35,afade=t=out:st=3.05:d=0.45,adelay=4800|4800[amb2];\
[5:a][amb1][amb2]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-14:TP=-1.0:LRA=9:linear=true,afade=t=out:st=14.35:d=0.65,atrim=0:15,asetpts=N/SR/TB[aout]" \
 -map "[vout]" -map "[aout]" \
 -c:v libx264 -crf 19 -preset slow -profile:v high -level 4.1 -pix_fmt yuv420p -g 60 \
 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 15 "$OUT"

rm -f s1.mp4 s2.mp4 s3.mp4 s4.mp4 s5.mp4
echo "完成: $OUT"
