#!/usr/bin/env python3
"""
Time Weave — bande-son électronique minimale (60 s, 120 BPM, 48 kHz, stéréo).

Entièrement synthétisée avec numpy : pad additif, kick, charleston, basse, arpèges
pincés, effets calés sur les repères de l'animation (out/cues.json, écrit par
`node render.cjs cues`). Sortie : out/music.wav.
"""
import json
import math
import os
import wave

import numpy as np

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5  # 120 BPM
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
rs = np.random.default_rng(7)

with open(os.path.join(OUT, "cues.json")) as f:
    DATA = json.load(f)
CUES = DATA["cues"]
ZOOM = np.array(DATA["zoom"])


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tline(n):
    return np.arange(n) / SR


class Bus:
    def __init__(self):
        self.l = np.zeros(N + SR * 4)
        self.r = np.zeros(N + SR * 4)

    def add(self, t0, sig, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), len(self.l) - i)
        if n <= 0:
            return
        gl = gain * math.cos((pan + 1) * math.pi / 4) * math.sqrt(2)
        gr = gain * math.sin((pan + 1) * math.pi / 4) * math.sqrt(2)
        if sig.ndim == 1:
            self.l[i:i + n] += sig[:n] * gl
            self.r[i:i + n] += sig[:n] * gr
        else:
            self.l[i:i + n] += sig[0, :n] * gl
            self.r[i:i + n] += sig[1, :n] * gr

    def stereo(self):
        return np.stack([self.l, self.r])


def spectral(sig, fn):
    """Filtre statique par FFT : fn(freqs) → gain."""
    n = len(sig)
    m = 1 << (n - 1).bit_length()
    S = np.fft.rfft(sig, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    return np.fft.irfft(S * fn(f), m)[:n]


def lp(sig, fc, order=2):
    return spectral(sig, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def hp(sig, fc, order=2):
    return spectral(sig, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bp(sig, fc, q=1.0):
    return spectral(sig, lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) * q * 2) ** 2))


def sweep_noise(dur, f0, f1, q=1.2, shape=None):
    """Bruit filtré à bande glissante (STFT), pour les souffles."""
    n = int(dur * SR)
    x = rs.standard_normal(n + 4096)
    win, hop = 2048, 512
    out = np.zeros(n + 4096)
    wnd = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for s in range(0, n, hop):
        u = s / max(1, n)
        fc = f0 * (f1 / f0) ** (u if shape is None else shape(u))
        g = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / fc) * q * 2) ** 2)
        fr = np.fft.irfft(np.fft.rfft(x[s:s + win] * wnd) * g, win)
        out[s:s + win] += fr * wnd
    out = out[:n]
    return out / (np.max(np.abs(out)) + 1e-9)


def env_ad(n, a, d):
    t = tline(n)
    e = np.where(t < a, t / max(a, 1e-6), np.exp(-(t - a) / d))
    return e


def bell(freq, dur=1.6, decay=0.6, bright=1.0):
    n = int(dur * SR)
    t = tline(n)
    s = np.zeros(n)
    for ratio, amp, dk in [(1, 1, 1), (2.0, 0.35 * bright, 0.6), (2.76, 0.28 * bright, 0.45), (5.4, 0.12 * bright, 0.25), (8.93, 0.05 * bright, 0.15)]:
        s += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / (decay * dk))
    s *= np.minimum(1, t / 0.002)
    return s / 1.8


def pluck(freq, dur=0.9, decay=0.22, bright=0.6):
    n = int(dur * SR)
    t = tline(n)
    s = np.zeros(n)
    for h in range(1, 7):
        s += (bright ** (h - 1)) / h * np.sin(2 * np.pi * freq * h * t + h) * np.exp(-t / (decay / (1 + 0.5 * (h - 1))))
    s *= np.minimum(1, t / 0.003)
    return s


def click(dur=0.03, tone=2200, noise=0.6):
    n = int(dur * SR)
    t = tline(n)
    s = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.006)
    s += noise * hp(rs.standard_normal(n), 3000) * np.exp(-t / 0.002)
    return s


def kick(dur=0.45):
    n = int(dur * SR)
    t = tline(n)
    f = 46 + 95 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.17)
    s += 0.25 * lp(rs.standard_normal(n), 2500) * np.exp(-t / 0.004)
    return np.tanh(1.4 * s)


