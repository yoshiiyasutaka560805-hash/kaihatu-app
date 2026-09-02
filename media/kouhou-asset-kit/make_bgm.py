"""広報・採用リール用のBGM（オリジナル合成 / ロイヤリティフリー）

3曲を書き出す。すべて15.000秒ちょうど、-14 LUFS前後、
スマホの内蔵スピーカーで聞こえる帯域（300Hz-3kHz中心）にミックスしてある。

  bgm_akarui.wav   明るい・前向き   100BPM  採用・募集向け
  bgm_odayaka.wav  おだやか・信頼    84BPM  施設紹介・日常の様子
  bgm_maeuki.wav   背中を押す       108BPM  締め・行動喚起
"""
import numpy as np, wave

SR = 48000

def note(name):
    base = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    n = base[name[0]]; i = 1
    if name[1] in '#b':
        n += 1 if name[1] == '#' else -1; i = 2
    return 440.0*2**((12*(int(name[i:])+1)+n-69)/12.0)


class Track:
    def __init__(self, bpm, dur=15.0):
        self.bpm, self.dur = bpm, dur
        self.beat = 60.0/bpm
        self.bar = 4*self.beat
        self.n = int(SR*dur)
        self.L = np.zeros(self.n); self.R = np.zeros(self.n)

    def add(self, t, sig, pan=0.0):
        s = int(t*SR)
        if s < 0:
            sig = sig[-s:]; s = 0
        e = min(self.n, s+len(sig))
        if e <= s: return
        seg = sig[:e-s]
        self.L[s:e] += seg*np.sqrt((1-pan)/2)*np.sqrt(2)
        self.R[s:e] += seg*np.sqrt((1+pan)/2)*np.sqrt(2)


def epiano(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (      np.sin(2*np.pi*f*t)
         + 0.55*np.sin(2*np.pi*2*f*t + 0.4)*np.exp(-t*2.4)
         + 0.34*np.sin(2*np.pi*3*f*t + 1.1)*np.exp(-t*3.4)
         + 0.20*np.sin(2*np.pi*4*f*t + 0.7)*np.exp(-t*5.0)
         + 0.28*np.sin(2*np.pi*f*1.004*t))
    return sig*np.exp(-t*1.5)*(1-np.exp(-t*220))*amp*0.34

def pad(f, dur, amp=1.0):
    """やわらかい持続音。おだやかな曲の土台。"""
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*t) + 0.5*np.sin(2*np.pi*f*1.006*t)
         + 0.35*np.sin(2*np.pi*2*f*t) + 0.12*np.sin(2*np.pi*3*f*t))
    a = np.minimum(1.0, t/0.45)
    r = np.minimum(1.0, np.maximum(0.0, (dur-t)/0.7))
    trem = 1+0.06*np.sin(2*np.pi*0.7*t)
    return sig*a*r*trem*amp*0.16

def pluck(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*t) + 0.45*np.sin(2*np.pi*2*f*t)*np.exp(-t*8)
         + 0.22*np.sin(2*np.pi*3*f*t)*np.exp(-t*12))
    return sig*np.exp(-t*7.0)*(1-np.exp(-t*400))*amp*0.30

def bell(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*t) + 0.48*np.sin(2*np.pi*2*f*t)*np.exp(-t*4.5)
         + 0.22*np.sin(2*np.pi*3.01*f*t)*np.exp(-t*8.0)
         + 0.12*np.sin(2*np.pi*4.02*f*t)*np.exp(-t*12.0))
    return sig*np.exp(-t*2.6)*(1-np.exp(-t*350))*amp*0.52

def bass(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (0.55*np.sin(2*np.pi*f*t) + 0.85*np.sin(2*np.pi*2*f*t)
         + 0.45*np.sin(2*np.pi*3*f*t)*np.exp(-t*3))
    sig = np.tanh(sig*1.8)/1.8
    e = np.minimum(1.0, t/0.010)*np.exp(-t*1.4)*np.minimum(1.0, np.maximum(0.0,(dur-t)/0.09))
    return sig*e*amp*0.34

def kick(amp=1.0):
    n = int(0.26*SR); t = np.arange(n)/SR
    body = np.sin(2*np.pi*np.cumsum(190*np.exp(-t*26)+62)/SR)*np.exp(-t*11)
    mid = 0.45*np.sin(2*np.pi*(320*np.exp(-t*40)+120)*t)*np.exp(-t*26)
    click = np.random.RandomState(1).randn(n)*np.exp(-t*180)*0.22
    return np.tanh((body+mid+click)*1.5)*amp*0.52

def clap(amp=1.0, seed=2):
    n = int(0.19*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-0.55], mode='same')
    body = 0.4*np.sin(2*np.pi*230*t)*np.exp(-t*26)+0.25*np.sin(2*np.pi*410*t)*np.exp(-t*32)
    return (nz*np.exp(-t*20)+body)*amp*0.34

