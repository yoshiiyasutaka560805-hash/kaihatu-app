"""Lienetの投稿用 背景ループ（1080×1920 / 30fps / 6秒 / 継ぎ目なし）

  bg_air.mp4   ほぼ白に水色とミントの光がゆっくり動く。本文カット用。
  bg_sky.mp4   淡い水色を強めた版。タイトル・エンドカード用。

どちらも明るいので、文字は濃紺（INK）で乗せる。
"""
import numpy as np, subprocess, sys, os
from palette import PAPER, SKYL, SKY, MINT, CORAL

W, H, FPS, DUR = 540, 960, 30, 6.0
NF = int(FPS*DUR)
FFMPEG = os.environ.get("FF", "ffmpeg")
yy, xx = np.mgrid[0:H, 0:W]
X, Y = xx/W, yy/H
A = lambda c: np.array(c, float)

def encode(name, frames):
    p = subprocess.Popen(
        [FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p",
         "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-g", str(NF),
         "-movflags", "+faststart", name], stdin=subprocess.PIPE)
    for fr in frames:
        p.stdin.write(np.clip(fr, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()
    print(f"{name}: {DUR}s ({NF}f) 1080x1920")

def blob(cx, cy, r, aspect=0.62):
    d = np.sqrt(((X-cx)*aspect)**2 + (Y-cy)**2)
    return np.clip(1 - (d/r)**2, 0, 1)**2

def build(strength, grain_seed=8):
    """白い地に水色・ミントの光をのせる。strengthで濃さを変える。"""
    grain = np.random.RandomState(grain_seed).randn(H, W)*1.6
    for i in range(NF):
        p = 2*np.pi*i/NF
        base = A(PAPER)[None,None,:]*(1-Y[:,:,None]*0.10) + A(SKYL)[None,None,:]*(Y[:,:,None]*0.10)
        b1 = blob(0.26+0.18*np.cos(p),      0.24+0.10*np.sin(p),      0.80)
        b2 = blob(0.78+0.14*np.cos(p+2.2),  0.62+0.13*np.sin(p+2.2),  0.72)
        b3 = blob(0.46+0.20*np.cos(p+4.1),  0.98+0.09*np.sin(p+4.1),  0.62)
        b4 = blob(0.90+0.10*np.cos(p+1.0),  0.10+0.08*np.sin(p+1.0),  0.40)
        img = (base
               - (A((255,255,255))-A(SKY))[None,None,:]*b1[:,:,None]*0.26*strength
               - (A((255,255,255))-A(MINT))[None,None,:]*b2[:,:,None]*0.22*strength
               - (A((255,255,255))-A(SKYL))[None,None,:]*b3[:,:,None]*0.55*strength
               - (A((255,255,255))-A(CORAL))[None,None,:]*b4[:,:,None]*0.07*strength)
        img += grain[:,:,None]
        img *= (1 - 0.07*((X-0.5)**2 + (Y-0.5)**2))[:,:,None]
        yield img

if __name__ == '__main__':
    w = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if w in ('all','air'): encode('bg_air.mp4', build(0.62))
    if w in ('all','sky'): encode('bg_sky.mp4', build(1.00, grain_seed=21))
