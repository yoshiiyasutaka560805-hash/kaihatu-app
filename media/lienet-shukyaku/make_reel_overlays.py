"""リール（15秒）用のテロップPNG

背景が明るいので、文字は濃紺（INK）。差し色は水色とミント、
行動喚起だけコーラルのボタンにする。
文字はすべて Instagram リールの安全域（上250 / 下420 / 左右60px の内側）に収める。
"""
import os
from PIL import Image, ImageDraw
from palette import SKYL, SKY, MINT, INK, MUTED
from textkit import f, tw, draw_sp, centered, pill, rule
import topics

# LINEのQRの入れ方（どちらか）
#   LINE_URL=https://lin.ee/xxxxxxx python3 make_reel_overlays.py   … URLからQRを生成する（推奨・最も鮮明）
#   qr_line.png をこのフォルダに置いて実行                          … 用意済みのQR画像をそのまま使う
# どちらも無い場合は、QRを貼る枠だけを描く。
LINE_URL  = os.environ.get("LINE_URL", "").strip()
QR_FILE   = "qr_line.png"
QR_SIZE   = 420          # スマホで読み取れる大きさ

W, H = 1080, 1920
SAFE_BOTTOM = H - 420          # 1500

TOPIC = os.environ.get("TOPIC", "service")
TEXTS = topics.get(TOPIC)

def title_card(t):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    centered(img, 520, t["title1"], 88, INK, sp=3, glow=True)
    centered(img, 640, t["title2"], 88, INK, sp=3, glow=True)
    rule(img, 790)
    centered(img, 850, t["brand"], 34, SKY, sp=10)
    img.save("ov_title.png"); print("ov_title.png")

def step_card(i, t):
    label, head, note = t["steps"][i]
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fl = f(30)
    wl = tw(d, label, fl, 8)
    pill(img, 470, 66, wl+72, SKY, radius=33)
    draw_sp(ImageDraw.Draw(img), (W-wl)/2, 484, label, fl, (255,255,255,255), 8)
    size = 62
    while size > 40 and tw(ImageDraw.Draw(img), head, f(size), 2) > 900:
        size -= 2
    centered(img, 610, head, size, INK, sp=2, glow=True)
    centered(img, 720, note, 34, MUTED, sp=1)
    img.save(f"ov_step{i+1}.png"); print(f"ov_step{i+1}.png")

def quote_card(i, t):
    """名言カード。引用は改行位置を topics.py で決め打ちしている（自動折返しだと座りが悪い）"""
    lines, who = t["quotes"][i]
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    size = 58
    while size > 38 and max(tw(d, l, f(size), 2) for l in lines) > 940:
        size -= 2
    lead = size + 32
    y0 = 620 - len(lines)*lead/2
    for k, l in enumerate(lines):
        centered(img, y0 + k*lead, l, size, INK, sp=2, glow=True)
    ry = y0 + len(lines)*lead + 30
    rule(img, ry, w=96, h=7)
    centered(img, ry + 40, f"— {who}", 36, MUTED, sp=4)
    img.save(f"ov_quote{i+1}.png")
    print(f"ov_quote{i+1}.png  {size}px  上端 y={y0:.0f}  下端 y={ry+76:.0f}")

def qr_image():
    """QRを用意する。URLがあれば生成し、無ければ手持ちの画像、どちらも無ければNone。"""
    if LINE_URL:
        import qrcode
        q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
        q.add_data(LINE_URL); q.make(fit=True)
        im = q.make_image(fill_color="#06C755", back_color="white").convert("RGBA")
        print(f"  QRを生成: {LINE_URL}")
        return im.resize((QR_SIZE, QR_SIZE), Image.NEAREST)   # 最近傍でセルの角を保つ
    if os.path.exists(QR_FILE):
        print(f"  QR画像を使用: {QR_FILE}")
        return Image.open(QR_FILE).convert("RGBA").resize((QR_SIZE, QR_SIZE), Image.LANCZOS)
    return None

def end_card(t):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    centered(img, 360, t["end_head"],  72, INK, sp=3, glow=True)
    centered(img, 452, t["end_head2"], 72, INK, sp=3, glow=True)
    rule(img, 600)

    # LINEカード（白地に角丸、QRとラベル）
    CW, CH, CY = 560, 620, 670
    cx0 = (W - CW)/2
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([cx0, CY, cx0+CW, CY+CH], radius=36, fill=(255,255,255,250),
                        outline=tuple(SKYL)+(255,), width=3)
    qr = qr_image()
    if qr is not None:
        img.alpha_composite(qr, (int((W-QR_SIZE)/2), CY+42))
    else:
        # QRが未設定のときは、貼る位置が分かる枠を描く
        qx0, qy0 = (W-QR_SIZE)/2, CY+42
        d.rounded_rectangle([qx0, qy0, qx0+QR_SIZE, qy0+QR_SIZE], radius=16,
                            outline=tuple(MUTED)+(180,), width=4)
        fh = f(34)
        for k, line in enumerate(("LINEのQRを", "ここに入れます")):
            draw_sp(d, (W - tw(d, line, fh, 2))/2, qy0+QR_SIZE/2-46+k*52, line, fh,
                    tuple(MUTED)+(230,), 2)
    fl = f(42)
    draw_sp(d, (W - tw(d, t["end_label"], fl, 3))/2, CY+508, t["end_label"], fl, tuple(INK)+(255,), 3)

    # 許可番号は法定の表示なので、読める大きさとコントラストを確保する
    fll = f(31)
    draw_sp(d, (W - tw(d, t["licence"], fll, 1))/2, 1322, t["licence"], fll, tuple(MUTED)+(255,), 1)
    img.save("ov_end.png"); print("ov_end.png  カード下端 y=", CY+CH, " 最下端 y=", 1322+31)

if __name__ == "__main__":
    print(f"テーマ: {TOPIC}  出力: {TEXTS['out']}.mp4")
    title_card(TEXTS)
    if "quotes" in TEXTS:
        for i in range(len(TEXTS["quotes"])):
            quote_card(i, TEXTS)
    else:
        for i in range(3):
            step_card(i, TEXTS)
    end_card(TEXTS)
