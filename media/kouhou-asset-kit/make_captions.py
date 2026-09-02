"""カット用のテロップPNG（cap1.png / cap2.png / cap3.png）

  python3 make_captions.py "日々の様子" "先輩と一緒に" "研修も充実"

Instagramリールの安全域に収まる位置（本文の基準 y=1285）に置く。
空文字を渡したカットはPNGを作らない＝テロップ無しになる。
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
AMBER = (0xFF, 0xC8, 0x57)
UI_BOTTOM = 420
SAFE_BOTTOM = H - UI_BOTTOM        # 1500
CAPTION_Y = SAFE_BOTTOM - 215      # 1285

def f(sz): return ImageFont.truetype(FONT, sz)

def text_w(d, s, font, sp):
    return sum(d.textlength(c, font=font) for c in s) + sp*(len(s)-1)

def draw_sp(d, x, y, s, font, fill, sp):
    for c in s:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + sp

def scrim(img, top, alpha=170):
    g = Image.new("L", (1, H-top))
    for i in range(H-top):
        g.putpixel((0, i), int(alpha*((i/(H-top-1))**1.4)))
    black = Image.new("RGBA", (W, H-top), (0,0,0,255))
    black.putalpha(g.resize((W, H-top)))
    img.alpha_composite(black, (0, top))

def caption(text, path, size=66, sp=6):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    scrim(img, int(H*0.50))
    d = ImageDraw.Draw(img)
    font = f(size)
    x = (W - text_w(d, text, font, sp))/2
    d.rounded_rectangle([(W-84)/2, CAPTION_Y-36, (W+84)/2, CAPTION_Y-28], radius=4, fill=AMBER+(255,))
    sh = Image.new("RGBA", (W, H), (0,0,0,0))
    draw_sp(ImageDraw.Draw(sh), x+3, CAPTION_Y+4, text, font, (0,0,0,200), sp)
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
    draw_sp(ImageDraw.Draw(img), x, CAPTION_Y, text, font, (255,255,255,255), sp)
    img.save(path)
    print(f"{path}  「{text}」")

if __name__ == "__main__":
    for i, t in enumerate(sys.argv[1:4], start=1):
        if t.strip():
            caption(t, f"cap{i}.png")
