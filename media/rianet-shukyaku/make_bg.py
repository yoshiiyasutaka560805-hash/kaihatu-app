"""リアネットの投稿用 背景ループ（1080×1920 / 30fps / 6秒 / 継ぎ目なし）

  bg_deep.mp4   深い緑のグラデーション。白文字向け（カード・本文）
  bg_light.mp4  明るい紙地に光の帯。濃い文字向け
"""
import numpy as np, subprocess, sys, os
from palette import DEEP, GREEN, MINT, CORAL, PAPER

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

def deep():
    for i in range(NF):
        p = 2*np.pi*i/NF
        base = A(DEEP)[None,None,:]*(1-Y[:,:,None]*0.3) + A(GREEN)[None,None,:]*(Y[:,:,None]*0.3)
        b1 = blob(0.30+0.16*np.cos(p),     0.28+0.10*np.sin(p),     0.75)
        b2 = blob(0.74+0.13*np.cos(p+2.1), 0.70+0.12*np.sin(p+2.1), 0.68)
        b3 = blob(0.50+0.20*np.cos(p+4.0), 0.96+0.08*np.sin(p+4.0), 0.55)
        img = (base + A(MINT)[None,None,:]*b1[:,:,None]*0.34
                    + A(CORAL)[None,None,:]*b2[:,:,None]*0.16
                    + A(MINT)[None,None,:]*b3[:,:,None]*0.12)
        img *= (1 - 0.40*((X-0.5)**2*1.15 + (Y-0.5)**2*0.7))[:,:,None]
        yield img

def light():
    grain = np.random.RandomState(8).randn(H, W)*2.2
    for i in range(NF):
        p = 2*np.pi*i/NF
        band  = 0.5 + 0.5*np.sin(2*np.pi*(X*1.15 + Y*0.62) - p)
        band2 = 0.5 + 0.5*np.sin(2*np.pi*(X*0.55 - Y*0.9) + p)
        img = (A(PAPER)[None,None,:]*(1.0 - 0.09*Y[:,:,None])
               + A(GREEN)[None,None,:]*(band[:,:,None]**2)*0.22
               + A(CORAL)[None,None,:]*(band2[:,:,None]**3)*0.14)
        img = np.minimum(img, 252) + grain[:,:,None]
        img *= (1 - 0.18*((X-0.5)**2*1.2 + (Y-0.5)**2*0.8))[:,:,None]
        yield img

if __name__ == '__main__':
    w = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if w in ('all','deep'):  encode('bg_deep.mp4',  deep())
    if w in ('all','light'): encode('bg_light.mp4', light())
