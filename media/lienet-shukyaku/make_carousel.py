"""名言カルーセルのページPNG（1080×1350 / 4:5）

  CAROUSEL=ochikomi LINE_URL=https://line.me/R/ti/p/@xxxx python3 make_carousel.py

背景はリール用に作った bg_id_*.mp4 の1コマを中央で4:5に切り出して使う。
1080×1920 で書き出してあるので、切り出しても等倍のままで拡大は起きない。
ページごとに別の時刻を抜くので、同じ模様が並ばない。
"""
import os, subprocess
from PIL import Image, ImageDraw
from palette import SKYL, SKY, MINT, INK, MUTED
from textkit import f, tw, draw_sp, centered, pill, rule, fit
import carousels

W, H = 1080, 1350
LIMIT = 900               # 文字を収める幅（左右90pxの余白）
QR_SIZE = 380
FF = os.environ.get("FF", "ffmpeg")
LINE_URL = os.environ.get("LINE_URL", "").strip()
QR_FILE = "qr_line.png"

NAME = os.environ.get("CAROUSEL", "ochikomi")
C = carousels.get(NAME)
N = len(C["pages"]) + 2   # 表紙 + 引用 + 最終ページ

def bg(kind, t):
    """背景動画の1コマを 1080×1350 に切り出す（等倍で切るだけ）"""
    fam = C.get("bg", "id")
    src = f"bg_id_{kind}.mp4" if fam == "id" else f"bg_{kind}.mp4"
    out = f".bgtmp_{kind}_{t}.png"
    subprocess.run([FF, "-y", "-v", "error", "-ss", str(t), "-i", src,
                    "-frames:v", "1", "-vf", "crop=1080:1350:0:285", out], check=True)
    img = Image.open(out).convert("RGBA")
    os.remove(out)
    return img

def footer(img, page):
    d = ImageDraw.Draw(img)
    fb = f(28)
    draw_sp(d, (W - tw(d, C["brand"], fb, 9))/2, 1218, C["brand"], fb, tuple(SKY)+(230,), 9)
    if page:
        fp = f(26)
        s = f"{page} / {len(C['pages'])}"
        draw_sp(d, (W - tw(d, s, fp, 2))/2, 1272, s, fp, tuple(MUTED)+(210,), 2)

def cover():
    img = bg("sky", 0.2)
    d = ImageDraw.Draw(img)
    ts = fit(d, [C["title1"], C["title2"]], 82, 56, LIMIT, sp=3)
    centered(img, 420, C["title1"], ts, INK, sp=3, glow=True)
    centered(img, 420+ts+33, C["title2"], ts, INK, sp=3, glow=True)
    rule(img, 690)
    for k, l in enumerate(C["lead"]):
        centered(img, 748 + k*50, l, 36, MUTED, sp=1)
    fs = f(30)
    draw_sp(d, (W - tw(d, "スワイプしてご覧ください →", fs, 3))/2, 1120,
            "スワイプしてご覧ください →", fs, tuple(SKY)+(255,), 3)
    footer(img, None)
    return img

def quote(i):
    lines, who, note = C["pages"][i]
    img = bg("air", 0.5 + i*0.9)
    d = ImageDraw.Draw(img)
    # 引用が短いページは文字を大きくする。行数で始点を変えないと、
    # 1〜2行の短い言葉が広い余白の中で弱くなる。
    start = 76 if len(lines) <= 2 else 68 if len(lines) == 3 else 60
    size = fit(d, lines, start, 38, LIMIT, sp=2)
    lead = size + 30
    y0 = 480 - len(lines)*lead/2
    for k, l in enumerate(lines):
        centered(img, y0 + k*lead, l, size, INK, sp=2, glow=True)
    ry = y0 + len(lines)*lead + 26
    rule(img, ry, w=96, h=7)
    centered(img, ry + 38, f"— {who}", 34, MUTED, sp=4)

    # 添え書き：白い帯にのせて引用と分ける
    ny = ry + 130
    nh = 46*len(note) + 52
    d.rounded_rectangle([90, ny, W-90, ny+nh], radius=26, fill=(255,255,255,215))
    for k, l in enumerate(note):
        centered(img, ny + 26 + k*46, l, 31, INK, sp=1)
    footer(img, i+1)
    return img

def bullets(i):
    """お悩み・できること などの箇条書きページ"""
    head, items = C["pages"][i]
    img = bg("air", 0.5 + i*1.1)
    d = ImageDraw.Draw(img)
    hs = fit(d, [head], 52, 36, LIMIT, sp=2)
    centered(img, 230, head, hs, INK, sp=2, glow=True)
    rule(img, 230+hs+40, w=96, h=7)

    y = 230 + hs + 110
    for lines in items:
        bh = 46*len(lines) + 60
        d.rounded_rectangle([90, y, W-90, y+bh], radius=28, fill=(255,255,255,225))
        ImageDraw.Draw(img).ellipse([140, y+bh/2-11, 162, y+bh/2+11], fill=tuple(MINT)+(255,))
        for k, l in enumerate(lines):
            centered(img, y + 30 + k*46, l, 36, INK, sp=1)
        y += bh + 26
    footer(img, i+1)
    return img

def qr_image():
    if LINE_URL:
        import qrcode
        q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
        q.add_data(LINE_URL); q.make(fit=True)
        print(f"  QRを生成: {LINE_URL}")
        return q.make_image(fill_color="#06C755", back_color="white").convert("RGBA") \
                .resize((QR_SIZE, QR_SIZE), Image.NEAREST)
    if os.path.exists(QR_FILE):
        print(f"  QR画像を使用: {QR_FILE}")
        return Image.open(QR_FILE).convert("RGBA").resize((QR_SIZE, QR_SIZE), Image.LANCZOS)
    return None

def end():
    img = bg("sky", 3.1)
    centered(img, 150, C["end_head"],  62, INK, sp=3, glow=True)
    centered(img, 232, C["end_head2"], 62, INK, sp=3, glow=True)
    rule(img, 344)

    CW, CH, CY = 520, 560, 410
    cx0 = (W - CW)/2
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([cx0, CY, cx0+CW, CY+CH], radius=34, fill=(255,255,255,250),
                        outline=tuple(SKYL)+(255,), width=3)
    qr = qr_image()
    if qr is not None:
        img.alpha_composite(qr, (int((W-QR_SIZE)/2), CY+40))
    else:
        qx0, qy0 = (W-QR_SIZE)/2, CY+40
        d.rounded_rectangle([qx0, qy0, qx0+QR_SIZE, qy0+QR_SIZE], radius=16,
                            outline=tuple(MUTED)+(180,), width=4)
    fl = f(40)
    draw_sp(d, (W - tw(d, C["end_label"], fl, 3))/2, CY+462, C["end_label"], fl, tuple(INK)+(255,), 3)
    fn = f(29)
    draw_sp(d, (W - tw(d, C["end_note"], fn, 1))/2, CY+610, C["end_note"], fn, tuple(MUTED)+(255,), 1)
    fll = f(27)
    draw_sp(d, (W - tw(d, C["licence"], fll, 1))/2, 1240, C["licence"], fll, tuple(MUTED)+(255,), 1)
    return img

if __name__ == "__main__":
    print(f"カルーセル: {NAME}  {N}ページ")
    page = quote if C.get("style", "quote") == "quote" else bullets
    pages = [cover()] + [page(i) for i in range(len(C["pages"]))] + [end()]
    for i, img in enumerate(pages, 1):
        name = f"{C['out']}_{i:02d}.png"
        img.convert("RGB").save(name)
        print(f"  {name}")
