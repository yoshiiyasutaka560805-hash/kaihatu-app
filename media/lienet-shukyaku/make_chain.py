"""カット構成から ffmpeg の filter_complex を組む（build.sh から呼ぶ）

カット数がテーマごとに違うので、xfade の連鎖をここで生成する。
合計が15.000秒にならない構成は、書き出す前にここで止める。
"""
import os, sys, topics

FPS, XF = 30, 0.4
XFF = int(XF*FPS)          # xfade1回で失われるフレーム数
TARGET = 450               # 15.000秒

t = topics.get(os.environ.get("TOPIC", "service"))
cuts = t["cuts"]
n = len(cuts)
total = sum(c[2] for c in cuts) - (n-1)*XFF
if total != TARGET:
    sys.exit(f"合計{total}フレーム（{total/FPS:.3f}秒）。"
             f"{TARGET}フレーム=15.000秒になるよう topics.py の cuts を直してください。")

parts, cur, src = [], cuts[0][2]/FPS, "0:v"
for i in range(1, n):
    dst = f"x{i}"
    parts.append(f"[{src}][{i}:v]xfade=transition=fade:duration={XF}:offset={cur-XF:.6g}[{dst}]")
    cur += cuts[i][2]/FPS - XF
    src = dst
parts.append(f"[{src}]fade=t=out:st=14.3:d=0.7,format=yuv420p,fps={FPS}[v]")
parts.append(f"[{n}:a]loudnorm=I=-14:TP=-1.0:LRA=9:linear=true,"
             f"afade=t=out:st=14.35:d=0.65,atrim=0:15,asetpts=N/SR/TB[a]")
print(";".join(parts))