def hat(dur=0.06, open_=False):
    n = int(dur * SR)
    t = tline(n)
    s = hp(rs.standard_normal(n), 7000, 3) * np.exp(-t / (0.05 if open_ else 0.014))
    return s


def rim(dur=0.12):
    n = int(dur * SR)
    t = tline(n)
    s = bp(rs.standard_normal(n), 1800, 1.4) * np.exp(-t / 0.03)
    s += 0.5 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.012)
    return s


# ───────────────────────── Harmonie ─────────────────────────
CH = {
    "Am9": (33, [57, 60, 64, 67, 71]),
    "Fmaj9": (29, [53, 57, 60, 64, 67]),
    "Cmaj9": (36, [55, 59, 60, 64, 62]),
    "G6": (31, [55, 59, 62, 64, 69]),
    "Dm9": (38, [53, 57, 60, 62, 64]),
    "Em7": (28, [55, 59, 62, 64, 67]),
}
SECTIONS = [
    (0, 6, "Am9"), (6, 12, "Fmaj9"), (12, 16, "Am9"), (16, 20, "Cmaj9"), (20, 24, "Fmaj9"), (24, 28, "G6"),
    (28, 32, "Am9"), (32, 36, "Fmaj9"), (36, 40, "Dm9"), (40, 44, "Fmaj9"), (44, 48, "Am9"), (48, 53.2, "Em7"),
    (53.2, 55.35, "Fmaj9"), (55.35, 60, "Cmaj9"),
]


def chord_at(t):
    for a, b, c in SECTIONS:
        if a <= t < b:
            return CH[c]
    return CH["Cmaj9"]


pad, bass, arp, drums, sfx, verb_send = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()

# Pad additif, voix désaccordées, souffle lent
for a, b, name in SECTIONS:
    root, notes = CH[name]
    rel = 1.2
    n = int((b - a + rel) * SR)
    t = tline(n)
    sl = np.zeros(n)
    sr_ = np.zeros(n)
    for j, m in enumerate(notes):
        for v, det in enumerate([-0.07, 0.0, 0.07]):
            f = hz(m) * 2 ** (det / 12)
            ph = rs.uniform(0, 2 * np.pi)
            voice = np.zeros(n)
            for h in range(1, 6):
                voice += (1 / h ** 1.8) * np.sin(2 * np.pi * f * h * t + ph * h)
            lfo = 0.75 + 0.25 * np.sin(2 * np.pi * (0.11 + 0.03 * j) * t + j + v)
            p = (v - 1) * 0.6 + (j - 2) * 0.1
            sl += voice * lfo * math.cos((p + 1) * math.pi / 4)
            sr_ += voice * lfo * math.sin((p + 1) * math.pi / 4)
    att = 0.35 if a > 0 else 3.0
    env = np.minimum(1, t / att) * np.where(t > (b - a), np.exp(-(t - (b - a)) / 0.35), 1)
    pad.add(a, np.stack([sl * env, sr_ * env]), gain=0.075 * (1.7 if a < 6 else 1.25 if a >= 52 else 1.0))

# Batterie
def in_ranges(t, ranges):
    return any(x0 <= t < x1 for x0, x1 in ranges)

KICK_ON = [(8.0, 12.0), (14.5, 53.2)]
K = kick()
kick_times = []
for i in range(int(60 / BEAT)):
    t = i * BEAT
    if in_ranges(t, KICK_ON):
        drums.add(t, K, 0.3)
        kick_times.append(t)
HAT_ON = [(8.0, 53.2)]
for i in range(int(60 / (BEAT / 2))):
    t = i * BEAT / 2
    if not in_ranges(t, HAT_ON):
        continue
    off = (i % 2) == 1
    if off:
        drums.add(t, hat(0.09, open_=(i % 8 == 7)), 0.08 if 12 <= t < 14.5 else 0.12, pan=0.25)
    elif t >= 20 and t < 53:
        drums.add(t, hat(0.04), 0.035, pan=-0.3)
