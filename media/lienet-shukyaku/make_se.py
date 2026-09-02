"""リール用の効果音（オリジナル合成 / ロイヤリティフリー）

  se_whoosh.wav  カットの転換
  se_pop.wav     テロップの登場
  se_chime.wav   強調・締め
  se_tap.wav     軽いタップ

いずれもスマホで抜けるよう中高域寄り。音量は本編BGMの下に敷く前提で控えめ。
"""
import numpy as np, wave

SR = 48000

def save(name, L, R):
    mx = max(np.abs(L).max(), np.abs(R).max())
    L, R = L/mx*0.80, R/mx*0.80
    pcm = (np.stack([L,R],axis=1)*32767).astype('<i2').tobytes()
    with wave.open(name,'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
    print(f"{name}: {len(L)/SR:.2f}s")

def whoosh(dur=0.55, seed=11):
    n = int(dur*SR); t = np.arange(n)/SR
    nz = np.random.RandomState(seed).randn(n)
    # 通過音: 帯域が下から上へ動くのを一次微分フィルタの係数で近似する
    out = np.zeros(n)
    win = 1024
    for i in range(0, n-win, win//2):
        p = i/(n-win)
        k = 0.15 + 1.7*np.sin(np.pi*p)**1.2      # 中央で最も明るく
        seg = np.convolve(nz[i:i+win*2], [1, -k], mode='same')[:win]
        out[i:i+win] += seg*np.hanning(win)[:len(seg)]
    env = np.sin(np.pi*np.clip(t/dur,0,1))**1.6
    out *= env
    # ステレオを左から右へ振る
    pan = np.linspace(-0.75, 0.75, n)
    return out*np.sqrt((1-pan)/2)*np.sqrt(2), out*np.sqrt((1+pan)/2)*np.sqrt(2)

def pop(dur=0.13):
    n = int(dur*SR); t = np.arange(n)/SR
    f = 900*np.exp(-t*30) + 480
    sig = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*26)
    sig += 0.3*np.sin(2*np.pi*2*np.cumsum(f)/SR)*np.exp(-t*40)
    click = np.random.RandomState(3).randn(n)*np.exp(-t*300)*0.15
    s = (sig+click)*(1-np.exp(-t*900))
    return s, s

def chime(dur=1.6):
    n = int(dur*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    for f, a, d in ((783.99,1.0,3.0), (1174.66,0.6,3.8), (1567.98,0.35,4.6)):
        out += a*np.sin(2*np.pi*f*t)*np.exp(-t*d)
    out *= (1-np.exp(-t*400))
    # 短いディレイで広がりを付ける
    dl = int(0.045*SR)
    R = out.copy(); R[dl:] += out[:-dl]*0.4
    L = out.copy(); L[int(0.02*SR):] += out[:-int(0.02*SR)]*0.3
    return L, R

def tap(dur=0.07):
    n = int(dur*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(9).randn(n), [1,-1.7,0.8], mode='same')
    sig = nz*np.exp(-t*90) + 0.4*np.sin(2*np.pi*1300*t)*np.exp(-t*70)
    return sig, sig

if __name__ == '__main__':
    save('se_whoosh.wav', *whoosh())
    save('se_pop.wav',    *pop())
    save('se_chime.wav',  *chime())
    save('se_tap.wav',    *tap())
