"""Synthesise an original, royalty-free music bed and SFX for the Pager Go commercial.

Everything here is generated from oscillators and noise in this script, so there is
no third-party audio and no licence to clear. Requires numpy only.

    python scripts/generate_audio.py            -> writes public/audio/*.wav
"""
import os
import wave

import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
rng = np.random.default_rng(7)


def write(name, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * 0.89  # ~ -1 dBFS peak
    pcm = (x * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", name, f"{len(x) / SR:.2f}s")


def t_of(sec):
    return np.arange(int(sec * SR)) / SR


def env_ad(n, a, d):
    """Attack / exponential decay envelope, seconds."""
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / d)
    return e


def lowpass(x, cutoff):
    # one-pole low-pass, good enough for pads and noise shaping
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- music bed
def music():
    dur, bpm = 30.0, 112
    beat = 60 / bpm
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)

    # A minor -> F -> C -> G, warm and optimistic; switches to brighter lift at 17s
    prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62]]
    bar = beat * 4

    def add(sig, start, pan=0.0, gain=1.0):
        s = int(start * SR)
        if s >= n:
            return
        e = min(n, s + len(sig))
        L[s:e] += sig[: e - s] * gain * (1 - pan) / 1.0
        R[s:e] += sig[: e - s] * gain * (1 + pan) / 1.0

    # pad: detuned saws, low-passed, slow attack
    for b in range(int(dur / bar) + 1):
        chord = prog[b % 4]
        tt = t_of(bar + 0.3)
        sig = np.zeros_like(tt)
        for m in chord:
            for det in (-0.08, 0.08):
                f = note(m + 12) * (1 + det / 100)
                sig += ((tt * f) % 1.0 - 0.5)
        sig = lowpass(sig, 1400 if b * bar < 17 else 2400)
        sig *= np.minimum(tt / 0.6, 1) * np.minimum((bar + 0.3 - tt) / 0.4, 1)
        add(sig, b * bar, 0.0, 0.05)

        # bass
        root = chord[0] - 12
        for k in range(4):
            tb = t_of(beat * 0.9)
            bs = np.sin(2 * np.pi * note(root) * tb) + 0.3 * np.sin(4 * np.pi * note(root) * tb)
            add(bs * env_ad(len(tb), 0.005, 0.25), b * bar + k * beat, 0, 0.22 if b * bar >= 5 else 0.1)

        # pluck arpeggio from scene 2 on
        if b * bar >= 4.8:
            arp = chord + [chord[1] + 12]
            for k in range(8):
                tp = t_of(0.4)
                f = note(arp[k % len(arp)] + 12)
                pl = (np.sin(2 * np.pi * f * tp) + 0.4 * np.sin(4 * np.pi * f * tp)) * env_ad(len(tp), 0.002, 0.12)
                add(pl, b * bar + k * beat / 2, 0.35 if k % 2 else -0.35, 0.09)

    # drums: kick on beats, hats on off-beats, enter at scene 2, fuller at scene 4
    nb = int(dur / beat)
    for k in range(nb):
        tk = k * beat
        if tk < 4.8 or tk > 29.0:
            continue
        tt = t_of(0.35)
        f = 50 + 90 * np.exp(-tt * 30)
        kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(tt), 0.001, 0.12)
        add(kick, tk, 0, 0.55)
        hat = rng.standard_normal(int(0.05 * SR))
        hat = hat - lowpass(hat, 7000)
        add(hat * env_ad(len(hat), 0.001, 0.015), tk + beat / 2, 0.2, 0.12)
        if tk >= 17 and k % 2 == 1:
            sn = rng.standard_normal(int(0.2 * SR))
            sn = lowpass(sn, 5000) * env_ad(len(sn), 0.001, 0.06)
            add(sn, tk, -0.1, 0.25)

    out = np.stack([L, R], axis=1)
    fade = np.ones(n)
    fade[: int(0.5 * SR)] = np.linspace(0, 1, int(0.5 * SR))
    fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
    return out * fade[:, None]


