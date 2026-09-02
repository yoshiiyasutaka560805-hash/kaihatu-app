"""リール（15秒）用のテロップPNGを作る

文字はすべて Instagram リールの安全域（上250 / 下420 / 左右60px の内側）に収める。
文言は make_reel_overlays.py の TEXTS を書き換えれば差し替わる。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from palette import DEEP, GREEN, MINT, CORAL, PAPER, INK, MUTED

W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
UI_BOTTOM = 420
SAFE_BOTTOM = H - UI_BOTTOM          # 1500

TEXTS = {
    "title1": "介護のお仕事、",
    "title2": "一人で探さない。",
    "brand":  "R I A N E T",
    "steps": [
        ("STEP 1", "希望の条件を聞かせてください", "勤務地・勤務時間・給与、なんでも"),
        ("STEP 2", "条件に合う職場をお探しします", "求人票では分からないこともお伝えします"),
        ("STEP 3", "ご相談・ご紹介は無料です",   "求職者の方から手数料はいただきません"),
    ],
    "end_head": "まずはお気軽に",
    "end_head2": "ご相談ください",
    "end_cta":  "プロフィールのリンクから",
    "licence":  "リアネット ／ 厚生労働大臣許可番号 ◯◯-ユ-◯◯◯◯◯◯",
}

def f(sz): return ImageFont.truetype(FONT, sz)

def tw(d, s, font, sp=0):
    return sum(d.textlength(c, font=font) for c in s) + sp*(len(s)-1)

def draw_sp(d, x, y, s, font, fill, sp=0):
    for c in s:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + sp

def centered(img, y, s, size, fill, sp=4, shadow=None):
    d = ImageDraw.Draw(img)
    font = f(size)
    x = (W - tw(d, s, font, sp))/2
    if shadow:
        sh = Image.new("RGBA", (W, H), (0,0,0,0))
        draw_sp(ImageDraw.Draw(sh), x+3, y+4, s, font, shadow, sp)
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(7)))
        d = ImageDraw.Draw(img)
    draw_sp(d, x, y, s, font, fill+(255,) if len(fill) == 3 else fill, sp)

def pill(img, y, h, w, color, radius=None):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(W-w)/2, y, (W+w)/2, y+h], radius=radius or h//2, fill=color+(255,))

def rule(img, y, w=132, h=9, color=None):
    ImageDraw.Draw(img).rounded_rectangle(
        [(W-w)/2, y, (W+w)/2, y+h], radius=h//2, fill=(color or MINT)+(255,))

# ── 1. タイトルカード（深い緑の背景に重ねる） ──────────────
def title_card(t):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    centered(img, 520, t["title1"], 88, (255,255,255), sp=3, shadow=(0,0,0,150))
    centered(img, 640, t["title2"], 88, (255,255,255), sp=3, shadow=(0,0,0,150))
    rule(img, 790)
    centered(img, 850, t["brand"], 34, MINT, sp=10)
    img.save("ov_title.png"); print("ov_title.png")

# ── 2-4. ステップ（明るい背景に重ねる） ───────────────────
def step_card(i, t):
    label, head, note = t["steps"][i]
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fl = f(30)
    wl = tw(d, label, fl, 8)
    pill(img, 470, 66, wl+72, GREEN, radius=33)
    draw_sp(ImageDraw.Draw(img), (W-wl)/2, 484, label, fl, (255,255,255,255), 8)
    # 見出しは1行に収まる大きさへ自動で落とす
    size = 62
    while size > 40:
        if tw(ImageDraw.Draw(img), head, f(size), 2) <= 900: break
        size -= 2
    centered(img, 610, head, size, INK, sp=2)
    centered(img, 720, note, 34, (0x4A,0x6A,0x5E), sp=1)
    img.save(f"ov_step{i+1}.png"); print(f"ov_step{i+1}.png")

# ── 5. エンドカード（深い緑の背景に重ねる） ────────────────
def end_card(t):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    centered(img, 470, t["end_head"],  76, (255,255,255), sp=3, shadow=(0,0,0,150))
    centered(img, 578, t["end_head2"], 76, (255,255,255), sp=3, shadow=(0,0,0,150))
    rule(img, 720)
    pill(img, 830, 128, 720, CORAL)
    d = ImageDraw.Draw(img)
    fc = f(44)
    draw_sp(d, (W - tw(d, t["end_cta"], fc, 3))/2, 866, t["end_cta"], fc, DEEP+(255,), 3)
    # 許可番号は法定の表示なので、読める大きさとコントラストを確保する
    fll = f(31)
    draw_sp(d, (W - tw(d, t["licence"], fll, 1))/2, 1322, t["licence"], fll, (0xC7,0xE2,0xD8,255), 1)
    img.save("ov_end.png"); print("ov_end.png  最下端 y=", 1330+27)

if __name__ == "__main__":
    title_card(TEXTS)
    for i in range(3):
        step_card(i, TEXTS)
    end_card(TEXTS)
