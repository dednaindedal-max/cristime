// Звуки Cristime — всё синтезируется на лету (Web Audio), без файлов: работает офлайн и почти ничего не весит.
// Шаги по снегу, прыжок/приземление, лестница, скольжение, снежки, салюты (свист, взрыв, треск), костёр рядом, ветер, колокольчики.
export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master, sfx, amb, noiseBuf, fire = null, slide = null, wind = null, vol = 0.8;
  const listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
  // настоящие записи (CC0): шаги по снегу, дерево, мягкие удары, салюты, костёр, взмах — sfx/*.ogg
  const B = {}, LIST = { snow: 5, wood: 5, soft: 5, fw: [1, 2, 3, 4, 5, 6], fire: 0, whoosh: 0 };
  async function loadAll() {
    const jobs = [];
    for (const [k, n] of Object.entries(LIST)) {
      const names = Array.isArray(n) ? n.map(i => k + i) : n ? [...Array(n).keys()].map(i => k + i) : [k];
      B[k] = [];
      names.forEach(nm => jobs.push(fetch('sfx/' + nm + '.ogg').then(r => r.arrayBuffer()).then(a => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then(b => B[k].push(b)).catch(() => {})));
    }
    await Promise.all(jobs); if (B.fire?.length) startFireLoop();
  }
  // проиграть случайный вариант записи в точке p
  function play(k, p, gain = 1, rate = 1, ref = 2, max = 30, delay = 0) {
    const list = B[k]; if (!list || !list.length) return false;
    const o = out(p, gain, ref, max); if (o.g < 0.01) return true;
    const src = ctx.createBufferSource(); src.buffer = list[Math.random() * list.length | 0]; src.playbackRate.value = rate;
    src.connect(o.node); src.start(now() + delay); return true;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master); amb = ctx.createGain(); amb.gain.value = 0.9; amb.connect(master);
    // 2 с белого шума — основа для снега, огня, ветра, взрывов
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startSlide(); startWind(); loadAll();
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(e => addEventListener(e, init, { passive: true }));

  const now = () => ctx.currentTime;
  const noise = (loop = false) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; s.loopStart = Math.random(); return s; };
  // громкость/панорама по расстоянию до слушателя (камера)
  function spatial(p, ref = 3, max = 60) {
    if (!p) return { g: 1, pan: 0 };
    const dx = p.x - listener.x, dz = p.z - listener.z, dy = (p.y || 0) - listener.y, d = Math.hypot(dx, dy, dz);
    const g = d < ref ? 1 : Math.max(0, ref / d) * Math.max(0, 1 - d / max);
    const pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) : 0;
    return { g, pan, d };
  }
  function out(p, gain, ref, max) {
    const { g, pan } = spatial(p, ref, max), gn = ctx.createGain(); gn.gain.value = gain * g;
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan * 0.8; gn.connect(pn).connect(sfx); } else gn.connect(sfx);
    return { node: gn, g };
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }

  // ---------- шаг по снегу: хруст = несколько коротких фильтрованных шумовых «зёрен» ----------
  function step(p, run = false, loud = 1) {
    if (!ctx) return;
    if (play('snow', p, (run ? 0.9 : 0.7) * loud, run ? 1.08 + Math.random() * 0.14 : 0.92 + Math.random() * 0.16, 2, 25)) return; const t = now(), o = out(p, (run ? 0.55 : 0.42) * loud, 2, 25); if (o.g < 0.01) return;
    const grains = 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < grains; i++) {
      const s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), tt = t + i * (0.012 + Math.random() * 0.018);
      bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 2600; bp.Q.value = 1.2 + Math.random() * 2;
      env(g, tt, 0.003, 0.5 + Math.random() * 0.5, 0.03 + Math.random() * 0.05);
      s.connect(bp).connect(g).connect(o.node); s.start(tt, Math.random() * 1.5, 0.12); }
    // мягкое «пух» снизу — нога проваливается в снег
    const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 420;
    env(g, t, 0.01, 0.7, 0.12); s.connect(lp).connect(g).connect(o.node); s.start(t, Math.random(), 0.2);
  }
  function land(p, k = 1) {
    if (!ctx) return;
    if (B.snow?.length) { play('snow', p, 1.0 * k, 0.72 + Math.random() * 0.08, 2, 25); play('soft', p, 0.45 * k, 0.7, 2, 25); return; } const t = now(), o = out(p, 0.7 * k, 2, 25); if (o.g < 0.01) return;
    const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    env(g, t, 0.005, 1, 0.28); s.connect(lp).connect(g).connect(o.node); s.start(t, Math.random(), 0.4);
    step(p, true, 0.8);
  }
  function jump(p) {
    if (!ctx) return;
    if (play('whoosh', p, 0.25, 1.7 + Math.random() * 0.2, 2, 20)) { play('snow', p, 0.5, 1.2, 2, 20); return; } const t = now(), o = out(p, 0.25, 2, 20);
    const s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.15); bp.Q.value = 1.5;
    env(g, t, 0.01, 0.6, 0.15); s.connect(bp).connect(g).connect(o.node); s.start(t, Math.random(), 0.3);
  }
  // ---------- деревянная ступенька лестницы ----------
  function rung(p) {
    if (!ctx) return;
    if (play('wood', p, 0.55, 0.95 + Math.random() * 0.15, 2, 25)) return; const t = now(), o = out(p, 0.35, 2, 25);
    const os = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(); os.type = 'triangle';
    os.frequency.setValueAtTime(190 + Math.random() * 40, t); os.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 2; env(g, t, 0.002, 0.8, 0.09);
    os.connect(bp).connect(g).connect(o.node); os.start(t); os.stop(t + 0.15);
    const s = noise(), hp = ctx.createBiquadFilter(), g2 = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 2500; env(g2, t, 0.001, 0.25, 0.03);
    s.connect(hp).connect(g2).connect(o.node); s.start(t, Math.random(), 0.05);
  }
  // ---------- снежок ----------
  function throwBall(p) {
    if (!ctx) return;
    if (play('whoosh', p, 0.45, 1.25 + Math.random() * 0.15, 2, 25)) return; const t = now(), o = out(p, 0.35, 2, 25);
    const s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    env(g, t, 0.03, 0.8, 0.18); s.connect(bp).connect(g).connect(o.node); s.start(t, Math.random(), 0.3);
  }
  function splat(p) {
    if (!ctx) return;
    if (play('soft', p, 0.8, 0.85 + Math.random() * 0.3, 2.5, 35)) { play('snow', p, 0.5, 1.3, 2.5, 35); return; } const t = now(), o = out(p, 0.6, 2.5, 35); if (o.g < 0.01) return;
    const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    env(g, t, 0.002, 1, 0.2); s.connect(lp).connect(g).connect(o.node); s.start(t, Math.random(), 0.3);
    for (let i = 0; i < 3; i++) { const s2 = noise(), bp = ctx.createBiquadFilter(), g2 = ctx.createGain(), tt = t + 0.02 + i * 0.02;
      bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 2500; bp.Q.value = 2; env(g2, tt, 0.002, 0.4, 0.04); s2.connect(bp).connect(g2).connect(o.node); s2.start(tt, Math.random(), 0.08); }
  }
  function hitMe() {
    if (!ctx) return; const t = now(), g = ctx.createGain(); g.connect(sfx);
    const s = noise(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; env(g, t, 0.003, 0.9, 0.3); s.connect(lp).connect(g); s.start(t, Math.random(), 0.4);
    const os = ctx.createOscillator(), g2 = ctx.createGain(); os.type = 'sine'; os.frequency.setValueAtTime(880, t + 0.05); os.frequency.exponentialRampToValueAtTime(1320, t + 0.15);
    env(g2, t + 0.05, 0.01, 0.12, 0.25); os.connect(g2).connect(sfx); os.start(t + 0.05); os.stop(t + 0.4);
  }
  // ---------- салюты: свист ракеты, взрыв с задержкой звука по расстоянию, треск ----------
  function launch(p) {
    if (!ctx) return; const { g, pan, d } = spatial(p, 12, 140); if (g < 0.01) return; const t = now() + d / 340;
    const gn = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; gn.gain.value = 0.22 * g;
    if (pn) { pn.pan.value = pan * 0.7; gn.connect(pn).connect(sfx); } else gn.connect(sfx);
    const os = ctx.createOscillator(), og = ctx.createGain(); os.type = 'sine'; os.frequency.setValueAtTime(700, t); os.frequency.exponentialRampToValueAtTime(2600 + Math.random() * 800, t + 1.1);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.35, t + 0.15); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    os.connect(og).connect(gn); os.start(t); os.stop(t + 1.3);
    const s = noise(), bp = ctx.createBiquadFilter(), sg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.8;
    sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.5, t + 0.05); sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    s.connect(bp).connect(sg).connect(gn); s.start(t, Math.random(), 1.1);
  }
  function boom(p, crackle = false) {
    if (!ctx) return; const { g, pan, d } = spatial(p, 15, 160); if (g < 0.01) return; const t = now() + d / 340;
    if (play('fw', p, 1.0, 0.9 + Math.random() * 0.2, 15, 160, d / 340)) return;
    const gn = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; gn.gain.value = 0.9 * g;
    if (pn) { pn.pan.value = pan * 0.6; gn.connect(pn).connect(sfx); } else gn.connect(sfx);
    // удар
    const os = ctx.createOscillator(), og = ctx.createGain(); os.type = 'sine'; os.frequency.setValueAtTime(110, t); os.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    env(og, t, 0.004, 1, 0.6); os.connect(og).connect(gn); os.start(t); os.stop(t + 0.7);
    // хлопок + раскат
    const s = noise(), lp = ctx.createBiquadFilter(), sg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(180, t + 1.4);
    env(sg, t, 0.003, 1, 1.6); s.connect(lp).connect(sg).connect(gn); s.start(t, Math.random() * 0.3, 1.9);
    // эхо от леса
    const s2 = noise(), lp2 = ctx.createBiquadFilter(), sg2 = ctx.createGain(); lp2.type = 'lowpass'; lp2.frequency.value = 500;
    env(sg2, t + 0.35, 0.05, 0.25, 1.2); s2.connect(lp2).connect(sg2).connect(gn); s2.start(t + 0.35, Math.random(), 1.5);
    if (crackle) for (let i = 0; i < 38; i++) { const tt = t + 0.5 + Math.random() * 1.6, c = noise(), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2000 + Math.random() * 4000; env(cg, tt, 0.001, 0.35 + Math.random() * 0.4, 0.012 + Math.random() * 0.02);
      c.connect(hp).connect(cg).connect(gn); c.start(tt, Math.random() * 1.8, 0.05); }
  }
  // ---------- костёр: непрерывное шипение + случайные щелчки поленьев; громкость по расстоянию ----------
  let firePos = null;
  function startFireLoop() {
    const src = ctx.createBufferSource(); src.buffer = B.fire[0]; src.loop = true;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null, bus = ctx.createGain(); bus.gain.value = 0;
    if (pn) src.connect(bus).connect(pn).connect(amb); else src.connect(bus).connect(amb);
    src.start(0, Math.random() * 20); fire = { bus, pn, popT: 9e9, sample: true };
  }
  function startFire() {
    const s = noise(true), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5; lp.type = 'lowpass'; lp.frequency.value = 2500; g.gain.value = 0;
    const rumble = noise(true), rl = ctx.createBiquadFilter(), rg = ctx.createGain(); rl.type = 'lowpass'; rl.frequency.value = 160; rg.gain.value = 0.7;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null, bus = ctx.createGain(); bus.gain.value = 0;
    s.connect(bp).connect(lp).connect(g).connect(bus); rumble.connect(rl).connect(rg).connect(bus); g.gain.value = 0.25;
    if (pn) bus.connect(pn).connect(amb); else bus.connect(amb);
    s.start(); rumble.start(); fire = { bus, pn, popT: 0 };
  }
  function firePop(g, pan) {
    const t = now(), gn = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; gn.gain.value = g;
    if (pn) { pn.pan.value = pan; gn.connect(pn).connect(amb); } else gn.connect(amb);
    const n = Math.random() < 0.3 ? 3 + (Math.random() * 4 | 0) : 1;
    for (let i = 0; i < n; i++) { const tt = t + i * (0.02 + Math.random() * 0.05), c = noise(), bp = ctx.createBiquadFilter(), cg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1200 + Math.random() * 3500; bp.Q.value = 3; env(cg, tt, 0.001, 0.5 + Math.random() * 0.6, 0.01 + Math.random() * 0.03);
      c.connect(bp).connect(cg).connect(gn); c.start(tt, Math.random() * 1.8, 0.06); }
  }
  // ---------- скольжение по льду/снегу ----------
  function startSlide() {
    const s = noise(true), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7; g.gain.value = 0;
    s.connect(bp).connect(g).connect(sfx); s.start(); slide = { g, bp };
  }
  // ---------- ветер + колокольчики (атмосфера) ----------
  let bellT = 6;
  function startWind() {
    const s = noise(true), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 3; g.gain.value = 0.07;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 160; lfo.connect(lg).connect(lp.frequency); lfo.start();
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.11; lg2.gain.value = 0.035; lfo2.connect(lg2).connect(g.gain); lfo2.start();
    s.connect(lp).connect(g).connect(amb); s.start(); wind = { g };
  }
  function bells() {
    const t = now(), notes = [1318.5, 1568, 1760, 2093, 1568, 1318.5], n = 3 + (Math.random() * 4 | 0), bus = ctx.createGain(); bus.gain.value = 0.05; bus.connect(amb);
    for (let i = 0; i < n; i++) { const f = notes[Math.random() * notes.length | 0], tt = t + i * (0.12 + Math.random() * 0.1);
      [1, 2.76, 5.4].forEach((h, k) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'sine'; os.frequency.value = f * h;
        env(g, tt, 0.002, [0.6, 0.2, 0.08][k], [1.2, 0.5, 0.25][k]); os.connect(g).connect(bus); os.start(tt); os.stop(tt + 1.4); }); }
  }

  function update(dt, cam, st) {
    if (!ctx || ctx.state !== 'running') return;
    listener.x = cam.position.x; listener.y = cam.position.y; listener.z = cam.position.z;
    const e = cam.matrixWorld.elements; listener.rx = e[0]; listener.rz = e[2];
    if (fire && firePos) { const { g, pan } = spatial(firePos, 2.2, 22); fire.bus.gain.setTargetAtTime(g * 0.9, now(), 0.1); if (fire.pn) fire.pn.pan.setTargetAtTime(pan * 0.8, now(), 0.1);
      if (!fire.sample) fire.popT -= dt; if (fire.popT <= 0) { fire.popT = 0.05 + Math.random() * 0.35; if (g > 0.02) firePop(g * 0.8, pan * 0.8); } }
    if (slide) { const k = st && st.sliding ? Math.min(1, st.speed / 6) : 0; slide.g.gain.setTargetAtTime(k * 0.35, now(), 0.08); slide.bp.frequency.setTargetAtTime(900 + k * 1600, now(), 0.1); }
    bellT -= dt; if (bellT <= 0) { bellT = 18 + Math.random() * 25; bells(); }
  }
  function setVolume(v) { vol = v; if (master) master.gain.setTargetAtTime(v, now(), 0.05); }
  function click() { if (!ctx) return; const t = now(), os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'sine'; os.frequency.setValueAtTime(1200, t); os.frequency.exponentialRampToValueAtTime(700, t + 0.06); env(g, t, 0.002, 0.15, 0.07); os.connect(g).connect(sfx); os.start(t); os.stop(t + 0.1); }
  return { init, update, step, land, jump, rung, throwBall, splat, hitMe, launch, boom, click, setVolume, setFire: p => firePos = p };
}
