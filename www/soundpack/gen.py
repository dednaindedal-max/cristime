# Cristime Soundpack — собственный набор звуков, полностью сгенерирован физически-мотивированным синтезом (DSP).
# Снег: гранулярная модель разрушения снежных кристаллов (пятка → перекат → носок) + уплотнение (низкий «бух»).
# Салют: ударная N-волна + низкочастотный корпус + уличная реверберация с эхом от леса; треск — сотни микро-хлопков.
# Костёр: гул пламени + шипение + кластеры треска и щелчков поленьев (бесшовный луп).
# Дерево: модальный синтез доски (набор затухающих негармоничных мод). Колокольчики: модальные бубенцы.
import numpy as np, soundfile as sf, os
from scipy import signal
SR = 44100
OUT = '/home/user/tree1/sfx/'
rng = np.random.default_rng(2026)
os.makedirs(OUT, exist_ok=True)

def sec(t): return int(t * SR)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x)
def reson(x, f, q):
    b, a = signal.iirpeak(min(f, SR / 2 - 100), q, fs=SR); return signal.lfilter(b, a, x)
def brown(n): w = rng.standard_normal(n); b = np.cumsum(w); b -= signal.savgol_filter(b, 2001, 1) if n > 2001 else b.mean(); return b / (np.abs(b).max() + 1e-9)
def norm(x, pk=0.95): return x / (np.abs(x).max() + 1e-9) * pk
def fade(x, a=0.002, r=0.01):
    x = x.copy(); na, nr = sec(a), sec(r)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nr: x[-nr:] *= np.linspace(1, 0, nr) ** 2
    return x
def ir(decay, length, bright=6000, dark=900, early=(), wet_lp=True):
    n = sec(length); t = np.arange(n) / SR
    e = rng.standard_normal(n) * np.exp(-t * 6.9 / decay)
    # поглощение воздухом/снегом: хвост темнеет
    lo = lp(e, bright); hi_cut = lp(e, dark)
    k = np.clip(t / length * 1.6, 0, 1); e = lo * (1 - k) + hi_cut * k
    h = np.zeros(n); h[0] = 1.0
    for dt, g in early:
        i = sec(dt)
        if i < n: h[i:i + 400] += lp(rng.standard_normal(min(400, n - i)), 2500) * g * 0.35
    return h + e * 0.5
def conv(x, h, wet=0.35):
    y = signal.fftconvolve(x, h)[:len(x) + len(h) - 1]
    d = np.zeros_like(y); d[:len(x)] = x
    return d * (1 - wet) + norm(y, np.abs(x).max()) * wet
def save(name, x, pk=0.92):
    sf.write(OUT + name + '.ogg', norm(x, pk).astype('float32'), SR, format='OGG', subtype='VORBIS')

# ---------------- СНЕГ ----------------
def grain(dur_ms, f, q):
    n = max(8, sec(dur_ms / 1000)); g = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    return reson(g, f, q) * 0.6 + g * 0.4
def crunch(total=0.22, dens=650, heel=0.55, bright=1.0, thud=1.0, squeak=0.0, cold=1.0):
    n = sec(total + 0.08); y = np.zeros(n)
    # огибающая плотности: удар пятки, перекат, носок
    t = np.linspace(0, total, 400)
    dens_env = heel * np.exp(-((t - 0.03) / 0.028) ** 2) + 0.45 * np.exp(-((t - total * 0.45) / (total * 0.22)) ** 2) + 0.7 * np.exp(-((t - total * 0.8) / 0.03) ** 2)
    dens_env /= dens_env.sum(); cnt = int(dens * total)
    times = rng.choice(t, size=cnt, p=dens_env) + rng.uniform(-0.002, 0.002, cnt)
    for tt in times:
        f = rng.uniform(650, 4600) * bright * (1.0 if rng.random() > 0.2 else 0.5)
        g = grain(rng.uniform(0.25, 2.2), f, rng.uniform(2, 9)) * rng.lognormal(0, 0.7)
        i = int(max(0, tt) * SR);
        if i + len(g) < n: y[i:i + len(g)] += g
    y = lp(hp(y, 300), 7500) * cold
    # уплотнение снега под ногой — мягкий низкий «бух»
    th = lp(rng.standard_normal(sec(0.09)), 260, 3) * np.exp(-np.linspace(0, 6, sec(0.09)))
    y[:len(th)] += norm(th, np.abs(y).max() * 1.1 * thud)
    # «скрип» морозного снега — едва слышные тональные чирпы
    if squeak > 0:
        for _ in range(rng.integers(1, 3)):
            d = rng.uniform(0.03, 0.07); m = sec(d); tt = np.arange(m) / SR; f0 = rng.uniform(900, 1600)
            ch = np.sin(2 * np.pi * (f0 * tt + rng.uniform(-3000, 3000) * tt ** 2)) * np.sin(np.pi * tt / d) ** 2
            ch += 0.3 * np.sin(2 * np.pi * 2 * (f0 * tt)) * np.sin(np.pi * tt / d) ** 2
            i = sec(rng.uniform(0.05, total * 0.8)); y[i:i + m] += ch * np.abs(y).max() * squeak
    return fade(y, 0.001, 0.03)
