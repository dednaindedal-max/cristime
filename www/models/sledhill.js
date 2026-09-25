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

  // холм: одна гладкая снежная гора с мягкими наплывами (вместо груды шаров)
  {
    const hg = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), P = hg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const th = Math.atan2(v.z, v.x), el = v.y;
      const n = 1 + 0.07 * Math.sin(th * 5 + 1) * Math.sin(el * 3) + 0.05 * Math.sin(th * 9 + 2.3) * (1 - el) + 0.04 * Math.sin(th * 3 + el * 6);
      const flare = 1 + 0.25 * (1 - el) ** 3;                    // пологое расширение к земле
      P.setXYZ(i, v.x * n * flare, v.y * (1 + 0.03 * Math.sin(th * 4)), v.z * n * flare); }
    hg.computeVertexNormals();
    const hill = cs(new THREE.Mesh(hg, snow)); hill.scale.set(1.65, 3.62, 1.95); hill.position.set(1.1, 0, -0.25); g.add(hill);
    [[2.1, 1.0, 0.9, 0.9, 1.2], [0.3, -1.3, 1.1, 0.9, 1.2], [2.1, -1.4, 0.8, 0.8, 1.0], [-0.3, 0.9, 0.8, 0.7, 0.9]].forEach(([x, z, rx, rz, h]) => {
      const m = cs(new THREE.Mesh(hg, snow)); m.scale.set(rx, h, rz); m.position.set(x, 0, z); g.add(m); });
  }
  const lumpGeo = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  // ===== Спуск: сугроб-насыпь из комьев + ледяной жёлоб + снежные бортики =====
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.45, 3.5, -0.3), new THREE.Vector3(-0.5, 3.0, -0.15), new THREE.Vector3(-1.7, 1.95, 0.1),
    new THREE.Vector3(-2.9, 0.95, 0.35), new THREE.Vector3(-4.0, 0.38, 0.55), new THREE.Vector3(-5.0, 0.24, 0.7)]);
  const up = new THREE.Vector3(0, 1, 0);
  const frameAt = (u) => { const p = path.getPoint(u), t = path.getTangent(u); return { p, t, side: new THREE.Vector3().crossVectors(t, up).setY(0).normalize(), w: 0.95 + u * 0.3 }; };

  // насыпь: одна гладкая «вылепленная» снежная масса вдоль спуска (без швов и гусеницы из шаров)
  {
    const NU = 60, NS = 28, P = [], I = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU, f = frameAt(u), top = f.p.y - 0.02, inner = f.w + 0.28, W = inner + 0.35 + top * 0.75;
      for (let j = 0; j <= NS; j++) {
        const v = j / NS * 2 - 1, sx = v * W, ax = Math.abs(sx);
        let y = ax <= inner ? top + 0.02 * (1 - (ax / inner) ** 2) : top * (0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (ax - inner) / (W - inner))));
        y += 0.05 * Math.sin(u * 23 + v * 5) * Math.sin(Math.PI * Math.min(1, (ax - inner) / (W - inner) + 0.001)) * (ax > inner ? 1 : 0);   // мягкие неровности на склонах
        y = Math.max(0, y - (j === 0 || j === NS ? 0.05 : 0));
        P.push(f.p.x + f.side.x * sx, y, f.p.z + f.side.z * sx);
        if (i < NU && j < NS) { const k = i * (NS + 1) + j; I.push(k, k + NS + 1, k + 1, k + 1, k + NS + 1, k + NS + 2); }
      }
    }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); eg.setIndex(I); eg.computeVertexNormals();
    const em = cs(new THREE.Mesh(eg, std(0xdfeaf7, { roughness: 0.8, emissive: 0xc8d8f0, emissiveIntensity: 0.05, side: THREE.DoubleSide }))); g.add(em);
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
  const icol = []; for (let i = 0; i <= N; i++) for (let j = 0; j <= CH; j++) { const e = Math.abs(j / CH - 0.5) * 2, st = Math.abs(Math.sin(i * 0.9)) < 0.12 ? 0.06 : 0;
    icol.push(0.55 + e * 0.3 + st, 0.78 + e * 0.15 + st, 0.98); }
  cg.setAttribute('color', new THREE.Float32BufferAttribute(icol, 3));
  const iceM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.08, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0x16305a, emissiveIntensity: 0.25, side: THREE.DoubleSide });
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
  // снег на перилах и сосульки по краю крыши
  [0.8, -0.8].forEach(z => { const c = cs(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 1.6, 4, 10), cap)); c.rotation.z = Math.PI / 2; c.scale.set(1, 1, 0.8); c.position.set(0, 0.79, z); T.add(c); });
  const icM = new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, roughness: 0.05, transmission: 0.3, thickness: 0.2, emissive: 0x335577, emissiveIntensity: 0.2 });
  const icG = new THREE.ConeGeometry(0.035, 1, 6);
  [-1, 1].forEach(sd => { for (let i = 0; i < 9; i++) { const l = 0.12 + ((i * 37) % 11) / 11 * 0.22, ic = new THREE.Mesh(icG, icM);
    ic.scale.set(1, l, 1); ic.rotation.x = Math.PI; ic.position.set(sd * 1.02, 1.8 - l / 2, -0.9 + i * 0.225); T.add(ic); } });
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