# ---------------------------------------------------------------- SFX
def crowd():
    """Restaurant murmur: band-limited noise with slow, voice-like amplitude movement."""
    n = int(5.5 * SR)
    x = rng.standard_normal(n)
    x = lowpass(x, 900) - lowpass(x, 180)
    mod = lowpass(rng.standard_normal(n), 4) * 40 + 1
    clink_t = [0.7, 1.9, 3.1, 4.2]
    for c in clink_t:
        tt = t_of(0.4)
        cl = np.sin(2 * np.pi * 3200 * tt) * env_ad(len(tt), 0.001, 0.05) * 0.4
        s = int(c * SR)
        x[s : s + len(cl)] += cl * np.std(x) * 6
    e = np.minimum(t_of(5.5) / 0.4, 1) * np.minimum((5.5 - t_of(5.5)) / 0.8, 1)
    return x * np.clip(mod, 0.4, 2) * e


def whoosh(d=0.6):
    n = int(d * SR)
    x = rng.standard_normal(n)
    tt = np.arange(n) / n
    lo = np.empty(n)
    acc = 0.0
    for i in range(n):
        c = 300 + 5000 * np.sin(np.pi * tt[i])
        a = np.exp(-2 * np.pi * c / SR)
        acc = (1 - a) * x[i] + a * acc
        lo[i] = acc
    return lo * np.sin(np.pi * tt) ** 2


def pop():
    tt = t_of(0.25)
    f = 300 + 900 * np.exp(-tt * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(tt), 0.002, 0.07)


def beep_scan():
    tt = t_of(0.35)
    a = np.sin(2 * np.pi * 1760 * tt) * env_ad(len(tt), 0.003, 0.05)
    b = np.zeros_like(tt)
    s = int(0.11 * SR)
    b[s:] = np.sin(2 * np.pi * 2349 * tt[: len(tt) - s]) * env_ad(len(tt) - s, 0.003, 0.08)
    return a + b


def tap():
    tt = t_of(0.08)
    return np.sin(2 * np.pi * 1200 * tt) * env_ad(len(tt), 0.0005, 0.012)


def chime_ready():
    """Bright three-note 'order ready' chime plus pager buzz."""
    out = np.zeros(int(1.6 * SR))
    for i, m in enumerate([76, 79, 84]):
        tt = t_of(1.6 - i * 0.12)
        f = note(m)
        s = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2.01 * tt)) * env_ad(len(tt), 0.003, 0.45)
        o = int(i * 0.12 * SR)
        out[o : o + len(s)] += s
    buzz_t = t_of(0.5)
    buzz = np.sign(np.sin(2 * np.pi * 150 * buzz_t)) * (np.sin(2 * np.pi * 9 * buzz_t) > 0) * 0.12
    buzz = lowpass(buzz, 1200)
    o = int(0.5 * SR)
    out[o : o + len(buzz)] += buzz
    return out


def logo_hit():
    tt = t_of(2.5)
    boom = np.sin(2 * np.pi * np.cumsum(45 + 60 * np.exp(-tt * 8)) / SR) * env_ad(len(tt), 0.002, 0.6)
    shimmer = np.zeros_like(tt)
    for m in [72, 76, 79, 84, 88]:
        shimmer += np.sin(2 * np.pi * note(m) * tt) * env_ad(len(tt), 0.01, 0.9) * 0.18
    noise = rng.standard_normal(len(tt))
    noise = (noise - lowpass(noise, 6000)) * env_ad(len(tt), 0.001, 0.25) * 0.3
    return boom + shimmer + noise


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    write("music-bed.wav", music())
    write("sfx-crowd.wav", crowd())
    write("sfx-whoosh.wav", whoosh())
    write("sfx-pop.wav", pop())
    write("sfx-scan.wav", beep_scan())
    write("sfx-tap.wav", tap())
    write("sfx-ready.wav", chime_ready())
    write("sfx-logo.wav", logo_hit())