snow_ir = ir(0.12, 0.2, 4500, 1300)
for i in range(8):
    save(f'walk{i}', conv(crunch(rng.uniform(0.2, 0.26), rng.uniform(520, 700), squeak=0.06 if i % 3 == 0 else 0), snow_ir, 0.12))
    save(f'run{i}', conv(crunch(rng.uniform(0.13, 0.17), rng.uniform(850, 1050), heel=0.9, bright=1.1, thud=1.2), snow_ir, 0.12))
for i in range(4):
    x = crunch(0.3, 1300, heel=1.4, thud=2.2, bright=0.9)
    save(f'land{i}', conv(x, snow_ir, 0.15))

# ---------------- ВЗМАХ (бросок / прыжок) ----------------
def whoosh(d=0.3, f0=500, f1=2200, f2=700, q=1.8, noisy=1.0):
    n = sec(d); t = np.linspace(0, 1, n); x = rng.standard_normal(n) * noisy
    # скользящий полосовой фильтр кусками
    y = np.zeros(n); B = 32
    fc = np.where(t < 0.55, f0 + (f1 - f0) * (t / 0.55) ** 1.5, f1 + (f2 - f1) * ((t - 0.55) / 0.45))
    for k in range(B):
        a, b = k * n // B, (k + 1) * n // B + 256
        seg = bp(x[max(0, a - 256):min(n, b)], max(80, fc[a] / q), min(SR / 2 - 200, fc[a] * q))
        y[a:min(n, (k + 1) * n // B)] += seg[(a - max(0, a - 256)):(a - max(0, a - 256)) + min(n, (k + 1) * n // B) - a]
    env = np.sin(np.pi * t) ** 1.6 * (0.6 + 0.4 * t)
    return fade(y * env, 0.005, 0.03)
for i in range(4): save(f'throw{i}', whoosh(rng.uniform(0.22, 0.3), 400, rng.uniform(1800, 2600), 900))
for i in range(3):
    j = whoosh(0.25, 300, 1400, 500, 2.2) * 0.7; c = crunch(0.1, 900, heel=1.2, thud=0.7)
    y = np.zeros(max(len(j), len(c))); y[:len(c)] += c; y[:len(j)] += norm(j, np.abs(c).max() * 0.6); save(f'jump{i}', y)

# ---------------- СНЕЖОК: попадание ----------------
def splat(strength=1.0):
    c = crunch(0.07, 2200, heel=2.0, bright=0.8, thud=1.8)
    d = sec(0.45); t = np.arange(d) / SR
    powder = bp(rng.standard_normal(d), 1200, 6500) * np.exp(-t / 0.09) * 0.35     # облачко снежной пыли
    y = np.zeros(d); y[:len(c)] += c; y += powder * np.abs(c).max()
    return fade(conv(y, snow_ir, 0.15), 0.001, 0.05)
for i in range(5): save(f'splat{i}', splat())
for i in range(2):
    s = splat(); body = lp(rng.standard_normal(sec(0.12)), 180) * np.exp(-np.linspace(0, 5, sec(0.12)))
    s[:len(body)] += norm(body, np.abs(s).max() * 0.9); save(f'hit{i}', s)

# ---------------- ДЕРЕВО: ступенька лестницы ----------------
def plank(scale=1.0):
    d = 0.35; n = sec(d); t = np.arange(n) / SR; y = np.zeros(n)
    modes = [(190, 0.11, 1), (455, 0.07, 0.8), (870, 0.05, 0.6), (1340, 0.035, 0.45), (2050, 0.022, 0.3), (2980, 0.015, 0.2)]
    for f, dec, a in modes:
        f *= scale * rng.uniform(0.96, 1.04); y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / dec)
    click = hp(rng.standard_normal(sec(0.004)), 1500) * np.exp(-np.linspace(0, 8, sec(0.004)))
    y[:len(click)] += click * 0.8
    scuff = bp(rng.standard_normal(sec(0.08)), 800, 5000) * np.exp(-np.linspace(0, 4, sec(0.08))) * 0.15   # снег с ботинка
    y[:len(scuff)] += scuff
    return fade(conv(y, ir(0.2, 0.3, 6000, 2000), 0.12), 0.0005, 0.05)
for i in range(5): save(f'rung{i}', plank(rng.uniform(0.85, 1.15)))

# ---------------- САЛЮТ ----------------
outdoor = ir(2.8, 3.2, 3500, 500, early=[(0.33, 0.8), (0.62, 0.55), (0.95, 0.35), (1.4, 0.2)])
def boom(big=1.0):
    d = 0.9; n = sec(d); t = np.arange(n) / SR; y = np.zeros(n)
    nw = np.zeros(sec(0.006)); m = len(nw); nw[:m // 2] = 1; nw[m // 2:] = -0.8                     # N-волна ударной волны
    y[:m] += lp(nw, 9000) * 1.0
    body = lp(rng.standard_normal(n), 320, 4) * np.exp(-t / (0.16 * big)); y += norm(body, 1.0) * 0.9
    ph = 2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR; y += np.sin(ph) * np.exp(-t / 0.25) * 0.8   # низкий удар
    mid = bp(rng.standard_normal(n), 300, 3200) * np.exp(-t / 0.07); y += norm(mid, 0.5)
    y = fade(y, 0.0003, 0.1)
    out = conv(y, outdoor, 0.55)
    return fade(out, 0.0003, 0.4)
def crackle(dur=1.8, cnt=160):
    n = sec(dur + 0.3); y = np.zeros(n)
    for _ in range(cnt):
        tt = rng.uniform(0, dur) ** 0.8 * dur ** 0.2; i = sec(tt)
        c = hp(rng.standard_normal(sec(0.0015)), 1500) * rng.lognormal(0, 0.6)
        c = reson(np.pad(c, (0, sec(0.01))), rng.uniform(1800, 6500), rng.uniform(3, 10))
        if i + len(c) < n: y[i:i + len(c)] += c * np.exp(-tt / dur * 1.2)
    return fade(conv(y, ir(1.2, 1.5, 5000, 900, early=[(0.3, 0.4)]), 0.35), 0.001, 0.2)
for i in range(4): save(f'boom{i}', boom(rng.uniform(0.9, 1.3)))
for i in range(3):
    b = boom(1.0); c = crackle(1.6 + i * 0.3, 140 + i * 40); y = np.zeros(max(len(b), sec(0.45) + len(c))); y[:len(b)] += b
    y[sec(0.45):sec(0.45) + len(c)] += norm(c, np.abs(b).max() * 0.45); save(f'crackle{i}', y)
def whistle(d=1.3):
    n = sec(d); t = np.arange(n) / SR
    f = 900 + 2100 * (t / d) ** 0.7 + 60 * np.sin(2 * np.pi * rng.uniform(9, 14) * t) + 25 * lp(rng.standard_normal(n), 30) * 40
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    hiss = bp(rng.standard_normal(n), 2500, 9000) * 0.5
    env = np.minimum(1, t / 0.12) * np.exp(-np.maximum(0, t - d * 0.7) / 0.15)
    y = (tone * 0.5 + hiss * 0.5) * env
    return fade(conv(y, ir(1.0, 1.2, 4000, 800), 0.3), 0.01, 0.1)
for i in range(3): save(f'whistle{i}', whistle(rng.uniform(1.1, 1.5)), 0.7)

# ---------------- ЛУПЫ: костёр, ветер, скольжение ----------------
def make_loop(x, xf=1.5):
    k = sec(xf); a = x[:k]; b = x[-k:]; w = np.linspace(0, 1, k)
    y = x[:-k].copy(); y[:k] = b * (1 - w) + a * w; return y
def fire(d=24):
    n = sec(d + 1.5); t = np.arange(n) / SR
    roar = lp(brown(n), 380, 3) * (0.7 + 0.3 * lp(rng.standard_normal(n), 0.7) * 30)
    hiss = bp(rng.standard_normal(n), 1800, 5500) * 0.035 * (0.6 + 0.4 * np.abs(lp(rng.standard_normal(n), 2) * 20))
    y = norm(roar, 0.35) + hiss; cr = np.zeros(n)
    tt = 0.0
    while tt < d + 1.4:
        tt += rng.exponential(0.16); i = sec(tt); k = rng.integers(1, 7) if rng.random() < 0.35 else 1
        for j in range(k):
            ii = i + sec(j * rng.uniform(0.004, 0.03)); c = hp(rng.standard_normal(sec(0.0012)), 1200) * rng.lognormal(-0.3, 0.8)
            c = reson(np.pad(c, (0, sec(0.012))), rng.uniform(900, 4200), rng.uniform(3, 12))
            if ii + len(c) < n: cr[ii:ii + len(c)] += c
        if rng.random() < 0.04:                                      # треснуло полено
            s = plank(rng.uniform(1.8, 2.6))[:sec(0.2)] * 0.5
            if i + len(s) < n: cr[i:i + len(s)] += s * rng.uniform(0.5, 1)
    y += norm(lp(cr, 7000), 0.7)
    return make_loop(y)
save('fire', conv(fire(), ir(0.4, 0.5, 5000, 1500), 0.1), 0.8)
def wind(d=30):
    n = sec(d + 1.5); y = np.zeros(n)
    for lo, hi, g in [(60, 220, 1.0), (180, 520, 0.6), (400, 1200, 0.25)]:
        m = lp(rng.standard_normal(n), 0.25) ; m = (m - m.min()) / (np.ptp(m) + 1e-9)
        y += bp(rng.standard_normal(n), lo, hi) * (0.25 + m ** 2) * g
    t = np.arange(n) / SR; fw = 700 + 250 * np.sin(2 * np.pi * 0.05 * t)                      # свист в хвое
    y += np.sin(2 * np.pi * np.cumsum(fw) / SR) * 0.012 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.03 * t)) * np.abs(y).max()
    return make_loop(y, 2.5)
