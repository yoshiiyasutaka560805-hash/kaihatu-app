"""広報リール用の背景ループ（1080×1920 / 30fps / 6秒 / 継ぎ目なくループ）

  bg_gradient.mp4  濃紺のグラデーションがゆっくり動く。白文字向け。
  bg_bokeh.mp4     暖色の玉ボケが漂う。タイトル・エンドカードの下地。
  bg_paper.mp4     明るい紙地に光の帯。濃い文字を乗せる用。

色は既存アプリのパレットに合わせてある（#101A2E / #2F6FED / #FFC857 / #EEF3FB）。
すべての動きの周期を尺と一致させているので、何回繋いでも継ぎ目が出ない。
"""
import numpy as np, subprocess, sys, os

W, H = 540, 960          # 生成解像度（書き出し時に1080×1920へ拡大）
FPS, DUR = 30, 6.0
NF = int(FPS*DUR)
FFMPEG = os.environ.get("FF", "ffmpeg")

NAVY   = np.array([0x10, 0x1A, 0x2E], float)
BLUE   = np.array([0x2F, 0x6F, 0xED], float)
BLUE_L = np.array([0x7A, 0xD0, 0xFF], float)
AMBER  = np.array([0xFF, 0xC8, 0x57], float)
PAPER  = np.array([0xEE, 0xF3, 0xFB], float)
TEAL   = np.array([0x3D, 0xDC, 0x97], float)

yy, xx = np.mgrid[0:H, 0:W]
X = xx/W
Y = yy/H

def encode(name, frames_iter):
    p = subprocess.Popen(
        [FFMPEG, "-y", "-v", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p",
         "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-g", str(NF),
         "-movflags", "+faststart", name],
        stdin=subprocess.PIPE)
    for fr in frames_iter:
        p.stdin.write(np.clip(fr, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()
    print(f"{name}: {DUR}s ({NF}f) 1080x1920")

def blob(cx, cy, r, aspect=1.0):
    d = np.sqrt(((X-cx)*aspect)**2 + (Y-cy)**2)
    return np.clip(1 - (d/r)**2, 0, 1)**2

# ── 1. 濃紺のグラデーション ─────────────────────────────
def gradient():
    for i in range(NF):
        p = 2*np.pi*i/NF
        base = NAVY[None,None,:]*(1-Y[:,:,None]*0.35) + BLUE[None,None,:]*(Y[:,:,None]*0.35)
        b1 = blob(0.30+0.16*np.cos(p),       0.28+0.10*np.sin(p),       0.75, 0.62)
        b2 = blob(0.74+0.13*np.cos(p+2.1),   0.70+0.12*np.sin(p+2.1),   0.68, 0.62)
        b3 = blob(0.50+0.20*np.cos(p+4.0),   0.95+0.08*np.sin(p+4.0),   0.55, 0.62)
        img = (base
               + BLUE_L[None,None,:]*b1[:,:,None]*0.42
               + AMBER[None,None,:] *b2[:,:,None]*0.30
               + TEAL[None,None,:]  *b3[:,:,None]*0.14)
        img *= (1 - 0.42*((X-0.5)**2*1.15 + (Y-0.5)**2*0.7))[:,:,None]   # 周辺減光
        yield img

# ── 2. 玉ボケ ───────────────────────────────────────────
def bokeh():
    rs = np.random.RandomState(4)
    n = 26
    bx = rs.uniform(0, 1, n)
    by = rs.uniform(0, 1, n)
    br = rs.uniform(0.045, 0.16, n)
    ba = rs.uniform(0.10, 0.34, n)
    bc = np.array([AMBER if rs.rand() < 0.62 else BLUE_L for _ in range(n)])
    drift = rs.uniform(0.5, 1.5, n)          # 1周で上に流れる量（整数でなくてよい）
    for i in range(NF):
        p = i/NF
        base = NAVY[None,None,:]*(1-Y[:,:,None]*0.20) + \
               (NAVY*0.55+BLUE*0.45)[None,None,:]*(Y[:,:,None]*0.20)
        img = base.copy()
        for k in range(n):
            cy = (by[k] - drift[k]*p) % 1.4 - 0.2      # 画面外まで含めて循環
            g = blob(bx[k], cy, br[k])
            img += bc[k][None,None,:]*g[:,:,None]*ba[k]
        img *= (1 - 0.38*((X-0.5)**2*1.1 + (Y-0.5)**2*0.6))[:,:,None]
        yield img

# ── 3. 明るい紙地 ───────────────────────────────────────
def paper():
    grain = np.random.RandomState(8).randn(H, W)*2.4
    for i in range(NF):
        p = 2*np.pi*i/NF
        band = 0.5 + 0.5*np.sin(2*np.pi*(X*1.15 + Y*0.62) - p)
        band2 = 0.5 + 0.5*np.sin(2*np.pi*(X*0.55 - Y*0.9) + p*1.0)
        img = (PAPER[None,None,:]*(1.0 - 0.10*Y[:,:,None])
               + (BLUE*0.85)[None,None,:]*(band[:,:,None]**2)*0.30
               + AMBER[None,None,:]*(band2[:,:,None]**3)*0.26)
        img = np.minimum(img, 252)
        img += grain[:,:,None]
        img *= (1 - 0.20*((X-0.5)**2*1.2 + (Y-0.5)**2*0.8))[:,:,None]
        yield img

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('all','gradient'): encode('bg_gradient.mp4', gradient())
    if which in ('all','bokeh'):    encode('bg_bokeh.mp4',    bokeh())
    if which in ('all','paper'):    encode('bg_paper.mp4',    paper())
