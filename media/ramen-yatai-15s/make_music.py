"""屋台ラーメン15秒リールのBGM (オリジナル / ロイヤリティフリー)

96BPM・4拍子・6小節 = ちょうど15.000秒。
コード進行: Fmaj7 - Em7 - Dm7 - G7 - Cmaj7 - Cmaj9

ミックスは「スマホのスピーカーで聞こえること」を最優先にしている。
小型スピーカーは 400Hz 以下をほとんど再生しないので、
主役（コード・メロディ・アルペジオ）は 300Hz-3kHz に置き、
ベースは倍音で聞かせ、最後にFFTでティルトEQをかけて低域を削っている。
"""
import numpy as np, wave

SR, BPM, DUR = 48000, 96.0, 15.0
BEAT = 60.0/BPM
BAR  = 4*BEAT
N    = int(SR*DUR)
L = np.zeros(N); R = np.zeros(N)

def note(name):
    base = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    n = base[name[0]]; i = 1
    if name[1] in '#b':
        n += 1 if name[1] == '#' else -1; i = 2
    return 440.0*2**((12*(int(name[i:])+1)+n-69)/12.0)

def add(t, sig, pan=0.0):
    s = int(t*SR)
    if s < 0:
        sig = sig[-s:]; s = 0
    e = min(N, s+len(sig))
    if e <= s: return
    seg = sig[:e-s]
    L[s:e] += seg*np.sqrt((1-pan)/2)*np.sqrt(2)
    R[s:e] += seg*np.sqrt((1+pan)/2)*np.sqrt(2)

def epiano(f, dur, amp=1.0):
    """エレピ風。倍音を多めに残して小型スピーカーでも芯が出るように。"""
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (      np.sin(2*np.pi*f*t)
         + 0.55*np.sin(2*np.pi*2*f*t + 0.4)*np.exp(-t*2.4)
         + 0.34*np.sin(2*np.pi*3*f*t + 1.1)*np.exp(-t*3.4)
         + 0.20*np.sin(2*np.pi*4*f*t + 0.7)*np.exp(-t*5.0)
         + 0.10*np.sin(2*np.pi*6*f*t)*np.exp(-t*7.0)
         + 0.28*np.sin(2*np.pi*f*1.004*t))
    return sig*np.exp(-t*1.5)*(1-np.exp(-t*220))*amp*0.34

def pluck(f, dur, amp=1.0):
    """アルペジオ用のプラック。中域に存在感を作る。"""
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (      np.sin(2*np.pi*f*t)
         + 0.45*np.sin(2*np.pi*2*f*t)*np.exp(-t*8)
         + 0.22*np.sin(2*np.pi*3*f*t)*np.exp(-t*12)
         + 0.11*np.sin(2*np.pi*5*f*t)*np.exp(-t*18))
    return sig*np.exp(-t*7.0)*(1-np.exp(-t*400))*amp*0.30

def bell(f, dur, amp=1.0):
    """メロディ（ベル/マリンバ風）。曲の主役。"""
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (      np.sin(2*np.pi*f*t)
         + 0.48*np.sin(2*np.pi*2*f*t)*np.exp(-t*4.5)
         + 0.22*np.sin(2*np.pi*3.01*f*t)*np.exp(-t*8.0)
         + 0.12*np.sin(2*np.pi*4.02*f*t)*np.exp(-t*12.0))
    return sig*np.exp(-t*2.6)*(1-np.exp(-t*350))*amp*0.52

def bass(f, dur, amp=1.0):
    """基音は控えめ、倍音（2倍・3倍）で聞かせるベース。"""
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (0.55*np.sin(2*np.pi*f*t)
         + 0.85*np.sin(2*np.pi*2*f*t)
         + 0.45*np.sin(2*np.pi*3*f*t)*np.exp(-t*3)
         + 0.18*np.sin(2*np.pi*4*f*t)*np.exp(-t*5))
    sig = np.tanh(sig*1.8)/1.8
    e = np.minimum(1.0, t/0.010)*np.exp(-t*1.4)*np.minimum(1.0, np.maximum(0.0, (dur-t)/0.09))
    return sig*e*amp*0.34

def kick(amp=1.0):
    """サブは削り、150-250Hz の胴鳴りとアタックで聞かせる。"""
    n = int(0.26*SR); t = np.arange(n)/SR
    f = 190*np.exp(-t*26)+62
    body = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*11)
    mid  = 0.45*np.sin(2*np.pi*(320*np.exp(-t*40)+120)*t)*np.exp(-t*26)
    click = np.random.RandomState(1).randn(n)*np.exp(-t*180)*0.22
    return np.tanh((body+mid+click)*1.5)*amp*0.52

def snare(amp=1.0, seed=2):
    n = int(0.19*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-0.55], mode='same')
    body = 0.40*np.sin(2*np.pi*230*t)*np.exp(-t*26) + 0.25*np.sin(2*np.pi*410*t)*np.exp(-t*32)
    return (nz*np.exp(-t*20)+body)*amp*0.34

def hat(amp=1.0, seed=3, dur=0.06):
    n = int(dur*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-1.9,1.1], mode='same')
    return nz*np.exp(-t*62)*amp*0.30

# ルートレス・ボイシングを4-5オクターブに置く（=スマホで聞こえる帯域）
CHORDS = [['A4','C5','E5'], ['G4','B4','D5'], ['F4','A4','C5'],
          ['F4','B4','D5'], ['E4','G4','B4'], ['E4','G4','B4','D5']]
