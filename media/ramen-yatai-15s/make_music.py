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
    midi = 12*(int(name[i:])+1)+n
    return 440.0*2**((midi-69)/12.0)

def add(t, sig, pan=0.0):
    s = int(t*SR)
    if s < 0:
        sig = sig[-s:]; s = 0
    e = min(N, s+len(sig))
    if e <= s: return
    seg = sig[:e-s]
    lg = np.sqrt((1-pan)/2)*np.sqrt(2); rg = np.sqrt((1+pan)/2)*np.sqrt(2)
    L[s:e] += seg*lg; R[s:e] += seg*rg

def epiano(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*t)
           + 0.42*np.sin(2*np.pi*f*2*t + 0.4)*np.exp(-t*3.2)
           + 0.16*np.sin(2*np.pi*f*3*t + 1.1)*np.exp(-t*5.0)
           + 0.30*np.sin(2*np.pi*f*1.003*t))
    return sig*np.exp(-t*1.35)*(1-np.exp(-t*180))*amp*0.5

def bell(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*t)
           + 0.30*np.sin(2*np.pi*f*2*t)*np.exp(-t*6.0)
           + 0.10*np.sin(2*np.pi*f*4.02*t)*np.exp(-t*11.0))
    return sig*np.exp(-t*3.0)*(1-np.exp(-t*300))*amp*0.5

def bass(f, dur, amp=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    sig = np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)*np.exp(-t*4)
    sig = np.tanh(sig*1.4)/1.4
    e = np.minimum(1.0, t/0.012)*np.exp(-t*0.9)*np.minimum(1.0, np.maximum(0.0, (dur-t)/0.10))
    return sig*e*amp*0.55

def kick(amp=1.0):
    n = int(0.30*SR); t = np.arange(n)/SR
    f = 115*np.exp(-t*22)+46
    sig = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*8.5)
    click = np.random.RandomState(1).randn(n)*np.exp(-t*260)*0.20
    return np.tanh((sig+click)*1.6)*amp*0.9

def snare(amp=1.0, seed=2):
    n = int(0.16*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-0.85], mode='same')
    body = 0.35*np.sin(2*np.pi*195*t)*np.exp(-t*30)
    return (nz*np.exp(-t*26)+body)*amp*0.30

def hat(amp=1.0, seed=3, dur=0.055):
    n = int(dur*SR); t = np.arange(n)/SR
    nz = np.convolve(np.random.RandomState(seed).randn(n), [1,-1.6,0.7], mode='same')
    return nz*np.exp(-t*70)*amp*0.16

CHORDS = [['F3','A3','C4','E4'], ['E3','G3','B3','D4'], ['D3','F3','A3','C4'],
          ['G3','B3','D4','F4'], ['C3','E3','G3','B3'], ['C3','E3','G3','B3','D5']]
ROOTS  = ['F2','E2','D2','G2','C2','C2']
SWING  = 0.035

for b in range(6):
    t0 = b*BAR
    ch = CHORDS[b]
    for off, g, dl in ((0.0, 0.95, 2.0), (2.5*BEAT, 0.62, 1.6)):
        if b == 5 and off > 0:
            g, dl = 0.55, 2.6
        for i, nm in enumerate(ch):
            pan = -0.35 + 0.7*(i/max(1, len(ch)-1))
            add(t0+off+i*0.010, epiano(note(nm), dl, amp=0.36*g), pan=pan)
    rf = note(ROOTS[b])
    for off, f, dl, g in ((0.0, rf, BEAT*1.7, 1.0),
                          (2.0*BEAT, rf, BEAT*0.8, 0.72),
                          (3.5*BEAT, rf*1.5, BEAT*0.5, 0.60)):
        if b == 5 and off > 0: continue
        add(t0+off, bass(f, dl, amp=g*0.85))
    add(t0,          kick(0.95))
    add(t0+2.0*BEAT, kick(0.80))
    if b < 5:
        add(t0+3.5*BEAT, kick(0.42))
    add(t0+1.0*BEAT, snare(0.85, seed=10+b))
    add(t0+3.0*BEAT, snare(0.80, seed=20+b))
    for k in range(8):
        if b == 5 and k > 4: break
        add(t0 + k*0.5*BEAT + (SWING*BEAT if k % 2 else 0),
            hat(0.9 if k % 2 == 0 else 0.55, seed=30+b*8+k), pan=0.18)

MEL = [(0,0.0,'A4',0.9,1.00), (0,1.5,'C5',0.7,0.85), (0,3.0,'A4',0.6,0.70),
       (1,0.0,'B4',0.9,0.95), (1,2.0,'G4',0.8,0.80),
       (2,0.0,'A4',0.7,0.95), (2,1.5,'F4',0.7,0.80), (2,3.0,'D4',0.8,0.75),
       (3,0.0,'G4',0.8,0.95), (3,1.5,'B4',0.7,0.85), (3,3.0,'D5',0.9,0.90),
       (4,0.0,'C5',1.2,1.00), (4,2.0,'G4',0.8,0.80), (4,3.0,'E5',0.9,0.85),
       (5,0.0,'C5',2.2,1.00), (5,1.5,'G5',1.8,0.55)]
for bar, beat, nm, dl, amp in MEL:
    t = bar*BAR + beat*BEAT + (SWING*BEAT if abs(beat % 1 - 0.5) < 1e-6 else 0)
    add(t, bell(note(nm), dl, amp=amp*0.30), pan=-0.10)

nz = np.convolve(np.random.RandomState(7).randn(N), np.ones(9)/9, mode='same')
L += nz*0.0045; R += np.roll(nz, 157)*0.0045

def verb(x):
    out = x.copy()
    for d, g in ((0.031,0.26),(0.053,0.20),(0.087,0.15),(0.131,0.10),(0.190,0.06)):
        s = int(d*SR); out[s:] += x[:-s]*g
    return out

wet = 0.26
L = L*(1-wet*0.5) + verb(L)*wet
R = R*(1-wet*0.5) + verb(R)*wet

mx = max(np.abs(L).max(), np.abs(R).max())
L, R = L/mx, R/mx
L = np.tanh(L*1.5)/np.tanh(1.5); R = np.tanh(R*1.5)/np.tanh(1.5)
fi, fo = int(0.25*SR), int(1.6*SR)
w = np.ones(N); w[:fi] = np.linspace(0,1,fi); w[-fo:] = np.linspace(1,0,fo)**1.3
L *= w; R *= w
peak = max(np.abs(L).max(), np.abs(R).max())
L *= 0.92/peak; R *= 0.92/peak

pcm = (np.stack([L,R],axis=1)*32767).astype('<i2').tobytes()
out = './music.wav'
with wave.open(out,'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
print("wrote", out, DUR, "s")