save('wind', wind(), 0.8)
def slide(d=5):
    n = sec(d + 1); y = np.zeros(n)
    for tt in np.sort(rng.uniform(0, d + 1, int(420 * (d + 1)))):
        g = grain(rng.uniform(0.2, 1.2), rng.uniform(900, 5000), rng.uniform(2, 6)) * rng.lognormal(-0.5, 0.6); i = sec(tt)
        if i + len(g) < n: y[i:i + len(g)] += g
    y = lp(hp(y, 500), 6500) + bp(rng.standard_normal(n), 1500, 6000) * 0.02 * np.abs(y).max() * 20
    rum = lp(brown(n), 160) ; y += norm(rum, np.abs(y).max() * 0.4)
    return make_loop(y, 1.0)
save('slide', slide(), 0.8)

# ---------------- БУБЕНЦЫ ----------------
def jingle(shakes=3):
    n = sec(2.2); y = np.zeros(n); t0 = 0.0
    for s in range(shakes):
        for _ in range(rng.integers(18, 34)):
            tt = t0 + rng.uniform(0, 0.12); i = sec(tt); d = 0.5; m = sec(d); t = np.arange(m) / SR
            f = rng.uniform(3200, 5200); b = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec) for r, a, dec in [(1, 1, 0.12), (1.58, 0.5, 0.07), (2.4, 0.3, 0.04), (3.1, 0.15, 0.03)])
            if i + m < n: y[i:i + m] += b * rng.lognormal(-0.5, 0.5)
        t0 += rng.uniform(0.28, 0.38)
    return fade(conv(y, ir(1.2, 1.4, 7000, 1500), 0.3), 0.001, 0.3)
for i in range(3): save(f'bells{i}', jingle(rng.integers(2, 5)), 0.6)
print('done', sorted(os.listdir(OUT)))