def hat(amp=1.0, seed=3, dur=0.06):
    n = int(dur*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-1.9,1.1], mode='same')
    return nz*np.exp(-t*62)*amp*0.30

def shaker(amp=1.0, seed=5):
    n = int(0.09*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-1.4,0.6], mode='same')
    return nz*np.exp(-t*34)*amp*0.14


def finish(tr, name, tilt_lo=-5.5):
    """リバーブ・ティルトEQ・フェード・正規化して書き出す"""
    L, R, n = tr.L, tr.R, tr.n

    def verb(x):
        out = x.copy()
        for d, g in ((0.029,0.26),(0.051,0.20),(0.083,0.15),(0.127,0.10),(0.181,0.06)):
            s = int(d*SR); out[s:] += x[:-s]*g
        return out
    wet = 0.26
    L = L*(1-wet*0.5) + verb(L)*wet
    R = R*(1-wet*0.5) + verb(R)*wet

    def tilt(x):
        X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1/SR)
        g = np.interp(np.log10(np.maximum(f,1.0)),
                      np.log10([1,40,70,120,200,320,600,1200,3000,6000,12000,20000]),
                      [-40,-22,-10,tilt_lo,-2.5,-0.5,2.0,3.0,3.0,2.0,0.0,-3.0])
        return np.fft.irfft(X*10**(g/20.0), n=len(x))
    L, R = tilt(L), tilt(R)

    mx = max(np.abs(L).max(), np.abs(R).max())
    L, R = L/mx, R/mx
    L = np.tanh(L*1.6)/np.tanh(1.6); R = np.tanh(R*1.6)/np.tanh(1.6)
    fi, fo = int(0.20*SR), int(1.5*SR)
    w = np.ones(n); w[:fi] = np.linspace(0,1,fi); w[-fo:] = np.linspace(1,0,fo)**1.3
    L *= w; R *= w
    peak = max(np.abs(L).max(), np.abs(R).max())
    L *= 0.94/peak; R *= 0.94/peak

    pcm = (np.stack([L,R],axis=1)*32767).astype('<i2').tobytes()
    with wave.open(name,'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
    P = np.abs(np.fft.rfft((L+R)/2*np.hanning(n)))**2
    fr = np.fft.rfftfreq(n,1/SR)
    print(f"{name}: {tr.dur}s  500Hz以上 {100*P[fr>=500].sum()/P.sum():.0f}%")


# ── 1. 明るい・前向き（採用・募集） ──────────────────────────
def akarui():
    tr = Track(100.0)
    B, BAR = tr.beat, tr.bar
    prog  = [['E4','G4','C5'], ['F4','A4','C5'], ['G4','B4','D5'], ['E4','G4','C5'],
             ['A4','C5','E5'], ['G4','B4','D5']]
    roots = ['C2','F2','G2','C2','A2','G2']
    mel = [(0,0,'G5',.7),(0,1.5,'C6',.6),(0,3,'E5',.6),
           (1,0,'A5',.7),(1,2,'F5',.7),
           (2,0,'B5',.6),(2,1.5,'D6',.7),(2,3,'G5',.6),
           (3,0,'C6',.9),(3,2,'E5',.7),
           (4,0,'E6',.7),(4,1.5,'C6',.6),(4,3,'A5',.7),
           (5,0,'D6',1.4),(5,2,'G5',1.6)]
    nb = int(tr.dur/BAR)+1
    for b in range(min(6, nb)):
        t0 = b*BAR
        ch = prog[b]
        for off, g in ((0.0,1.0),(2.5*B,0.6)):
            for i, nm in enumerate(ch):
                tr.add(t0+off+i*0.009, epiano(note(nm), 1.9, amp=0.60*g), pan=-0.28+0.56*i/2)
        for k in range(8):
            nm = ch[k % 3]
            tr.add(t0+k*0.5*B+(0.03*B if k%2 else 0),
                   pluck(note(nm)*(2.0 if k>=4 else 1.0), 0.45,
                         amp=0.32 if k%2==0 else 0.20), pan=0.22)
        rf = note(roots[b])
        tr.add(t0, bass(rf, B*1.7))
        tr.add(t0+2*B, bass(rf, B*0.8, amp=0.74))
        tr.add(t0, kick(1.0)); tr.add(t0+2*B, kick(0.85))
        if b < 5: tr.add(t0+3.5*B, kick(0.45))
        tr.add(t0+1*B, clap(0.9, seed=10+b)); tr.add(t0+3*B, clap(0.85, seed=20+b))
        for k in range(8):
            tr.add(t0+k*0.5*B+(0.03*B if k%2 else 0),
                   hat(1.0 if k%2==0 else 0.6, seed=30+b*8+k), pan=0.2)
    for bar, beat, nm, dl in mel:
        tr.add(bar*BAR+beat*B, bell(note(nm), dl, amp=0.60), pan=-0.12)
    finish(tr, 'bgm_akarui.wav')


# ── 2. おだやか・信頼（施設紹介） ────────────────────────────
def odayaka():
    tr = Track(84.0)
    B, BAR = tr.beat, tr.bar
    prog  = [['F4','A4','C5','E5'], ['E4','G4','B4','D5'], ['D4','F4','A4','C5'],
             ['G4','B4','D5'],      ['C4','E4','G4','B4'], ['C4','E4','G4','B4']]
    roots = ['F2','E2','D2','G2','C2','C2']
    mel = [(0,1.0,'C5',1.2),(0,3.0,'A4',1.0),
           (1,1.0,'B4',1.2),(1,3.0,'G4',1.0),
           (2,0.5,'A4',1.0),(2,2.5,'F4',1.4),
           (3,1.0,'B4',1.0),(3,3.0,'D5',1.2),
           (4,0.5,'E5',1.6),(4,3.0,'G4',1.0),
           (5,0.5,'C5',2.6)]
    for b in range(6):
        t0 = b*BAR
        for i, nm in enumerate(prog[b]):
            tr.add(t0, pad(note(nm), BAR*1.05, amp=0.85), pan=-0.3+0.6*i/max(1,len(prog[b])-1))
        for off, g in ((0.0,0.85),(2.0*B,0.5)):
            for i, nm in enumerate(prog[b][:3]):
                tr.add(t0+off+i*0.012, epiano(note(nm), 2.2, amp=0.40*g), pan=-0.2+0.4*i/2)
        rf = note(roots[b])
        tr.add(t0, bass(rf, B*2.2, amp=0.85))
        if b < 5:
            tr.add(t0+2*B, shaker(1.0, seed=40+b), pan=0.25)
            tr.add(t0+3*B, shaker(0.7, seed=50+b), pan=-0.25)
    for bar, beat, nm, dl in mel:
        tr.add(bar*BAR+beat*B, bell(note(nm), dl, amp=0.52), pan=-0.1)
    finish(tr, 'bgm_odayaka.wav', tilt_lo=-4.5)


# ── 3. 背中を押す（締め・行動喚起） ──────────────────────────
def maeuki():
    tr = Track(108.0)
    B, BAR = tr.beat, tr.bar
    prog  = [['D4','F4','A4'], ['C4','E4','G4'], ['B3','D4','G4'], ['A3','C4','F4'],
             ['C4','E4','G4'], ['C4','E4','G4','C5']]
    roots = ['D2','C2','G2','F2','C2','C2']
    mel = [(0,0,'A5',.6),(0,2,'D6',.7),
           (1,0,'G5',.6),(1,1.5,'E5',.6),(1,3,'C6',.7),
           (2,0,'B5',.7),(2,2,'G5',.7),
           (3,0,'A5',.6),(3,1.5,'F5',.6),(3,3,'C6',.8),
           (4,0,'E6',.8),(4,2,'G5',.7),
           (5,0,'C6',2.0),(5,2,'E6',1.6)]
    for b in range(6):
        t0 = b*BAR
        ch = prog[b]
        for off, g in ((0.0,1.0),(1.5*B,0.55),(3.0*B,0.5)):
            for i, nm in enumerate(ch):
                tr.add(t0+off+i*0.008, epiano(note(nm), 1.6, amp=0.58*g),
                       pan=-0.26+0.52*i/max(1,len(ch)-1))
        for k in range(8):
            tr.add(t0+k*0.5*B, pluck(note(ch[k%len(ch)])*2.0, 0.38,
                                     amp=0.26 if k%2==0 else 0.16), pan=0.24)
        rf = note(roots[b])
        tr.add(t0, bass(rf, B*1.6)); tr.add(t0+1.5*B, bass(rf, B*0.7, amp=0.7))
        tr.add(t0+3*B, bass(rf*1.5, B*0.6, amp=0.6))
        tr.add(t0, kick(1.0)); tr.add(t0+1.5*B, kick(0.6)); tr.add(t0+2*B, kick(0.9))
        tr.add(t0+1*B, clap(0.95, seed=60+b)); tr.add(t0+3*B, clap(0.9, seed=70+b))
        for k in range(8):
            tr.add(t0+k*0.5*B, hat(1.0 if k%2==0 else 0.65, seed=80+b*8+k), pan=0.2)
    for bar, beat, nm, dl in mel:
        tr.add(bar*BAR+beat*B, bell(note(nm), dl, amp=0.58), pan=-0.12)
    finish(tr, 'bgm_maeuki.wav')


if __name__ == '__main__':
    akarui(); odayaka(); maeuki()
