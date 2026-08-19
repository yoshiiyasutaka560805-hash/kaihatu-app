from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
OUT = "."
ACCENT = (226, 64, 43)

def f(sz): return ImageFont.truetype(FONT, sz)

def tw(d, txt, font, sp=0):
    w = sum(d.textlength(c, font=font) for c in txt) + sp*(len(txt)-1)
    return w

def draw_sp(d, x, y, txt, font, fill, sp=0):
    """draw text with letter spacing, returns width"""
    cx = x
    for c in txt:
        d.text((cx, y), c, font=font, fill=fill)
        cx += d.textlength(c, font=font) + sp
    return cx - x

def scrim(img, top, bottom, alpha=170, top_alpha=0):
    """vertical gradient scrim from top->bottom"""
    g = Image.new("L", (1, bottom-top))
    for i in range(bottom-top):
        p = i/(bottom-top-1)
        g.putpixel((0, i), int(top_alpha + (alpha-top_alpha)*(p**1.4)))
    g = g.resize((W, bottom-top))
    black = Image.new("RGBA", (W, bottom-top), (0, 0, 0, 255))
    black.putalpha(g)
    img.alpha_composite(black, (0, top))

def caption(name, text, sub=None, size=68, y=None, center=False, sp=6):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if center:
        scrim(img, 0, H, alpha=90, top_alpha=90)
    else:
        scrim(img, int(H*0.62), H, alpha=175, top_alpha=0)
    d = ImageDraw.Draw(img)
    font = f(size)
    y = y if y is not None else int(H*0.735)
    width = tw(d, text, font, sp)
    x = (W - width)/2
    # accent bar above the caption
    bw = 76
    d.rounded_rectangle([ (W-bw)/2, y-34, (W+bw)/2, y-28 ], radius=3, fill=ACCENT+(255,))
    # soft shadow layer
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    draw_sp(ds, x+3, y+4, text, font, (0, 0, 0, 200), sp)
    if sub:
        fs = f(int(size*0.46))
        wsub = tw(ds, sub, fs, 10)
        draw_sp(ds, (W-wsub)/2+2, y+size+30, sub, fs, (0, 0, 0, 190), 10)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    draw_sp(d, x, y, text, font, (255, 255, 255, 255), sp)
    if sub:
        fs = f(int(size*0.46))
        wsub = tw(d, sub, fs, 10)
        draw_sp(d, (W-wsub)/2, y+size+30, sub, fs, (255, 228, 210, 235), 10)
    img.save(os.path.join(OUT, name))
    print("wrote", name)

caption("t1.png", "今夜は屋台のラーメン", sub="R A M E N   Y A T A I", size=70, y=int(H*0.70))
caption("t2.png", "赤提灯に誘われて", size=68)
caption("t3.png", "一杯ずつ、丁寧に", size=68)
caption("t4.png", "澄んだ醤油スープ", size=70)
caption("t5.png", "ごちそうさまでした", sub="T H A N K   Y O U", size=74, y=int(H*0.745))
