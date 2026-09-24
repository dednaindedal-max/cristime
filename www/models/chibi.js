import * as THREE from 'three';
import { std, bake } from './common.js';

// Чибик — пингвинёнок (референс uploads/12_penguin.png). color — цвет шапки и шарфа.
function knit(base, dark) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128); x.strokeStyle = dark; x.globalAlpha = 0.5; x.lineWidth = 2.4;
  for (let i = 0; i < 16; i++) for (let k = 0; k < 16; k++) { x.beginPath(); x.moveTo(i * 8, k * 8); x.lineTo(i * 8 + 4, k * 8 + 6); x.lineTo(i * 8 + 8, k * 8); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function furTex(base, spec) {                       // мягкий «пушок»
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { x.strokeStyle = spec[i % spec.length]; x.globalAlpha = 0.18; x.lineWidth = 1;
    const px = Math.random() * 256, py = Math.random() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 3, py + 3 + Math.random() * 3); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const shade = (n, k) => { const c = new THREE.Color(n).multiplyScalar(k); return '#' + c.getHexString(); };
function eyeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 70, 10, 64, 64, 64);
  g.addColorStop(0, '#05060c'); g.addColorStop(0.55, '#15182a'); g.addColorStop(0.8, '#4a4a78'); g.addColorStop(0.93, '#8a86b8'); g.addColorStop(1, '#1a1a2a');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createChibi({ color = 0xc8352c } = {}) {
  const g = new THREE.Group(); g.name = 'chibi';
  const navy = std(0x1c2446, { map: furTex('#2a3872', ['#44559a', '#18204a']), roughness: 0.85 });
  const whiteF = std(0xf4f4f2, { map: furTex('#f6f6f4', ['#ffffff', '#dcdce4']), roughness: 0.9 });
  const orange = std(0xf08a2a, { roughness: 0.45 }), orangeD = std(0xd46a18, { roughness: 0.5 });
  const kT = knit(hex(color), shade(color, 0.7)); kT.repeat.set(8, 3);
  const hat = std(color, { map: kT, roughness: 0.95 });
  const cT = knit(shade(color, 0.92), shade(color, 0.62)); cT.repeat.set(14, 1);
  const cuff = std(color, { map: cT, roughness: 0.95 });
  const sT = knit(hex(color), shade(color, 0.7)); sT.repeat.set(6, 1);
  const scarf = std(color, { map: sT, roughness: 0.95 });
  const pom = std(0xf2f2f0, { roughness: 1 });
  const eyeM = std(0xffffff, { map: eyeTex(), roughness: 0.05, metalness: 0.1 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blush = new THREE.MeshBasicMaterial({ color: 0xff8a9a, transparent: true, opacity: 0.45, depthWrite: false });
  const mouth = std(0x9a2a1a, { roughness: 0.5 });

  const M = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); p.add(m); return m; };
  const part = (parent, x = 0, y = 0, z = 0) => { const piv = new THREE.Group(); piv.position.set(x, y, z); parent.add(piv); const c = new THREE.Group(); piv.add(c); piv.userData.c = c; return piv; };
  const S = (r, w = 24, h = 16, ...a) => new THREE.SphereGeometry(r, w, h, ...a);

  const rig = new THREE.Group(); g.add(rig);
  // ---------- лапки ----------
  const feet = [-1, 1].map(s => {
    const f = part(rig, s * 0.1, 0.06, 0.03), c = f.userData.c;
    M(c, S(0.07, 16, 10), orange, 0, -0.035, 0.05, 0, s * 0.2, 0, 1, 0.38, 1.3);
    for (let k = -1; k <= 1; k++) M(c, S(0.03, 10, 8), orange, k * 0.035 + s * 0.005, -0.04, 0.12 - Math.abs(k) * 0.012, 0, 0, 0, 1, 0.55, 1.2);
    M(c, new THREE.CylinderGeometry(0.03, 0.04, 0.06, 10), orangeD, 0, 0, 0.0);
    return f;
  });

  // ---------- тело (переваливается) ----------
  const body = part(rig, 0, 0, 0), bc = body.userData.c;
  M(bc, S(0.3, 32, 22), navy, 0, 0.32, 0, 0, 0, 0, 0.92, 1.0, 0.86);
  M(bc, S(0.25, 32, 20), whiteF, 0, 0.3, 0.07, 0, 0, 0, 0.82, 0.92, 0.8);                 // белый животик
  M(bc, new THREE.ConeGeometry(0.06, 0.09, 10), navy, 0, 0.14, -0.23, -2.2);                // хвостик
  // шарф
  M(bc, new THREE.TorusGeometry(0.2, 0.062, 14, 36), scarf, 0, 0.53, 0.005, Math.PI / 2 - 0.06, 0, 0, 1.08, 0.95, 1);
  M(bc, S(0.055, 14, 10), scarf, 0.09, 0.51, 0.2, 0, 0, 0, 1.1, 0.9, 0.7);                  // узел
  const tail = M(bc, new THREE.BoxGeometry(0.085, 0.2, 0.035), scarf, 0.1, 0.4, 0.225, -0.18, 0, 0.1);
  for (let i = 0; i < 7; i++) M(bc, new THREE.CylinderGeometry(0.004, 0.004, 0.04, 4), scarf, 0.068 + i * 0.011 + 0.012, 0.285, 0.245 + 0.003, -0.18, 0, 0.1);

  // ---------- крылышки ----------
  const wings = [-1, 1].map(s => {
    const w = part(body, s * 0.25, 0.44, -0.01), c = w.userData.c;
    M(c, S(0.085, 16, 12), navy, s * 0.045, -0.1, 0, 0, 0, s * 0.35, 0.42, 1.25, 0.8);
    return w;
  });

  // ---------- голова ----------
  const head = part(body, 0, 0.72, 0), hc = head.userData.c;
  M(hc, S(0.31, 40, 28), navy, 0, 0, 0, 0, 0, 0, 1.05, 0.95, 0.98);
  // белая «маска-сердечко»: две щеки + подбородок
  [-1, 1].forEach(s => M(hc, S(0.17, 28, 20), whiteF, s * 0.1, -0.005, 0.15, 0, s * 0.2, 0, 1, 1.12, 0.95));
  M(hc, S(0.16, 28, 20), whiteF, 0, -0.1, 0.14, 0, 0, 0, 1.25, 0.8, 0.95);
  // глаза: большие, глянцевые, с двумя бликами
  [-1, 1].forEach(s => {
    const e = new THREE.Group(); e.position.set(s * 0.105, 0.02, 0.3); e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s * 0.12, 0.01, 0.93).normalize()); hc.add(e);
    M(e, S(0.072, 28, 20), eyeM, 0, 0, -0.012, 0, -Math.PI / 2, 0, 0.45, 1.05, 1);
    M(e, new THREE.TorusGeometry(0.071, 0.006, 6, 28), std(0x10121e), 0, 0, -0.008);
    M(e, new THREE.CircleGeometry(0.024, 16), shine, -0.022, 0.024, 0.0215);
    M(e, new THREE.CircleGeometry(0.011, 12), shine, 0.024, -0.022, 0.0215);
    M(e, new THREE.CircleGeometry(0.006, 8), shine, 0.028, 0.03, 0.0215);
    // румянец
    const b = new THREE.Group(); b.position.set(s * 0.19, -0.1, 0.22); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s * 0.6, -0.2, 0.75).normalize()); hc.add(b);
    M(b, new THREE.CircleGeometry(0.05, 20), blush, 0, 0, 0.012, 0, 0, 0, 1.2, 0.8, 1);
  });
  // клювик с улыбкой
  M(hc, S(0.055, 16, 10), orange, 0, -0.075, 0.3, 0, 0, 0, 1.35, 0.55, 0.9);
  M(hc, S(0.045, 16, 10), orangeD, 0, -0.1, 0.29, 0, 0, 0, 1.2, 0.4, 0.8);
  M(hc, new THREE.TorusGeometry(0.04, 0.006, 6, 16, Math.PI), mouth, 0, -0.085, 0.335, 0, 0, Math.PI, 1.4, 0.5, 1);
  // шапка
  M(hc, S(0.3, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), hat, 0, 0.1, -0.01, -0.1, 0, 0, 1.06, 1.05, 1.04);
  M(hc, new THREE.TorusGeometry(0.3, 0.058, 14, 48), cuff, 0, 0.12, -0.01, Math.PI / 2 - 0.1, 0, 0, 1.06, 1.04, 1);
  M(hc, S(0.085, 18, 14), pom, 0, 0.44, -0.04);
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, r = 0.07; M(hc, S(0.035, 8, 6), pom, Math.cos(a) * r, 0.44 + Math.sin(i * 2.3) * 0.035, -0.04 + Math.sin(a) * r); }

  g.traverse(o => { if (o.isMesh && o.material.map && o.material.isMeshStandardMaterial) o.material.color.set(0xffffff); });
  // ночью персонаж читается: лёгкое самосвечение
  g.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial && o.material !== eyeM) { o.material.emissive = o.material.color.clone(); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.25; } });
  [feet[0], feet[1], body, wings[0], wings[1], head].forEach(p => { bake(p.userData.c, { keepLights: false }); p.userData.c.traverse(o => { o.castShadow = false; o.receiveShadow = true; }); });

  const sh = document.createElement('canvas'); sh.width = sh.height = 64; const sx = sh.getContext('2d');
  const gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(10,20,50,.55)'); gr.addColorStop(1, 'rgba(10,20,50,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; blob.renderOrder = 3; g.add(blob);

  // походка вразвалочку + позы: belly (на животе), sit (на попе), climb (лестница), throw (бросок снежка)
  let ph = 0, amt = 0; const P = { belly: 0, sit: 0, climb: 0 };
  g.userData.animate = (dt, speed, t, air = false, mode = 'walk', thr = 0) => {
    const kk = Math.min(1, dt * 9);
    for (const m in P) P[m] += ((mode === m ? 1 : 0) - P[m]) * kk;
    const walkK = 1 - Math.max(P.belly, P.sit, P.climb);
    amt += (Math.min(speed, 1.4) * (mode === 'climb' ? 1 : walkK) - amt) * Math.min(1, dt * 10);
    if (amt > 0.02) ph += dt * (8 + amt * 6);
    const s = Math.sin(ph), c = Math.cos(ph);
    // корпус
    body.rotation.z = s * 0.16 * amt * walkK;
    body.position.y = (Math.abs(c) * 0.03 * amt + Math.sin(t * 2.2) * 0.006 * (1 - amt)) * walkK;
    body.rotation.x = amt * 0.08 * walkK;
    // лапки
    const fz = 0.03 + s * 0.07 * amt * walkK, fl = 0.06;
    feet[0].position.set(-0.1, fl + Math.max(0, c) * 0.04 * amt * walkK + P.climb * Math.max(0, s) * 0.08, fz + P.sit * 0.14);
    feet[1].position.set(0.1, fl + Math.max(0, -c) * 0.04 * amt * walkK + P.climb * Math.max(0, -s) * 0.08, 0.06 - fz + P.sit * 0.14);
    feet[0].rotation.x = feet[1].rotation.x = -P.sit * 0.9 + P.belly * 1.2;
    // крылышки
    let flap = air ? 0.9 + Math.sin(t * 25) * 0.3 : 0.15 + Math.abs(s) * 0.35 * amt + Math.sin(t * 2) * 0.03;
    flap = flap * walkK + P.belly * (1.35 + Math.sin(t * 3) * 0.05) + P.sit * (1.1 + Math.sin(t * 9) * 0.15);
    let wl = -flap, wr = flap, wx0 = P.belly * -0.2, wx1 = wx0;
    if (P.climb > 0.01) { wl = wl * (1 - P.climb) - P.climb * (2.3 + s * 0.35); wr = wr * (1 - P.climb) + P.climb * (2.3 - s * 0.35); }
    if (thr > 0) { const a = Math.sin(thr * Math.PI); wr += a * 0.4; wx1 += thr < 0.5 ? thr * 2 * 2.6 : (1 - thr) * 2 * 2.6 - (thr - 0.5) * 4; }
    wings[0].rotation.set(wx0, 0, wl); wings[1].rotation.set(wx1, 0, wr);
    // весь риг: лёжа на животе / сидя
    rig.rotation.x = P.belly * (Math.PI / 2 - 0.12) - P.sit * 0.45;
    rig.position.set(0, P.belly * 0.24 + P.sit * 0.02, -P.belly * 0.3 + P.sit * 0.05);
    head.rotation.z = -s * 0.08 * amt * walkK; head.rotation.x = Math.sin(t * 1.3) * 0.02 - P.belly * 1.0 + P.sit * 0.2 - P.climb * 0.25;
    blob.scale.setScalar((1 - body.position.y) * (1 + P.belly * 0.5));
  };
  g.userData.setBlobY = (y) => { blob.position.y = y; };
  g.userData.animate(0, 0, 0);
  return g;
}
