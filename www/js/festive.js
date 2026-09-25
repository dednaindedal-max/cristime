import * as THREE from 'three';

// Новогодняя атмосфера: снегопад (GPU), салюты, гирлянды между фонарями, арка «С Новым годом», портал мини-игр.
export function createFestive({ scene, map, camera, onSfx }) {
  const items = map.userData.items, root = new THREE.Group(); scene.add(root);
  const T1 = items.find(o => o.userData.type === 'tree1'); const C = T1 ? T1.position.clone() : new THREE.Vector3();

  // ---------- снегопад: настоящие шестилучевые снежинки (текстура + вращение в шейдере), CPU = 0 ----------
  const flakeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.translate(64, 64); x.strokeStyle = '#fff'; x.lineCap = 'round'; x.shadowColor = 'rgba(200,225,255,.9)'; x.shadowBlur = 6;
    for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3);
      x.lineWidth = 5; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -54); x.stroke();
      x.lineWidth = 3.5; [[-18, 13], [-32, 11], [-44, 8]].forEach(([y, l]) => { x.beginPath(); x.moveTo(0, y); x.lineTo(-l, y - l * 0.9); x.moveTo(0, y); x.lineTo(l, y - l * 0.9); x.stroke(); });
      x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -55, 3.5, 0, 7); x.fill(); x.restore(); }
    x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 6; i++) { const q = i * Math.PI / 3; x.lineTo(Math.sin(q) * 11, -Math.cos(q) * 11); } x.fill();
    const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; return t; })();
  const N = 3200, sp = new Float32Array(N * 3), sr = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = Math.random() * 44; sp[i * 3 + 1] = Math.random() * 22; sp[i * 3 + 2] = Math.random() * 44; sr[i] = Math.random(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('rnd', new THREE.BufferAttribute(sr, 1));
  const snowU = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uTex: { value: flakeTex }, uPx: { value: Math.min(innerHeight, 900) / 700 } };
  const snow = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: snowU, transparent: true, depthWrite: false,
    vertexShader: `attribute float rnd; uniform float uT; uniform vec3 uCam; uniform float uPx; varying float vA; varying float vR;
      void main(){ vec3 p = position; p.y -= uT * (0.55 + rnd * 0.6); p.x += sin(uT * 0.6 + rnd * 40.0) * 0.7 + uT * 0.2;
        p.z += cos(uT * 0.45 + rnd * 30.0) * 0.5;
        vec3 box = vec3(44.0, 22.0, 44.0); vec3 base = uCam - vec3(22.0, 6.0, 22.0);
        p = base + mod(p - base, box);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float d = -mv.z; gl_PointSize = clamp((0.06 + rnd * 0.07) * 900.0 * uPx / d, 1.5, 22.0);
        vA = clamp(1.0 - d / 32.0, 0.0, 1.0) * smoothstep(0.6, 2.0, d); vR = rnd * 6.283 + uT * (rnd - 0.5) * 2.0; }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA; varying float vR;
      void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vR), co = cos(vR); c = mat2(co, -s, s, co) * c;
        vec4 t = texture2D(uTex, c + 0.5); if (t.a < 0.05) discard; gl_FragColor = vec4(vec3(0.93, 0.96, 1.0), t.a * vA); }` }));
  snow.frustumCulled = false; root.add(snow);

  // ---------- гирлянды между фонарями (1 InstancedMesh) ----------
  const lan = items.filter(o => o.userData.type === 'lantern').map(o => { const b = new THREE.Box3().setFromObject(o); return new THREE.Vector3(o.position.x, b.max.y - 0.35, o.position.z); });
  lan.sort((a, b) => Math.atan2(a.z - C.z, a.x - C.x) - Math.atan2(b.z - C.z, b.x - C.x));
  const bulbs = [], wirePts = [];
  const hang = (a, b) => { const d = a.distanceTo(b); if (d > 11) return; const n = Math.round(d * 2.6);
    for (let i = 0; i <= n; i++) { const u = i / n, p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * d * 0.12; if (i > 0 && i < n) bulbs.push(p); wirePts.push(p); } wirePts.push(null); };
  for (let i = 0; i < lan.length; i++) hang(lan[i], lan[(i + 1) % lan.length]);
  // от ёлки к фонарям — лучи гирлянд
  if (T1) { const top = new THREE.Box3().setFromObject(T1).max.y; lan.forEach(l => { if (l.distanceTo(C) < 11) hang(new THREE.Vector3(C.x, top * 0.72, C.z), l); }); }
  const PAL = [0xff3b3b, 0xffd23a, 0x3bff6a, 0x3bb6ff, 0xff5bd6, 0xffffff];
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbs.length);
  const base = [], col = new THREE.Color();
  bulbs.forEach((p, i) => { bm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); base.push(PAL[i % PAL.length]); bm.setColorAt(i, col.set(base[i])); });
  root.add(bm);
  const wv = []; for (let i = 0; i < wirePts.length - 1; i++) { const a = wirePts[i], b = wirePts[i + 1]; if (a && b) wv.push(a.x, a.y + 0.03, a.z, b.x, b.y + 0.03, b.z); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));
  root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a2a1a })));

  // ---------- арка «С НОВЫМ ГОДОМ!» ----------
  const arch = new THREE.Group(); arch.position.set(0.8, 0, 10.4); root.add(arch);
  const poleM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x331111 });
  const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#d42a2a';
    for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(64, i * 32 - 24); x.lineTo(64, i * 32 - 8); x.lineTo(0, i * 32 + 16); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t; })();
  poleM.map = stripeTex;
  [-1.9, 1.9].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 16), poleM); p.position.set(x, 1.8, 0); arch.add(p);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffaa00, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 })); b.position.set(x, 3.7, 0); arch.add(b); });
  const signTex = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#c81e2a'); g.addColorStop(1, '#8a0f18'); x.fillStyle = g; x.beginPath(); x.roundRect(8, 8, 1008, 240, 60); x.fill();
    x.strokeStyle = '#ffd23a'; x.lineWidth = 10; x.stroke();
    x.font = '900 118px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff4c8'; x.shadowColor = '#ffcc33'; x.shadowBlur = 30; x.fillText('С НОВЫМ ГОДОМ!', 512, 134);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: false })); sign.position.y = 3.2; arch.add(sign);
  // вторая сторона — надпись читается с обеих сторон
  const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.z = -0.01; arch.add(sign2); sign.position.z = 0.01;

  // ---------- портал «Мини-игры — скоро» ----------
  const portal = new THREE.Group(); portal.position.set(-3.1, 0, 11.4); portal.rotation.y = Math.atan2(C.x + 3.1, C.z - 11.4); root.add(portal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.13, 12, 48), new THREE.MeshStandardMaterial({ color: 0x9a6bff, emissive: 0x7a4bff, emissiveIntensity: 1.2, roughness: 0.3 }));
  ring.position.y = 1.25; portal.add(ring);
  const swirlU = { uT: { value: 0 } };
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.ShaderMaterial({ uniforms: swirlU, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uT; varying vec2 vU; void main(){ vec2 p = vU - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
      float s = sin(a * 5.0 + r * 10.0 - uT * 3.0) * 0.5 + 0.5; vec3 c = mix(vec3(0.35,0.15,0.9), vec3(0.6,0.9,1.0), s * (1.0 - r));
      gl_FragColor = vec4(c, (1.0 - r * r) * 0.85); }` }));
  disc.position.y = 1.25; portal.add(disc);
  const pTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = 'rgba(20,10,60,.85)'; x.beginPath(); x.roundRect(4, 4, 504, 152, 40); x.fill(); x.strokeStyle = '#b89bff'; x.lineWidth = 6; x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '800 54px system-ui'; x.fillText('🎮 МИНИ-ИГРЫ', 256, 70); x.font = '600 38px system-ui'; x.fillStyle = '#ffd23a'; x.fillText('скоро!', 256, 124);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ps = new THREE.Sprite(new THREE.SpriteMaterial({ map: pTex, toneMapped: false })); ps.scale.set(1.9, 0.6, 1); ps.position.y = 2.85; portal.add(ps);
  const portalPos = portal.position.clone();

  // ---------- салюты: ракеты со шлейфом, 5 типов взрывов, искры-хвосты, мерцание, вспышки ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.9)'); g.addColorStop(0.45, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const PN = 7000;
  const P = { p: new Float32Array(PN * 3), o: new Float32Array(PN * 3), v: new Float32Array(PN * 3), c: new Float32Array(PN * 3), c2: new Float32Array(PN * 3),
    life: new Float32Array(PN), max: new Float32Array(PN), drag: new Float32Array(PN), grav: new Float32Array(PN), size: new Float32Array(PN), tw: new Uint8Array(PN), sub: new Uint8Array(PN) };
  let pHead = 0, alive = 0;
  const hp = new Float32Array(PN * 3), hc = new Float32Array(PN * 3), hs = new Float32Array(PN);
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setAttribute('color', new THREE.BufferAttribute(hc, 3)); hg.setAttribute('size', new THREE.BufferAttribute(hs, 1));
  const heads = new THREE.Points(hg, new THREE.ShaderMaterial({ uniforms: { uTex: { value: glowTex }, uPx: { value: Math.min(innerHeight, 900) / 700 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float size; uniform float uPx; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = size * 380.0 * uPx / -mv.z; }',
    fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0) * texture2D(uTex, gl_PointCoord); }' }));
  heads.frustumCulled = false; root.add(heads);
  const lp = new Float32Array(PN * 6), lc = new Float32Array(PN * 6);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const trails = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  trails.frustumCulled = false; root.add(trails);
  for (let i = 0; i < PN; i++) P.life[i] = 0;
  function emit(x, y, z, vx, vy, vz, col, o = {}) {
    const i = pHead; pHead = (pHead + 1) % PN; const j = i * 3;
    P.p[j] = P.o[j] = x; P.p[j + 1] = P.o[j + 1] = y; P.p[j + 2] = P.o[j + 2] = z; P.v[j] = vx; P.v[j + 1] = vy; P.v[j + 2] = vz;
    P.c[j] = col.r; P.c[j + 1] = col.g; P.c[j + 2] = col.b; const c2 = o.c2 || col; P.c2[j] = c2.r; P.c2[j + 1] = c2.g; P.c2[j + 2] = c2.b;
    if (P.life[i] <= 0) alive++; P.max[i] = P.life[i] = o.life ?? 1.8; P.drag[i] = o.drag ?? 1.6; P.grav[i] = o.grav ?? 2.2; P.size[i] = o.size ?? 0.5; P.tw[i] = o.tw ? 1 : 0; P.sub[i] = o.sub ? 1 : 0;
  }
  const rockets = [], flashes = [];
  for (let i = 0; i < 4; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 })); f.scale.setScalar(12); root.add(f); flashes.push({ s: f, t: 0 }); }
  const HUES = [0.0, 0.08, 0.14, 0.33, 0.55, 0.62, 0.78, 0.9];
  const rc = () => new THREE.Color().setHSL(HUES[Math.random() * HUES.length | 0] + Math.random() * 0.03, 1, 0.55 + Math.random() * 0.15);
  const gold = new THREE.Color(1.0, 0.72, 0.3), white = new THREE.Color(1, 0.95, 0.85);
  function launch() {
    const a = Math.random() * 6.283, R = 22 + Math.random() * 12;
    const x = C.x + Math.cos(a) * R, z = C.z - 6 + Math.sin(a) * R * 0.7;
    onSfx?.('launch', { x, y: 2, z });
    rockets.push({ x, y: 2, z, vx: (Math.random() - 0.5) * 2, vy: 17 + Math.random() * 5, vz: (Math.random() - 0.5) * 2, fuse: 1.0 + Math.random() * 0.5, type: Math.random() * 6 | 0 });
  }
  function explode(r) {
    onSfx?.('boom', { x: r.x, y: r.y, z: r.z }, r.type === 2 || r.type === 4 || r.type === 5);
    const c1 = rc(), c2 = rc(), X = r.x, Y = r.y, Z = r.z; const fl = flashes.find(f => f.t <= 0); if (fl) { fl.s.position.set(X, Y, Z); fl.s.material.color.copy(c1).lerp(white, 0.5); fl.t = 0.35; }
    const sph = (n, sp, col, o) => { for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, q = Math.sqrt(1 - u * u), s = sp * (0.85 + Math.random() * 0.3);
      emit(X, Y, Z, q * Math.cos(th) * s, u * s, q * Math.sin(th) * s, typeof col === 'function' ? col(i) : col, o); } };
    switch (r.type) {
      case 0: sph(260, 11, i => i % 2 ? c1 : c2, { life: 2.0, tw: false }); sph(60, 5, white, { life: 1.4, size: 0.3, tw: true }); break;              // пион, 2 цвета + белое ядро
      case 1: { const ax = new THREE.Vector3().randomDirection(), b1 = new THREE.Vector3().crossVectors(ax, new THREE.Vector3(0, 1, 0.3)).normalize(), b2 = new THREE.Vector3().crossVectors(ax, b1);
        for (let i = 0; i < 160; i++) { const t = i / 160 * 6.283, s = 12; emit(X, Y, Z, (b1.x * Math.cos(t) + b2.x * Math.sin(t)) * s, (b1.y * Math.cos(t) + b2.y * Math.sin(t)) * s, (b1.z * Math.cos(t) + b2.z * Math.sin(t)) * s, c1, { life: 1.9 }); }
        sph(90, 4, c2, { life: 1.5, size: 0.4 }); break; }                                                                                             // кольцо + ядро
      case 2: sph(220, 9, gold, { life: 3.4, drag: 0.9, grav: 3.2, size: 0.42, tw: true, c2: new THREE.Color(0.8, 0.3, 0.05) }); break;              // золотая ива с мерцанием
      case 3: sph(240, 12, c1, { life: 2.2, c2: c2 }); break;                                                                                         // хризантема со сменой цвета
      case 4: sph(70, 10, c1, { life: 0.9, sub: true, size: 0.6 }); break;                                                                            // кроссет: разлетаются и снова взрываются
      default: sph(320, 13, i => (i % 3 === 0 ? white : c1), { life: 2.0, tw: true, size: 0.4 }); break;                                             // стробоскоп-блёстки
    }
  }
  function updateFireworks(dt) {
    nextFw -= dt; if (nextFw <= 0) { launch(); if (Math.random() < 0.3) launch(); nextFw = 1.1 + Math.random() * 2.0; }
    for (let k = rockets.length - 1; k >= 0; k--) { const r = rockets[k]; r.vy -= 6 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; r.fuse -= dt;
      for (let e = 0; e < 3; e++) emit(r.x, r.y, r.z, (Math.random() - 0.5) * 1.2, -2 - Math.random() * 2, (Math.random() - 0.5) * 1.2, gold, { life: 0.5 + Math.random() * 0.4, size: 0.28, drag: 2, grav: 4, tw: true });
      if (r.fuse <= 0) { explode(r); rockets.splice(k, 1); } }
    flashes.forEach(f => { if (f.t > 0) { f.t -= dt; f.s.material.opacity = Math.max(0, f.t / 0.35) * 0.9; } });
    let nh = 0;
    for (let i = 0, seen = 0; i < PN && seen < alive; i++) {
      if (P.life[i] <= 0) continue; seen++; const j = i * 3;
      P.life[i] -= dt; if (P.life[i] <= 0) alive--; const k = Math.max(0, P.life[i] / P.max[i]);
      if (P.sub[i] && k < 0.45) { P.sub[i] = 0; if (P.life[i] > 0) alive--; P.life[i] = 0; const col = new THREE.Color(P.c[j], P.c[j + 1], P.c[j + 2]);
        for (let e = 0; e < 14; e++) { const th = Math.random() * 6.283, u = Math.random() * 2 - 1, q = Math.sqrt(1 - u * u); emit(P.p[j], P.p[j + 1], P.p[j + 2], q * Math.cos(th) * 5, u * 5, q * Math.sin(th) * 5, e % 2 ? col : white, { life: 0.9, size: 0.35, tw: true }); } continue; }
      const dr = Math.exp(-P.drag[i] * dt);
      P.o[j] = P.p[j]; P.o[j + 1] = P.p[j + 1]; P.o[j + 2] = P.p[j + 2];
      P.v[j] *= dr; P.v[j + 1] = P.v[j + 1] * dr - P.grav[i] * dt; P.v[j + 2] *= dr;
      P.p[j] += P.v[j] * dt; P.p[j + 1] += P.v[j + 1] * dt; P.p[j + 2] += P.v[j + 2] * dt;
      let br = Math.min(1, k * 1.6); if (P.tw[i] && k < 0.7) br *= Math.random() < 0.45 ? 1.4 : 0.15;
      const m = 1 - k, r = (P.c[j] * (1 - m) + P.c2[j] * m) * br, g = (P.c[j + 1] * (1 - m) + P.c2[j + 1] * m) * br, b = (P.c[j + 2] * (1 - m) + P.c2[j + 2] * m) * br;
      const h = nh * 3; hp[h] = P.p[j]; hp[h + 1] = P.p[j + 1]; hp[h + 2] = P.p[j + 2]; hc[h] = r; hc[h + 1] = g; hc[h + 2] = b; hs[nh] = P.size[i] * (0.6 + k * 0.6);
      const L = nh * 6, tl = 0.07 + (1 - P.drag[i] / 2) * 0.05;       // хвост-искра: от текущей точки назад по скорости
      lp[L] = P.p[j]; lp[L + 1] = P.p[j + 1]; lp[L + 2] = P.p[j + 2]; lp[L + 3] = P.p[j] - P.v[j] * tl; lp[L + 4] = P.p[j + 1] - P.v[j + 1] * tl; lp[L + 5] = P.p[j + 2] - P.v[j + 2] * tl;
      lc[L] = r * 0.8; lc[L + 1] = g * 0.8; lc[L + 2] = b * 0.8; lc[L + 3] = lc[L + 4] = lc[L + 5] = 0;
      nh++;
    }
    hg.setDrawRange(0, nh); lg.setDrawRange(0, nh * 2);
    hg.attributes.position.needsUpdate = hg.attributes.color.needsUpdate = hg.attributes.size.needsUpdate = true;
    lg.attributes.position.needsUpdate = lg.attributes.color.needsUpdate = true;
  }
  let nextFw = 1.2;

  let tw = 0;
  function update(dt, t) {
    snowU.uT.value = t; snowU.uCam.value.copy(camera.position); swirlU.uT.value = t; ring.rotation.z = t * 0.4;
    ps.position.y = 2.85 + Math.sin(t * 2) * 0.06;
    tw += dt; if (tw > 0.35) { tw = 0; for (let i = 0; i < bulbs.length; i++) { const on = Math.random() > 0.18; bm.setColorAt(i, col.set(base[i]).multiplyScalar(on ? 1.6 : 0.25)); } bm.instanceColor.needsUpdate = true; }
    updateFireworks(dt);
  }
  return { update, portalPos, portalCollider: { k: 'c', x: portalPos.x, z: portalPos.z, r: 0.25, top: 99 } };
}