for i in range(int(60 / BEAT)):
    t = i * BEAT
    if 20 <= t < 53 and (i % 4) in (1, 3):
        drums.add(t, rim(), 0.08, pan=-0.15)
        verb_send.add(t, rim(), 0.05)

# Basse sur les contretemps
for i in range(int(60 / (BEAT / 2))):
    t = i * BEAT / 2
    if not (8.0 <= t < 53.2) or (i % 2) == 0:
        continue
    if 12.0 <= t < 14.5 and i % 4 != 1:
        continue
    root, _ = chord_at(t)
    f = hz(root + 12)
    n = int(0.32 * SR)
    tt = tline(n)
    s = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) + 0.08 * np.sin(2 * np.pi * 3 * f * tt)
    s *= np.minimum(1, tt / 0.004) * np.exp(-tt / 0.13)
    bass.add(t, np.tanh(1.6 * s), 0.12)

# Arpèges pincés (16es), à partir du zoom
arp_r = np.random.default_rng(11)
for i in range(int(60 / (BEAT / 4))):
    t = i * BEAT / 4
    if not (12.0 <= t < 53.2):
        continue
    step = i % 16
    pattern = [1, 0, 0.6, 0, 0.8, 0, 0.5, 0.4, 1, 0, 0.6, 0.3, 0.8, 0, 0.5, 0]
    g = pattern[step]
    if g == 0 or arp_r.random() > 0.82:
        continue
    _, notes = chord_at(t)
    seq = sorted(notes) + [m + 12 for m in sorted(notes)]
    m = seq[(i * 3) % len(seq)] + 12
    bright = 0.45 if t < 20 else 0.6
    s = pluck(hz(m), 0.8, 0.16, bright)
    pan = 0.45 if (i % 2) else -0.45
    amp = 0.065 * g * (0.6 if 12 <= t < 14.5 else 1.0)
    arp.add(t, s, amp, pan)
    verb_send.add(t, s, amp * 0.6)

