"""明るい背景に濃色の文字を置くための共通描画

中央位置は渡された画像の幅から決めるので、リール（1080×1920）と
カルーセル（1080×1350）で同じ関数を使える。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from palette import MINT

FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"

def f(sz):
    return ImageFont.truetype(FONT, sz)

def tw(d, s, font, sp=0):
    """字間 sp を入れたときの文字列の幅"""
    return sum(d.textlength(c, font=font) for c in s) + sp*(len(s)-1)

def draw_sp(d, x, y, s, font, fill, sp=0):
    for c in s:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + sp

def centered(img, y, s, size, fill, sp=4, glow=False):
    """背景が明るいので、影ではなく白い抜きで文字を浮かせる"""
    W, H = img.size
    d = ImageDraw.Draw(img)
    font = f(size)
    x = (W - tw(d, s, font, sp))/2
    if glow:
        gl = Image.new("RGBA", (W, H), (0,0,0,0))
        draw_sp(ImageDraw.Draw(gl), x, y, s, font, (255,255,255,235), sp)
        img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(12)))
        img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(4)))
        d = ImageDraw.Draw(img)
    draw_sp(d, x, y, s, font, tuple(fill)+(255,), sp)

def pill(img, y, h, w, color, radius=None):
    W = img.size[0]
    ImageDraw.Draw(img).rounded_rectangle(
        [(W-w)/2, y, (W+w)/2, y+h], radius=radius or h//2, fill=tuple(color)+(255,))

def rule(img, y, w=132, h=9, color=MINT):
    W = img.size[0]
    ImageDraw.Draw(img).rounded_rectangle(
        [(W-w)/2, y, (W+w)/2, y+h], radius=h//2, fill=tuple(color)+(255,))

def fit(d, lines, start, floor, limit, sp=2):
    """行の最大幅が limit に収まる文字サイズを返す"""
    size = start
    while size > floor and max(tw(d, l, f(size), sp) for l in lines) > limit:
        size -= 2
    return size
