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

  // холм из комков снега
  const lumps = [[0.9, 1.2, -0.6, 1.5], [1.6, 0.8, 0.2, 1.2], [0.2, 0.9, 0.6, 1.1], [1.1, 2.0, -0.4, 1.25], [1.8, 2.0, 0.3, 0.9],
    [0.6, 0.5, 1.4, 0.7], [1.6, 0.5, 1.3, 0.8], [2.2, 1.0, 0.9, 0.75], [1.3, 2.55, -0.3, 0.95], [2.1, 0.5, -0.8, 0.9], [-0.2, 0.4, -0.9, 0.8]];
  lumps.forEach(([x, y, z, r]) => {
    const m = cs(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), snow)); m.position.set(x, Math.max(y, r * 0.55), z);
    if (y < r) { m.geometry = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); m.position.y = 0; m.scale.y = (y + r * 0.6) / r; }
    g.add(m); });

  // ===== Спуск: сугроб-насыпь из комьев + ледяной жёлоб + снежные бортики =====
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.45, 3.5, -0.3), new THREE.Vector3(-0.5, 3.0, -0.15), new THREE.Vector3(-1.7, 1.95, 0.1),
    new THREE.Vector3(-2.9, 0.95, 0.35), new THREE.Vector3(-4.0, 0.38, 0.55), new THREE.Vector3(-5.0, 0.24, 0.7)]);
  const up = new THREE.Vector3(0, 1, 0);
  const frameAt = (u) => { const p = path.getPoint(u), t = path.getTangent(u); return { p, t, side: new THREE.Vector3().crossVectors(t, up).setY(0).normalize(), w: 0.95 + u * 0.3 }; };

  // насыпь: полуэллипсоиды, стоят на земле, верх — под дном жёлоба
  const lumpGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const NL = 22;
  for (let i = 0; i <= NL; i++) {
    const u = i / NL, f = frameAt(u);
    const top = f.p.y - 0.03, r = f.w + 0.45 + top * 0.25;
    const m = cs(new THREE.Mesh(lumpGeo, snow));
    m.scale.set(r, Math.max(0.2, top), r); m.position.set(f.p.x, 0, f.p.z); g.add(m);
    // боковые пухлые комья (как на картинке)
    if (i % 3 === 0) [-1, 1].forEach(sd => {
      const rr = 0.35 + top * 0.22, k = cs(new THREE.Mesh(lumpGeo, snow));
      k.scale.set(rr * 1.1, Math.max(0.25, top * 0.7), rr * 1.1);
      k.position.set(f.p.x + f.side.x * (r * 0.85) * sd, 0, f.p.z + f.side.z * (r * 0.85) * sd); g.add(k);
    });
  }

  // ледяной жёлоб (U-профиль)
  const N = 50, CH = 12, depth = 0.34;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const f = frameAt(i / N);
    for (let j = 0; j <= CH; j++) {
      const a = -Math.PI / 2 + j / CH * Math.PI, x = Math.sin(a) * f.w, y = f.p.y + depth * (1 - Math.cos(a));
      pos.push(f.p.x + f.side.x * x, y, f.p.z + f.side.z * x);
      if (i < N && j < CH) { const k = i * (CH + 1) + j; idx.push(k, k + 1, k + CH + 1, k + 1, k + CH + 2, k + CH + 1); }
    }
  }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals();
  const iceM = new THREE.MeshPhysicalMaterial({ color: 0xa8cdf0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  g.add(cs(new THREE.Mesh(cg, iceM)));
  // днище под жёлобом (снег), чтобы снизу не было видно пустоты
  const under = cs(new THREE.Mesh(cg.clone(), snow)); under.position.y = -0.06; g.add(under);

  // снежные бортики с закруглёнными концами
  [-1, 1].forEach(sd => {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const f = frameAt(i / 40); pts.push(f.p.clone().addScaledVector(f.side, sd * (f.w + 0.06)).setY(f.p.y + depth + 0.02)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(cs(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.2, 8), snow)));
    [0, 1].forEach(u => { const e = cs(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), snow)); e.position.copy(curve.getPoint(u)); g.add(e); });
  });

  // сугроб на финише — мягкий, пологий
  const fe = frameAt(1);
  [[0, 0, 0.9, 0.35], [0.9, 0.3, 0.6, 0.3], [-0.9, 0.3, 0.6, 0.3], [0.2, -0.6, 0.7, 0.28], [-0.2, 0.7, 0.55, 0.25]].forEach(([o, fwd, r, h]) => {
    const m = cs(new THREE.Mesh(lumpGeo, snow)); m.scale.set(r * 1.3, h, r * 1.3);
    m.position.set(fe.p.x + fe.side.x * o + fe.t.x * (0.5 + fwd), 0, fe.p.z + fe.side.z * o + fe.t.z * (0.5 + fwd)); g.add(m);
  });
  // сугробы под стартом — сливают насыпь с холмом
  [[0.75, -0.3, 1.4, 3.35], [0.3, -1.25, 1.1, 2.4], [0.3, 0.65, 1.1, 2.4]].forEach(([x, z, r, h]) => {
    const m = cs(new THREE.Mesh(lumpGeo, snow)); m.scale.set(r, h, r); m.position.set(x, 0, z); g.add(m);
  });

  // башенка
  const T = new THREE.Group(); T.position.set(1.3, 3.7, -0.3); g.add(T);
  const beam = (w, h, d, x, y, z) => { const b = cs(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood)); b.position.set(x, y, z); T.add(b); return b; };
  beam(1.9, 0.14, 1.7, 0, 0, 0); // пол
  [[-0.85, -0.75], [0.85, -0.75], [-0.85, 0.75], [0.85, 0.75]].forEach(([x, z]) => beam(0.16, 2.9, 0.16, x, 0.4, z)); // столбы (уходят вниз в снег)
  // перила красные с балясинами (по бокам и сзади)
  [[0, 0.7, 0.8, 1.7, 'x'], [0, 0.7, -0.8, 1.7, 'x']].forEach(([x, y, z, len, ax]) => {
    const r = cs(new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? len : 0.1, 0.1, ax === 'x' ? 0.1 : len), red)); r.position.set(x, y, z); T.add(r);
    for (let i = 0; i < 5; i++) { const b = cs(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), red)); const o = -len / 2 + 0.2 + i * (len - 0.4) / 4;
      b.position.set(ax === 'x' ? x + o : x, 0.38, ax === 'x' ? z : z + o); T.add(b); }
  });
  // крыша двускатная
  [-1, 1].forEach(s => { const r = cs(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 2.0), wood)); r.position.set(s * 0.52, 2.15, 0); r.rotation.z = -s * 0.62; T.add(r);
    const sn = cs(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.8), cap)); sn.position.set(s * 0.49, 2.24, 0); sn.rotation.z = -s * 0.62; T.add(sn); });
  beam(0.14, 0.14, 2.1, 0, 2.5, 0);
  const ridge = cs(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.7, 6, 12), cap)); ridge.rotation.x = Math.PI / 2; ridge.position.y = 2.6; T.add(ridge);
  beam(1.9, 0.12, 0.12, 0, 1.8, 0.85); beam(1.9, 0.12, 0.12, 0, 1.8, -0.85);
  // лестница
  const lTop = new THREE.Vector3(2.2, 3.7, -0.3), lBot = new THREE.Vector3(4.0, 0, -0.3);
  const Ld = new THREE.Group(); Ld.position.copy(lTop).add(lBot).multiplyScalar(0.5);
  Ld.rotation.z = Math.atan2(lBot.x - lTop.x, lTop.y - lBot.y); g.add(Ld);
  const LL = lTop.distanceTo(lBot);
  [-0.35, 0.35].forEach(z => { const r = cs(new THREE.Mesh(new THREE.BoxGeometry(0.12, LL + 0.3, 0.1), wood)); r.position.z = z; Ld.add(r); });
  for (let i = 0; i < 10; i++) { const s = cs(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.72), wood)); s.position.y = -LL / 2 + 0.3 + i * (LL - 0.4) / 9; Ld.add(s); }
  // данные для катания: лестница, площадка башенки, осевая линия жёлоба (локальные координаты)
  g.userData.ride = { ladderBot: lBot.clone(), ladderTop: lTop.clone(), deck: new THREE.Vector3(1.3, 3.77, -0.3), deckHalf: new THREE.Vector2(0.8, 0.7), path };
  return g;
}