# ───────────────────────── Effets calés sur l'image ─────────────────────────
PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88]
for c in CUES:
    t, ty = c["t"], c["type"]
    if ty == "line":
        s = sweep_noise(1.1, 300, 4000, 1.4, shape=lambda u: u ** 0.7) * np.hanning(int(1.1 * SR))
        sfx.add(t, s, 0.05)
        b = bell(hz(76), 2.5, 0.9)
        sfx.add(t + 0.9, b, 0.07)
        verb_send.add(t + 0.9, b, 0.08)
    elif ty == "sweep":
        for k in range(13):
            u = k / 12
            sfx.add(t + u * c["d"], click(0.02, 3000 + 600 * u, 0.3), 0.05 * math.sin(math.pi * (0.1 + 0.8 * u)), pan=-0.6 + 1.2 * u)
    elif ty == "title":
        for j, m in enumerate([64, 71, 76]):
            b = bell(hz(m + 12), 3.0, 1.1, 0.6)
            sfx.add(t + j * 0.06, b, 0.05, pan=(j - 1) * 0.4)
            verb_send.add(t + j * 0.06, b, 0.07)
    elif ty == "lift":
        n = int(1.4 * SR)
        s = sweep_noise(1.4, 400, 6000, 1.0, shape=lambda u: u ** 1.5) * np.linspace(0, 1, n) ** 2
        sfx.add(t, s, 0.07)
    elif ty == "pullback":
        n = int(c["d"] * SR)
        s = sweep_noise(c["d"], 5000, 250, 0.9, shape=lambda u: 1 - (1 - u) ** 2)
        s *= np.minimum(1, tline(n) / 0.05) * np.exp(-tline(n) / 0.9)
        sfx.add(t, s, 0.12)
        verb_send.add(t, s, 0.05)
        nb = int(1.8 * SR)
        tb = tline(nb)
        boom = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-tb * 5)) / SR) * np.exp(-tb / 0.6)
        sfx.add(t + 0.15, boom, 0.32)
    elif ty == "unfold":
        m = [69, 72, 76, 79, 81, 84][c["i"]]
        s = pluck(hz(m), 1.0, 0.25, 0.5)
        sfx.add(t, s, 0.07, pan=-0.3 + 0.12 * c["i"])
        verb_send.add(t, s, 0.06)
    elif ty == "click":
        tgt = c.get("target")
        if tgt == "drag":
            continue
        tone = 1300 if tgt == "live" else 2100
        sfx.add(t, click(0.03, tone, 0.45), 0.16, pan=0.15)
    elif ty == "keyjump":
        m = [76, 79, 83][c["i"]]
        b = bell(hz(m + 12), 1.6, 0.5, 0.8)
        sfx.add(t, b, 0.07, pan=-0.2 + 0.2 * c["i"])
        verb_send.add(t, b, 0.07)
        sfx.add(t, pluck(hz(m), 0.6, 0.12, 0.5), 0.05)
    elif ty == "wrap":
        n = int(0.6 * SR)
        s = sweep_noise(0.6, 4000, 600, 1.2) * np.hanning(n)
        sfx.add(t - 0.25, s, 0.06)
        for j, m in enumerate([81, 76, 72, 69]):
            sfx.add(t + j * 0.06, pluck(hz(m), 0.5, 0.1, 0.5), 0.05, pan=0.5 - j * 0.33)
    elif ty == "pending":
        d = c["d"]
        k = 0
        while k * 0.125 < d:
            tt = t + k * 0.125
            s = bp(rs.standard_normal(int(0.03 * SR)), 2600 if k % 2 == 0 else 2000, 2.0) * np.exp(-tline(int(0.03 * SR)) / 0.005)
            sfx.add(tt, s, 0.07, pan=0.3 if k % 2 else -0.3)
            k += 1
    elif ty == "back":
        n = int(0.3 * SR)
        tt = tline(n)
        s = np.sin(2 * np.pi * np.cumsum(600 + 900 * tt / 0.3) / SR) * np.hanning(n)
        sfx.add(t, s, 0.03)
    elif ty == "ready":
        small = c.get("small", False)
        for j, m in enumerate([76, 83] if not small else [83]):
            b = bell(hz(m + 12), 2.2, 0.8, 0.7)
            sfx.add(t + j * 0.07, b, 0.08 if not small else 0.05, pan=(j - 0.5) * 0.5)
            verb_send.add(t + j * 0.07, b, 0.1)
        nb = int(0.5 * SR)
        tb = tline(nb)
        sfx.add(t, np.sin(2 * np.pi * 70 * tb) * np.exp(-tb / 0.15), 0.15 if not small else 0.08)
    elif ty == "live":
        nb = int(0.9 * SR)
        tb = tline(nb)
        sfx.add(t, np.sin(2 * np.pi * np.cumsum(55 + 40 * np.exp(-tb * 8)) / SR) * np.exp(-tb / 0.35), 0.3)
        b = bell(hz(81), 1.2, 0.35, 0.4)
        sfx.add(t, b, 0.05)
    elif ty == "arrive":
        m = PENTA[int(abs(hash(round(t * 100))) % len(PENTA))] + 12
        pan = {"calls": -0.5, "radio": 0.4, "alerts": 0.0}.get(c["row"], 0.0)
        s = np.sin(2 * np.pi * hz(m) * tline(int(0.25 * SR))) * np.exp(-tline(int(0.25 * SR)) / 0.05)
        sfx.add(t, s, 0.018, pan=pan)
        verb_send.add(t, s, 0.02)
    elif ty == "drag":
        n = int(c["d"] * SR)
        s = lp(rs.standard_normal(n), 900) * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
        sfx.add(t, s, 0.09, pan=0.2)
    elif ty == "return":
        n = int(c["d"] * SR)
        s = sweep_noise(c["d"], 500, 5000, 1.1, shape=lambda u: u ** 0.8) * np.sin(np.pi * np.linspace(0, 1, n))
        sfx.add(t, s, 0.07)
        b = bell(hz(81 + 12), 1.4, 0.5, 0.6)
        sfx.add(t + c["d"], b, 0.05)
    elif ty == "swap":
        n = int(c["d"] * SR)
        s = sweep_noise(c["d"], 800, 3200, 1.3) * np.hanning(n)
        sfx.add(t, s, 0.05)
        for j, m in enumerate([72, 79]):
            sfx.add(t + 0.3 + j * 0.08, pluck(hz(m), 0.6, 0.15, 0.5), 0.05, pan=(j - 0.5) * 0.6)
    elif ty == "mapIn":
        n = int(0.8 * SR)
        s = sweep_noise(0.8, 2500, 500, 1.0) * np.hanning(n)
        sfx.add(t, s, 0.06, pan=0.5)
        b = bell(hz(81), 1.5, 0.6, 0.5)
        sfx.add(t + 0.35, b, 0.05, pan=0.5)
        verb_send.add(t + 0.35, b, 0.06)
    elif ty == "theme":
        d = c["d"]
        n = int((d + 0.3) * SR)
        s = sweep_noise(d + 0.3, 5000, 400, 0.9) * np.sin(np.pi * np.linspace(0, 1, n))
        sfx.add(t - 0.05, s, 0.08, pan=-0.3 + 0.3 * c["i"])
        m = [76, 79, 84][c["i"]]
        b = bell(hz(m + 12), 1.8, 0.7, 0.6)
        sfx.add(t + d * 0.6, b, 0.06, pan=-0.3 + 0.3 * c["i"])
        verb_send.add(t + d * 0.6, b, 0.08)
        tb = tline(int(1.0 * SR))
        sfx.add(t, np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tb * 1.5) + 35) / SR) * np.exp(-tb / 0.4) * np.minimum(1, tb / 0.05), 0.12)
    elif ty == "wipe":
        d = c["d"]
        n = int((d + 0.6) * SR)
        s = sweep_noise(d + 0.6, 6000, 200, 0.8) * np.sin(np.pi * np.minimum(1, np.linspace(0, 1.3, n)))
        sfx.add(t - 0.1, s, 0.11, pan=0.0)
        tb = tline(int(2.0 * SR))
        sub = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-tb * 0.8) + 30) / SR) * np.exp(-tb / 0.9) * np.minimum(1, tb / 0.2)
        sfx.add(t, sub, 0.22)
        verb_send.add(t, s, 0.04)
    elif ty == "key":
        n = int(0.06 * SR)
        tt = tline(n)
        s = 0.7 * np.sin(2 * np.pi * 170 * tt) * np.exp(-tt / 0.012) + hp(rs.standard_normal(n), 2500) * np.exp(-tt / 0.004) * 0.6
        sfx.add(t, s, 0.14, pan=-0.1)
        sfx.add(t + 0.09, hp(rs.standard_normal(int(0.02 * SR)), 3500) * np.exp(-tline(int(0.02 * SR)) / 0.003), 0.04)
    elif ty in ("modalOpen", "modalClose"):
        n = int(0.12 * SR)
        tt = tline(n)
        f0, f1 = (480, 820) if ty == "modalOpen" else (760, 420)
        s = np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * tt / 0.12) / SR) * np.exp(-tt / 0.05)
        sfx.add(t, s, 0.09)
        verb_send.add(t, s, 0.06)
        if ty == "modalOpen":
            sfx.add(t + 0.05, bell(hz(88), 1.0, 0.4, 0.5), 0.035)
    elif ty == "outro":
        n = int(1.2 * SR)
        s = sweep_noise(1.2, 3000, 300, 1.0) * np.exp(-tline(n) / 0.5)
        sfx.add(t, s, 0.06)
    elif ty == "logoLine":
        sfx.add(t, click(0.03, 3200, 0.3), 0.06)
        b = bell(hz(84), 2.0, 0.8, 0.5)
        sfx.add(t + 0.02, b, 0.05)
        verb_send.add(t, b, 0.06)
    elif ty == "strand":
        m = [72, 76, 79][c["i"]]
        s = pluck(hz(m), 1.4, 0.35, 0.55)
        sfx.add(t, s, 0.08, pan=(c["i"] - 1) * 0.5)
        verb_send.add(t, s, 0.08)
    elif ty == "logo":
        for j, m in enumerate([48, 55, 64, 71, 74]):
            b = bell(hz(m + 12), 5.0, 1.8, 0.5)
            sfx.add(t + j * 0.035, b, 0.05, pan=(j - 2) * 0.3)
            verb_send.add(t + j * 0.035, b, 0.09)
        nb = int(3 * SR)
        tb = tline(nb)
        sfx.add(t, np.sin(2 * np.pi * hz(36) * tb) * np.exp(-tb / 1.2) * np.minimum(1, tb / 0.01), 0.25)
    elif ty == "tagline":
        for j in range(3):
            sfx.add(t + j * 0.14, click(0.02, 2600 + 300 * j, 0.2), 0.04, pan=-0.4 + 0.4 * j)