ARPS   = [['A4','C5','E5','C5'], ['G4','B4','D5','B4'], ['F4','A4','C5','A4'],
          ['F4','B4','D5','B4'], ['E4','G4','B4','G4'], ['E4','G4','B4','D5']]
ROOTS  = ['F2','E2','D2','G2','C2','C2']
SWING  = 0.035

for b in range(6):
    t0 = b*BAR
    # コード: 1拍目と2拍半（lo-fiのノリ）
    for off, g, dl in ((0.0, 1.00, 2.1), (2.5*BEAT, 0.66, 1.7)):
        if b == 5 and off > 0:
            g, dl = 0.60, 2.7
        for i, nm in enumerate(CHORDS[b]):
            pan = -0.30 + 0.6*(i/max(1, len(CHORDS[b])-1))
            add(t0+off+i*0.009, epiano(note(nm), dl, amp=0.62*g), pan=pan)
    # アルペジオ: 8分で動きを付ける
    for k in range(8):
        if b == 5 and k > 3: break
        nm = ARPS[b][k % len(ARPS[b])]
        f = note(nm)*(2.0 if k >= 4 else 1.0)
        tt = t0 + k*0.5*BEAT + (SWING*BEAT if k % 2 else 0)
        add(tt, pluck(f, 0.5, amp=(0.34 if k % 2 == 0 else 0.22)), pan=0.22)
    # ベース
    rf = note(ROOTS[b])
    for off, f, dl, g in ((0.0, rf, BEAT*1.7, 1.0),
                          (2.0*BEAT, rf, BEAT*0.8, 0.74),
                          (3.5*BEAT, rf*1.5, BEAT*0.5, 0.62)):
        if b == 5 and off > 0: continue
        add(t0+off, bass(f, dl, amp=g))
    # ドラム
    add(t0,          kick(1.00))
    add(t0+2.0*BEAT, kick(0.84))
    if b < 5:
        add(t0+3.5*BEAT, kick(0.45))
    add(t0+1.0*BEAT, snare(0.90, seed=10+b))
    add(t0+3.0*BEAT, snare(0.85, seed=20+b))
    for k in range(8):
        if b == 5 and k > 4: break
        add(t0 + k*0.5*BEAT + (SWING*BEAT if k % 2 else 0),
            hat(1.0 if k % 2 == 0 else 0.62, seed=30+b*8+k), pan=0.20)

# メロディ (Cメジャー・ペンタトニック / D5-A5 = 587-880Hz)
MEL = [(0,0.0,'A5',0.9,1.00), (0,1.5,'C6',0.6,0.72), (0,3.0,'A5',0.6,0.72),
       (1,0.0,'B5',0.8,0.90), (1,2.0,'G5',0.8,0.82),
       (2,0.0,'A5',0.7,0.92), (2,1.5,'F5',0.7,0.80), (2,3.0,'D5',0.8,0.78),
       (3,0.0,'G5',0.8,0.92), (3,1.5,'B5',0.7,0.82), (3,3.0,'D5',0.9,0.85),
       (4,0.0,'C6',1.1,0.95), (4,2.0,'G5',0.8,0.80), (4,3.0,'E5',0.9,0.85),
       (5,0.0,'C6',2.2,0.95), (5,1.5,'G5',1.8,0.60)]
for bar, beat, nm, dl, amp in MEL:
    t = bar*BAR + beat*BEAT + (SWING*BEAT if abs(beat % 1 - 0.5) < 1e-6 else 0)
    add(t, bell(note(nm), dl, amp=amp*0.62), pan=-0.12)

# lo-fi のノイズ床（軽め）
nz = np.convolve(np.random.RandomState(7).randn(N), np.ones(5)/5, mode='same')
L += nz*0.0030; R += np.roll(nz, 157)*0.0030

def verb(x):
    out = x.copy()
    for d, g in ((0.029,0.24),(0.051,0.18),(0.083,0.13),(0.127,0.09),(0.181,0.055)):
        s = int(d*SR); out[s:] += x[:-s]*g
    return out

wet = 0.24
L = L*(1-wet*0.5) + verb(L)*wet
R = R*(1-wet*0.5) + verb(R)*wet

def tilt(x):
    """FFTでティルトEQ: 低域を落として中高域を持ち上げる（スマホ対策）"""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1/SR)
    g = np.interp(np.log10(np.maximum(f, 1.0)),
                  np.log10([1, 40, 70, 120, 200, 320, 600, 1200, 3000, 6000, 12000, 20000]),
                  [-40, -22, -10, -5.5, -2.5, -0.5, 2.0, 3.0, 3.0, 2.0, 0.0, -3.0])
    return np.fft.irfft(X*10**(g/20.0), n=len(x))

L, R = tilt(L), tilt(R)

mx = max(np.abs(L).max(), np.abs(R).max())
L, R = L/mx, R/mx
L = np.tanh(L*1.6)/np.tanh(1.6); R = np.tanh(R*1.6)/np.tanh(1.6)
fi, fo = int(0.20*SR), int(1.5*SR)
w = np.ones(N); w[:fi] = np.linspace(0,1,fi); w[-fo:] = np.linspace(1,0,fo)**1.3
L *= w; R *= w
peak = max(np.abs(L).max(), np.abs(R).max())
L *= 0.94/peak; R *= 0.94/peak

pcm = (np.stack([L,R],axis=1)*32767).astype('<i2').tobytes()
out = './music.wav'
with wave.open(out,'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
print("wrote", out, DUR, "s")
