import * as THREE from 'three';
import { cs, std, woodTex } from './common.js';

// Снежная горка с деревянной башенкой и лестницей
export function createSledHill() {
  const g = new THREE.Group(); g.name = 'sledhill';
  const snow = std(0xdfeaf7, { roughness: 0.8, emissive: 0xc8d8f0, emissiveIntensity: 0.05 });
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xcfe3f7, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const wood = std(0xffffff, { map: woodTex('#b8743a', '#8f5226'), roughness: 0.7 });
  const red = std(0xc62a24, { roughness: 0.5 });
  const cap = std(0xffffff, { roughness: 0.9 });

  // ===== холм: гладкие «облачные» комья снега (как на референсе) =====
  const lumpGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const ball = new THREE.SphereGeometry(1, 24, 16);
  const addL = (x, z, r, h) => { const m = cs(new THREE.Mesh(lumpGeo, snow)); m.scale.set(r, h, r); m.position.set(x, 0, z); g.add(m); return m; };
  const addB = (x, y, z, r, sy = 0.85) => { const m = cs(new THREE.Mesh(ball, snow)); m.scale.set(r, r * sy, r); m.position.set(x, y, z); g.add(m); return m; };
  // основное тело под башней
  addL(1.3, -0.3, 2.0, 3.55); addL(2.0, 0.6, 1.5, 2.3); addL(0.4, -1.3, 1.4, 2.2); addL(2.2, -1.2, 1.3, 1.8); addL(0.4, 0.8, 1.3, 2.4);
  // выпуклые комья на правом боку (сторона лестницы/переднего плана)
  [[1.7, 1.2, 1.35, 0.75], [2.45, 0.8, 0.8, 0.7], [2.3, 1.6, 0.45, 0.6], [1.4, 2.2, 1.4, 0.62], [0.9, 1.7, 2.1, 0.55], [2.6, 1.9, -0.2, 0.65],
   [1.9, 2.6, 0.9, 0.5], [2.8, 1.0, -1.1, 0.6], [0.2, 1.3, -2.0, 0.6], [1.2, 1.1, -2.1, 0.55], [2.6, 0.5, 0.6, 0.55], [0.1, 0.5, 1.7, 0.6]]
    .forEach(([x, y, z, r]) => addB(x, y, z, r));
  // подножие — низкие валики
  [[3.0, 1.2, 0.5], [2.9, -0.4, 0.55], [2.4, -2.1, 0.5], [0.9, -2.6, 0.5], [-0.6, -1.9, 0.5], [1.2, 2.6, 0.55], [2.4, 2.1, 0.5], [-0.2, 2.1, 0.5]]
    .forEach(([x, z, r]) => addL(x, z, r * 1.3, r * 0.9));

  // ===== Спуск =====
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.45, 3.5, -0.3), new THREE.Vector3(-0.5, 3.0, -0.15), new THREE.Vector3(-1.7, 1.95, 0.1),
    new THREE.Vector3(-2.9, 0.95, 0.35), new THREE.Vector3(-4.0, 0.38, 0.55), new THREE.Vector3(-5.0, 0.24, 0.7)]);
  const up = new THREE.Vector3(0, 1, 0);
  const frameAt = (u) => { const p = path.getPoint(u), t = path.getTangent(u); return { p, t, side: new THREE.Vector3().crossVectors(t, up).setY(0).normalize(), w: 0.95 + u * 0.35 }; };
  const N = 64, CH = 16, depth = 0.34, RIM = 0.34;
  const grid = (fn, cols) => { const pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const f = frameAt(i / N); for (let j = 0; j <= cols; j++) { const [x, y] = fn(f, j / cols, i / N); pos.push(f.p.x + f.side.x * x, y, f.p.z + f.side.z * x);
      if (i < N && j < cols) { const k = i * (cols + 1) + j; idx.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1); } } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); return gg; };
  // ледяное русло (U-профиль) с лёгкими продольными бороздами как на картинке
  const iceG = grid((f, v) => { const a = -Math.PI / 2 + v * Math.PI, x = Math.sin(a) * f.w; return [x, f.p.y + depth * (1 - Math.cos(a)) + Math.sin(v * Math.PI * 7) * 0.008]; }, 28);
  const iceM = new THREE.MeshPhysicalMaterial({ color: 0xb4d6f5, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, side: THREE.DoubleSide });
  g.add(cs(new THREE.Mesh(iceG, iceM)));
  // снежное тело спуска: от кромки жёлоба плавно (четверть эллипса) вниз до земли — без обрывов, стоит на земле
  [-1, 1].forEach(sd => {
    // толстый округлый бортик вдоль кромки
    const pts = []; for (let i = 0; i <= 50; i++) { const f = frameAt(i / 50); pts.push(f.p.clone().addScaledVector(f.side, sd * (f.w + 0.1)).setY(f.p.y + depth - 0.02 - Math.max(0, i / 50 - 0.8) * 1.6)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(cs(new THREE.Mesh(new THREE.TubeGeometry(curve, 90, RIM, 14), snow)));
    [0, 1].forEach(u => addB(curve.getPoint(u).x, curve.getPoint(u).y, curve.getPoint(u).z, RIM, 1));
    // комья по бокам спуска
    [0.25, 0.45, 0.62, 0.8].forEach((u, k) => { const f = frameAt(u), d = f.w + 0.55 + f.p.y * 0.35;
      addB(f.p.x + f.side.x * sd * d, f.p.y * 0.35, f.p.z + f.side.z * sd * d, 0.45 + f.p.y * 0.18 + (k % 2) * 0.1); });
  });
  for (let i = 0; i <= 30; i++) { const u = i / 30, f = frameAt(u), r0 = f.w + 0.7 + f.p.y * 0.3, top = Math.min(f.p.y, path.getPoint(Math.min(1, u + r0 / path.getLength())).y + depth * 0.6) - 0.06, r = r0;
    addL(f.p.x, f.p.z, r, Math.max(0.25, top)); }
  // днище под руслом, чтобы лёд не выглядел прозрачным
  const under = cs(new THREE.Mesh(grid((f, v) => { const x = (v * 2 - 1) * (f.w + 0.2); return [x, Math.max(0, f.p.y - 0.02)]; }, 4), snow)); g.add(under);
  const underB = cs(new THREE.Mesh(iceG.clone(), snow)); underB.position.y = -0.05; g.add(underB);
  // финиш: широкий «веер» мягкого снега + валики
  const fe = frameAt(1);
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.26, 40, 1), snow); fan.scale.set(1.15, 1, 1); fan.position.set(fe.p.x + fe.t.x * 0.6, 0.1, fe.p.z + fe.t.z * 0.6); g.add(cs(fan));
  [[0, 1.6, 0.55, 0.32], [1.1, 1.3, 0.5, 0.3], [-1.1, 1.3, 0.5, 0.3], [1.8, 0.6, 0.5, 0.35], [-1.8, 0.6, 0.5, 0.35], [2.0, -0.3, 0.45, 0.4], [-2.0, -0.3, 0.45, 0.4], [0.6, 1.9, 0.35, 0.25], [-0.6, 1.9, 0.35, 0.25]]
    .forEach(([o, fwd, r, h]) => addL(fe.p.x + fe.side.x * o + fe.t.x * (0.6 + fwd), fe.p.z + fe.side.z * o + fe.t.z * (0.6 + fwd), r * 1.3, h));
  const fanTop = cs(new THREE.Mesh(lumpGeo, snow)); fanTop.scale.set(2.2, 0.3, 1.9); fanTop.position.set(fe.p.x + fe.t.x * 0.6, 0.02, fe.p.z + fe.t.z * 0.6); g.add(fanTop);

  // ===== башенка: брёвна, настил из досок, красные перила, снежная шапка на крыше =====
  const T = new THREE.Group(); T.position.set(1.3, 3.7, -0.3); g.add(T);
  const beam = (w, h, d, x, y, z) => { const b = cs(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood)); b.position.set(x, y, z); T.add(b); return b; };
  const log = (r, len, x, y, z, rx = 0, rz = 0) => { const b = cs(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 14), wood)); b.position.set(x, y, z); b.rotation.set(rx, 0, rz); T.add(b); return b; };
  for (let i = 0; i < 8; i++) beam(0.225, 0.12, 1.75, -0.79 + i * 0.226, 0, 0);   // доски пола
  log(0.08, 1.95, 0, -0.1, 0.82, 0, Math.PI / 2); log(0.08, 1.95, 0, -0.1, -0.82, 0, Math.PI / 2); log(0.08, 1.75, 0.9, -0.1, 0, Math.PI / 2); log(0.08, 1.75, -0.9, -0.1, 0, Math.PI / 2);
  [[-0.85, -0.75], [0.85, -0.75], [-0.85, 0.75], [0.85, 0.75]].forEach(([x, z]) => { log(0.1, 3.2, x, 0.3, z); const k = cs(new THREE.Mesh(ball, cap)); k.scale.set(0.12, 0.06, 0.12); k.position.set(x, -0.02, z); });
  // перила по бокам: толстая красная планка + балясины
  [0.8, -0.8].forEach(z => {
    const r = cs(new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 0.14), red)); r.position.set(0, 0.72, z); T.add(r);
    const sn = cs(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.5, 4, 10), cap)); sn.rotation.z = Math.PI / 2; sn.scale.set(1, 1, 0.9); sn.position.set(0.1, 0.8, z); T.add(sn);
    for (let i = 0; i < 5; i++) { const b = cs(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.08), red)); b.position.set(-0.6 + i * 0.3, 0.38, z); T.add(b); }
  });
  // рама крыши
  beam(1.9, 0.14, 0.14, 0, 1.78, 0.85); beam(1.9, 0.14, 0.14, 0, 1.78, -0.85);
  [-1, 1].forEach(s => {
    const r = cs(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 2.1), wood)); r.position.set(s * 0.55, 2.15, 0); r.rotation.z = -s * 0.62; T.add(r);
    [1.02, -1.02].forEach(z => { const bb = cs(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.12), wood)); bb.position.set(s * 0.55, 2.13, z); bb.rotation.z = -s * 0.62; T.add(bb); });
  });
  beam(0.16, 0.16, 2.2, 0, 2.55, 0);
  // снежная шапка на скатах (лежит на крыше) + валик по коньку
  [-1, 1].forEach(sd => { const sn = cs(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 1.85, 1, 1, 1), cap)); sn.position.set(sd * 0.5, 2.25, 0); sn.rotation.z = -sd * 0.62; T.add(sn);
    const ed = cs(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.75, 4, 10), cap)); ed.rotation.x = Math.PI / 2; ed.position.set(sd * 0.98, 1.92, 0); T.add(ed); });
  const rg = cs(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.8, 6, 14), cap)); rg.rotation.x = Math.PI / 2; rg.position.y = 2.63; T.add(rg);
  // ===== лестница: тетивы-брёвна, ступени, снег на ступенях =====
  const lTop = new THREE.Vector3(2.2, 3.7, -0.3), lBot = new THREE.Vector3(4.0, 0, -0.3);
  const Ld = new THREE.Group(); Ld.position.copy(lTop).add(lBot).multiplyScalar(0.5);
  Ld.rotation.z = Math.atan2(lBot.x - lTop.x, lTop.y - lBot.y); g.add(Ld);
  const LL = lTop.distanceTo(lBot);
  [-0.38, 0.38].forEach(z => { const r = cs(new THREE.Mesh(new THREE.BoxGeometry(0.14, LL + 0.4, 0.12), wood)); r.position.set(0, 0.05, z); Ld.add(r); });
  for (let i = 0; i < 10; i++) { const y = -LL / 2 + 0.3 + i * (LL - 0.4) / 9;
    const st = cs(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.76), wood)); st.position.y = y; Ld.add(st);
    if (i % 3 === 1) { const sn = cs(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.4, 3, 8), cap)); sn.rotation.x = Math.PI / 2; sn.position.set(-0.02, y + 0.05, (i % 2 ? 0.1 : -0.1)); Ld.add(sn); } }
  // данные для катания: лестница, площадка башенки, осевая линия жёлоба (локальные координаты)
  g.userData.ride = { ladderBot: lBot.clone(), ladderTop: lTop.clone(), deck: new THREE.Vector3(1.3, 3.77, -0.3), deckHalf: new THREE.Vector2(0.8, 0.7), path };
  return g;
}