# Tonalité de zoom : la hauteur suit l'échelle visible, le volume suit la vitesse du zoom
zt = ZOOM[:, 0]
zl = ZOOM[:, 1]
i0, i1 = int(zt[0] * SR), int(zt[-1] * SR)
ts = np.arange(i0, i1) / SR
lz = np.interp(ts, zt, zl)
speed = np.abs(np.gradient(lz, 1 / SR))
speed = np.convolve(speed, np.ones(2400) / 2400, mode="same")
freq = 110 * 2 ** ((12.4 - lz) / 12.4 * 3.6)
ph = 2 * np.pi * np.cumsum(freq) / SR
tone = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * (0.1 + 0.9 * np.clip(speed / 3.0, 0, 1))
tone *= np.clip((ts - zt[0]) / 0.6, 0, 1) * np.clip((zt[-1] - ts) / 0.6, 0, 1)
air = bp(rs.standard_normal(len(ts)), 3000, 0.6) * np.clip(speed / 3.0, 0, 1)
air /= np.max(np.abs(air)) + 1e-9
sfx.add(zt[0], tone, 0.05)
sfx.add(zt[0], air, 0.035)
verb_send.add(zt[0], tone, 0.03)

# ───────────────────────── Mixage ─────────────────────────
L = len(pad.l)
# compression latérale par le kick
side = np.zeros(L)
for t in kick_times:
    i = int(t * SR)
    n = min(int(0.4 * SR), L - i)
    side[i:i + n] = np.maximum(side[i:i + n], np.exp(-tline(n) / 0.11))
