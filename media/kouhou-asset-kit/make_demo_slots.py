"""デモリール用の差し替え位置カット（構成を見せるためだけのもの）"""
import subprocess, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
NAVY, AMBER = (0x10,0x1A,0x2E), (0xFF,0xC8,0x57)
FF = os.environ.get("FF", "ffmpeg")

SLOTS = [("1", "施設や仕事の様子", "写真でも動画でもOK"),
         ("2", "働く人の表情",     "寄りのカットが効く"),
         ("3", "職場の雰囲気",     "引きのカットで締める")]

def text_w(d, s, font, sp):
    return sum(d.textlength(c, font=font) for c in s) + sp*(len(s)-1)

def draw_sp(d, x, y, s, font, fill, sp):
    for c in s:
        d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + sp

for num, head, note in SLOTS:
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    # 差し替え位置を示す枠
    d.rounded_rectangle([90, 470, W-90, 1330], radius=18, outline=NAVY+(90,), width=5)
    fn = ImageFont.truetype(FONT, 150)
    wn = text_w(d, num, fn, 0)
    d.ellipse([(W-150)/2, 600, (W+150)/2, 750], fill=AMBER+(255,))
    fnum = ImageFont.truetype(FONT, 92)
    draw_sp(d, (W-text_w(d,num,fnum,0))/2, 612, num, fnum, NAVY+(255,), 0)
    fh = ImageFont.truetype(FONT, 68)
    draw_sp(d, (W-text_w(d,head,fh,5))/2, 860, head, fh, NAVY+(255,), 5)
    fnote = ImageFont.truetype(FONT, 40)
    draw_sp(d, (W-text_w(d,note,fnote,3))/2, 970, note, fnote, (0x3A,0x46,0x5A,235), 3)
    fs = ImageFont.truetype(FONT, 34)
    lab = "ここに素材が入ります"
    draw_sp(d, (W-text_w(d,lab,fs,6))/2, 1240, lab, fs, (0x3A,0x46,0x5A,190), 6)
    img.save(f"_slot{num}.png")
    subprocess.run([FF, "-y", "-v", "error", "-stream_loop", "-1", "-i", "bg_paper.mp4",
                    "-loop", "1", "-framerate", "30", "-t", "3.6", "-i", f"_slot{num}.png",
                    "-filter_complex",
                    "[0:v]trim=0:3.6,setpts=PTS-STARTPTS,fps=30[bg];"
                    "[1:v]format=rgba,fade=t=in:st=0.2:d=0.5:alpha=1[o];"
                    "[bg][o]overlay=0:0,format=yuv420p[v]",
                    "-map", "[v]", "-frames:v", "102",
                    "-c:v", "libx264", "-crf", "19", "-preset", "medium",
                    f"slot_demo{num}.mp4"], check=True)
    os.remove(f"_slot{num}.png")
    print(f"slot_demo{num}.mp4")
