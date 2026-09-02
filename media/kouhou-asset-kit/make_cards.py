"""タイトルカード／エンドカードの作成

テキストを差し替えて実行すると、1080×1920の透過PNGを書き出す。
build.sh がこれを背景ループの上に重ねて動画にする。

  python3 make_cards.py                          … 下のTEXTSの内容で作る
  python3 make_cards.py --title "見出し" --sub "サブ"   … 一部だけ差し替える

文字はすべて Instagram リールの安全域（y 250-1500 / 左右60px）に収める。
"""
import argparse
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
UI_TOP, UI_BOTTOM, UI_SIDE = 250, 420, 60
SAFE_TOP, SAFE_BOTTOM = UI_TOP, H - UI_BOTTOM       # 250 - 1500

NAVY  = (0x10, 0x1A, 0x2E)
AMBER = (0xFF, 0xC8, 0x57)
PAPER = (0xEE, 0xF3, 0xFB)
WHITE = (255, 255, 255)

TEXTS = {
    "title":     "介護の仕事を、",
    "title2":    "いちから覚える。",
    "sub":       "S H I N S E I   F U K U S H I K A I",
    "org":       "社会福祉法人 新生福祉会",
    "end_head":  "一緒に働きませんか",
    "end_lines": ["未経験から始められます", "資格取得を支援します", "見学だけでも歓迎です"],
    "end_cta":   "詳しくはプロフィールから",
}

def f(sz): return ImageFont.truetype(FONT, sz)

def text_w(d, s, font, sp=0):
    return sum(d.textlength(c, font=font) for c in s) + sp*(len(s)-1)

def draw_sp(d, x, y, s, font, fill, sp=0):
    cx = x
    for c in s:
        d.text((cx, y), c, font=font, fill=fill)
        cx += d.textlength(c, font=font) + sp
    return cx - x

def centered(img, y, s, size, fill, sp=6, shadow=True, blur=7):
    d = ImageDraw.Draw(img)
    font = f(size)
    x = (W - text_w(d, s, font, sp))/2
    if shadow:
        sh = Image.new("RGBA", (W, H), (0,0,0,0))
        draw_sp(ImageDraw.Draw(sh), x+3, y+4, s, font, (0,0,0,150), sp)
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))
        d = ImageDraw.Draw(img)
    draw_sp(d, x, y, s, font, fill+(255,), sp)
    return y + size

def rule(img, y, w=132, color=AMBER, h=9):
    ImageDraw.Draw(img).rounded_rectangle(
        [(W-w)/2, y, (W+w)/2, y+h], radius=h//2, fill=color+(255,))

def title_card(t):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    y = 560
    y = centered(img, y, t["title"], 92, WHITE, sp=4) + 34
    y = centered(img, y, t["title2"], 92, WHITE, sp=4) + 52
    rule(img, y); y += 46
    d = ImageDraw.Draw(img)
    fs = f(30)
    draw_sp(d, (W - text_w(d, t["sub"], fs, 8))/2, y, t["sub"], fs, AMBER+(230,), 8)
    # 法人名は安全域の下寄りに小さく
    fo = f(38)
    draw_sp(d, (W - text_w(d, t["org"], fo, 4))/2, SAFE_BOTTOM-110, t["org"], fo, (255,255,255,205), 4)
    img.save("card_title.png")
    print("card_title.png  最下端 y=", SAFE_BOTTOM-110+38)

def end_card(t):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    y = 470
    y = centered(img, y, t["end_head"], 76, WHITE, sp=5) + 46
    rule(img, y); y += 66
    d = ImageDraw.Draw(img)
    fl = f(46)
    for line in t["end_lines"]:
        wl = text_w(d, line, fl, 3)
        x = (W - wl)/2
        # 行頭に琥珀色の点を置いて箇条書きだと分かるようにする
        d.ellipse([x-42, y+18, x-42+14, y+32], fill=AMBER+(255,))
        sh = Image.new("RGBA", (W, H), (0,0,0,0))
        draw_sp(ImageDraw.Draw(sh), x+2, y+3, line, fl, (0,0,0,140), 3)
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
        d = ImageDraw.Draw(img)
        draw_sp(d, x, y, line, fl, (255,255,255,240), 3)
        y += 82
    y += 44
    # CTAは琥珀色の帯で目立たせる
    fc = f(44)
    wc = text_w(d, t["end_cta"], fc, 4)
    bx0, bx1 = (W-wc)/2-40, (W+wc)/2+40
    d.rounded_rectangle([bx0, y-18, bx1, y+72], radius=45, fill=AMBER+(255,))
    draw_sp(d, (W-wc)/2, y+2, t["end_cta"], fc, NAVY+(255,), 4)
    fo = f(38)
    draw_sp(d, (W - text_w(d, t["org"], fo, 4))/2, SAFE_BOTTOM-100, t["org"], fo, (255,255,255,205), 4)
    img.save("card_end.png")
    print("card_end.png    最下端 y=", SAFE_BOTTOM-100+38)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    for k in ("title","title2","sub","org","end_head","end_cta"):
        ap.add_argument(f"--{k}")
    ap.add_argument("--end-lines", nargs="*", help="箇条書き（3行まで）")
    a = ap.parse_args()
    t = dict(TEXTS)
    for k in ("title","title2","sub","org","end_head","end_cta"):
        if getattr(a, k): t[k] = getattr(a, k)
    if a.end_lines: t["end_lines"] = a.end_lines
    title_card(t); end_card(t)