duck = 1 - 0.5 * side

def st(bus):
    return bus.stereo()

mix = st(pad) * duck * 1.0 + st(bass) * duck + st(arp) * (1 - 0.25 * side) + st(drums) + st(sfx)

# écho ping-pong sur les arpèges
arp_s = st(arp)
echo = np.zeros_like(arp_s)
for k in range(1, 6):
    sh = int(k * 0.375 * SR)
    g = 0.42 ** k
    src = arp_s[(k + 1) % 2]
    echo[k % 2, sh:] += src[:-sh] * g
mix += lp(echo[0], 3500)[None, :] * np.array([[1], [0]]) + lp(echo[1], 3500)[None, :] * np.array([[0], [1]])

# réverbération à convolution (réponse synthétique)
ir_n = int(2.8 * SR)
ti = tline(ir_n)
ir = np.stack([rs.standard_normal(ir_n), rs.standard_normal(ir_n)]) * np.exp(-ti / 0.55)
ir[:, : int(0.018 * SR)] = 0
ir = np.stack([lp(ir[0], 5000), lp(ir[1], 5000)])
ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
send = st(verb_send) + st(pad) * 0.5 + st(arp) * 0.4
m = 1 << (L + ir_n).bit_length()
wet = np.stack([np.fft.irfft(np.fft.rfft(send[c], m) * np.fft.rfft(ir[c], m), m)[:L] for c in range(2)])
mix += wet * 0.55

mix = mix[:, :N]
mix = np.stack([hp(mix[0], 28), hp(mix[1], 28)])
# fondus
fade_in = np.clip(tline(N) / 0.02, 0, 1)
fade_out = np.clip((DUR - tline(N)) / 1.6, 0, 1) ** 1.5
mix *= fade_in * fade_out
# limiteur doux
rms = np.sqrt(np.mean(mix ** 2))
mix *= 0.115 / rms
mix = np.tanh(mix * 1.15) / 1.15
mix *= 0.89 / np.max(np.abs(mix))

pcm = (mix.T * 32767).astype(np.int16)
os.makedirs(OUT, exist_ok=True)
with wave.open(os.path.join(OUT, "music.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"out/music.wav · {DUR:.0f} s · RMS {20 * math.log10(np.sqrt(np.mean(mix ** 2))):.1f} dBFS · crête {20 * math.log10(np.max(np.abs(mix))):.1f} dBFS")
