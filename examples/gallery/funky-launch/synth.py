"""Funk track for the Miraiclip launch video. 108 BPM, E dorian, 19 bars (~42.2 s).
Arrangement (bars, 1-based):
  1-2   night intro: soft Rhodes chords + hats
  3-4   kick + muted bass enter (prompt typing)
  5-14  full groove (drop on bar 5) with clav stabs, horn hits on section changes
  15-16 breakdown: drums thin out + riser into the drop (export moment)
  17-18 full groove + horn stabs (end card)
  19    final hit + tail
Writes funk.wav (48 kHz stereo).
"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
BPM = 108
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
BARS = 19
N = int(SR * (BARS * BAR + 2.5))
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)

def t_of(bar, step16, swing=0.0):
    # swing delays every odd 16th
    t = (bar - 1) * BAR + step16 * S16
    if step16 % 2 == 1:
        t += swing * S16
    return t

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan))
    R[i:j] += s * np.sqrt(0.5 * (1 + pan))

def env(n, a=0.002, d=0.2, sustain=0.0, length=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * (sustain + (1 - sustain) * np.exp(-t / d))
    return e

def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)

def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)

def note(m):
    return 440 * 2 ** ((m - 69) / 12)

# ---------- drum voices ----------
def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 9)
    click = rng.standard_normal(n) * np.exp(-t * 400) * 0.3
    return np.tanh((body + click) * 1.6) * 0.9

def snare(ghost=False):
    n = int(0.25 * SR); t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1200, 9000) * np.exp(-t * (28 if not ghost else 45))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    s = noise * 0.9 + tone * 0.6
    return s * (0.18 if ghost else 0.75)

def hat(open_=False):
    n = int((0.32 if open_ else 0.06) * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7000, 4) * np.exp(-t * (9 if open_ else 70))
    return x * (0.22 if open_ else 0.16)

def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        k = int(off * SR); e[k:] += np.exp(-(t[: n - k]) * 38)
    return x * e * 0.35

# ---------- tonal voices ----------
def bass(m, dur, slap=False):
    n = int((dur + 0.05) * SR); t = np.arange(n) / SR
    f = note(m)
    saw = 2 * ((t * f) % 1) - 1
    sq = np.sign(np.sin(2 * np.pi * f * t))
    x = 0.6 * saw + 0.4 * sq
    cutoff_env = 300 + 1800 * np.exp(-t * (30 if slap else 18))
    # time-varying LP approximation: blend two filters
    lo = lp(x, 260); hi = lp(x, 2200)
    w = (cutoff_env - 300) / 1800
    y = lo * (1 - w) + hi * w
    sub = np.sin(2 * np.pi * f * t) * 0.6
    a = env(n, 0.003, dur * 0.9, 0.55)
    gate = np.ones(n); rel = int(0.04 * SR); gate[-rel:] = np.linspace(1, 0, rel)
    return np.tanh((y + sub) * 1.4) * a * gate * 0.55

def rhodes(chord, dur):
    n = int((dur + 0.6) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in chord:
        f = note(m)
        out += (np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3))) / len(chord)
    trem = 1 + 0.15 * np.sin(2 * np.pi * 5 * t)
    return out * env(n, 0.005, 1.4, 0.0) * trem * 0.5

def clav(chord):
    n = int(0.16 * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in chord:
        f = note(m)
        x = 2 * ((t * f) % 1) - 1
        out += x / len(chord)
    out = bp(out, 600, 4000)
    return out * np.exp(-t * 26) * 0.55

def horn(chord, dur):
    n = int((dur + 0.15) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in chord:
        f = note(m)
        for det in (-0.004, 0.004):
            out += (2 * ((t * f * (1 + det)) % 1) - 1) / (2 * len(chord))
    bright = lp(out, 3200)
    a = np.minimum(1, t / 0.015) * np.exp(-t * 3.5)
    gate = np.ones(n); rel = int(0.08 * SR); gate[-rel:] = np.linspace(1, 0, rel)
    return np.tanh(bright * 2) * a * gate * 0.4

def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    seg = n // 24
    for k in range(24):
        fc = 400 * (16 ** (k / 23))
        out[k * seg:(k + 1) * seg] = bp(x[k * seg:(k + 1) * seg], fc * 0.7, min(fc * 1.4, 20000))
    return out * (t / dur) ** 2 * 0.5

def boom():
    n = int(1.8 * SR); t = np.arange(n) / SR
    f = 40 + 60 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * 0.9

# ---------- harmony ----------
E9 = [52, 56, 59, 62, 66]       # E G# B D F#  (E9)
A13 = [57, 61, 64, 67, 71]      # A C# E G B   (A13-ish)
Em9 = [52, 55, 59, 62, 66]
CLAV_E = [64, 67, 71, 74]       # E G B D (Em7 high)
CLAV_A = [64, 67, 69, 73]       # A7 colours
HORN_HIT = [64, 68, 71, 74]     # E7 hit

# Bass line per bar (16th steps, midi, length in 16ths, slap?)
BASS_A = [(0, 28, 2, True), (3, 40, 1, True), (4, 28, 1, False), (6, 31, 1, True), (7, 33, 2, False),
          (10, 28, 1, True), (11, 40, 1, True), (12, 38, 2, False), (14, 35, 1, True), (15, 36, 1, False)]
BASS_B = [(0, 33, 2, True), (3, 45, 1, True), (4, 33, 1, False), (6, 36, 1, True), (7, 37, 2, False),
          (10, 33, 1, True), (11, 45, 1, True), (12, 31, 2, False), (14, 30, 1, True), (15, 31, 1, False)]

KICK = [0, 3, 7, 10, 12]  # syncopated
SNARE = [4, 12]
GHOSTS = [6, 9, 14, 15]
SW = 0.12

def bar_drums(b, full=True, light=False):
    for s in range(16):
        if not (light and s % 2):
            add(hat(open_=(s == 14 and full)), t_of(b, s, SW), 1.0, 0.25)
    if light:
        return
    for s in KICK:
        add(kick(), t_of(b, s, SW))
    if full:
        for s in SNARE:
            add(snare(), t_of(b, s, SW), 1.0, -0.05)
            add(clap(), t_of(b, s, SW), 0.7, 0.1)
        for s in GHOSTS:
            add(snare(ghost=True), t_of(b, s, SW), 1.0, -0.1)

def bar_bass(b, line):
    for s, m, ln, slap in line:
        add(bass(m, ln * S16 * 0.92, slap), t_of(b, s, SW), 1.0, 0.0)

def bar_keys(b, chord, dur_bars=1):
    add(rhodes(chord, dur_bars * BAR * 0.95), t_of(b, 0), 0.9, -0.3)

def bar_clav(b, chord):
    for s in (2, 5, 8, 11, 13):
        add(clav(chord), t_of(b, s, SW), 1.0, 0.35)

for b in range(1, BARS + 1):
    even = b % 2 == 0
    chord = A13 if even else E9
    line = BASS_B if even else BASS_A
    cl = CLAV_A if even else CLAV_E
    if b <= 2:
        bar_drums(b, full=False, light=True)
        bar_keys(b, Em9 if b == 1 else A13)
    elif b <= 4:
        bar_drums(b, full=False)
        bar_bass(b, line)
        bar_keys(b, chord)
        if b == 4:
            add(riser(BAR), t_of(4, 0), 0.8)
    elif b <= 14:
        bar_drums(b)
        bar_bass(b, line)
        bar_clav(b, cl)
        if b % 4 == 1:
            bar_keys(b, chord, 2)
    elif b <= 16:
        bar_drums(b, full=(b == 15), light=(b == 16))
        bar_keys(b, chord)
        if b == 15:
            bar_bass(b, line)
        if b == 16:
            add(riser(BAR), t_of(16, 0), 1.0)
    elif b <= 18:
        bar_drums(b)
        bar_bass(b, line)
        bar_clav(b, cl)
        if b == 17:
            bar_keys(b, chord, 2)
    else:
        add(kick(), t_of(b, 0)); add(boom(), t_of(b, 0), 0.8)
        add(horn(HORN_HIT, BEAT * 1.5), t_of(b, 0), 1.0, 0.1)
        add(rhodes(E9, BAR * 1.2), t_of(b, 0), 0.8)
        add(hat(open_=True), t_of(b, 0))

# horn hits on section changes (bar starts)
for b in (5, 7, 9, 11, 13, 15, 17):
    add(horn(HORN_HIT if b % 4 == 1 else [69, 73, 76, 79], BEAT * 0.45), t_of(b, 0), 1.0, 0.1)
    add(horn(HORN_HIT, BEAT * 0.3), t_of(b, 3, SW), 0.7, 0.1)
add(boom(), t_of(5, 0), 0.7)
add(boom(), t_of(17, 0), 0.7)

# master: glue
mix = np.stack([L, R])
mix = np.tanh(mix * 1.15)
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89
# fade tail
fade = int(1.2 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)
import wave
pcm = (mix.T * 32767).astype(np.int16)
with wave.open("funk.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("seconds", N / SR, "bar", BAR, "beat", BEAT)
