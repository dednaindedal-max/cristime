import * as THREE from 'three';

// Обычная снежная ель (tree2)
export function createTree2() {
  const tree = new THREE.Group();
  tree.name = 'tree2';
  const cs = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const green = new THREE.MeshStandardMaterial({ color: 0x5cb53a, roughness: 0.7, flatShading: true });
  const greenD = new THREE.MeshStandardMaterial({ color: 0x46a02c, roughness: 0.75, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: 0xa2592a, roughness: 0.85 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0xf0f4fa, emissiveIntensity: 0.15 });

  // ствол с расширением у земли
  tree.add(cs(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0.5, 0.1),
    new THREE.Vector2(0.4, 0.45), new THREE.Vector2(0.33, 0.95), new THREE.Vector2(0.3, 1.5), new THREE.Vector2(0, 1.5)], 12), bark)));

  // снежный холмик у основания — ствол «сидит» в сугробе, а не висит над землёй
  const mound = cs(new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow));
  mound.scale.set(1, 0.32, 1); mound.position.y = -0.08; tree.add(mound);
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + 0.4, m2 = cs(new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), snow));
    m2.scale.set(1.2, 0.45, 0.9); m2.position.set(Math.cos(a) * 0.8, -0.05, Math.sin(a) * 0.8); m2.rotation.y = -a; tree.add(m2); }
  const tiers = [
    { y: 1.1,  r: 1.7,  h: 1.3 },
    { y: 2.05, r: 1.45, h: 1.15 },
    { y: 2.9,  r: 1.12, h: 1.0 },
    { y: 3.6,  r: 0.75, h: 0.9 },
  ];
  // гранёная "лапка": шестигранник с фаской
  const lobeGeo = new THREE.CylinderGeometry(0.32, 0.25, 0.24, 6);
  const blob = new THREE.SphereGeometry(0.3, 7, 4);

  tiers.forEach((t, ti) => {
    const cone = cs(new THREE.Mesh(new THREE.ConeGeometry(t.r * 0.9, t.h, 10), ti % 2 ? green : greenD));
    cone.position.y = t.y + t.h / 2; cone.rotation.y = ti * 0.3; tree.add(cone);
    // два ряда лапок: нижний свисающий и промежуточный
    [[1.0, 0, -0.5], [0.72, t.h * 0.35, -0.35]].forEach(([rf, dy, tilt], row) => {
      const n = Math.round(t.r * (row ? 5 : 6.5));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ti * 0.4 + row * 0.3;
        const pv = new THREE.Group(); pv.position.y = t.y + dy; pv.rotation.y = -a;
        const l = cs(new THREE.Mesh(lobeGeo, (i + row) % 2 ? green : greenD));
        const s = Math.min(1, t.r / 1.4) * (row ? 0.8 : 1);
        l.scale.set(1.25 * s, 1, 0.95 * s);
        l.position.x = t.r * rf * 0.92; l.rotation.z = tilt; l.rotation.y = Math.PI / 6;
        pv.add(l); tree.add(pv);
      }
    });
    // пухлые снежные подушки кусками (как на картинке — не сплошным кольцом)
    const patches = ti === 3 ? [[0, 6.3]]
      : [[-2.0 + ti * 0.5, 1.2], [-0.4 + ti * 0.3, 1.4], [1.5 + ti * 0.2, 1.1], [3.2 + ti * 0.4, 1.2]];
    patches.forEach(([start, len]) => {
      const steps = Math.max(3, Math.round(len * 3));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps, a = start + u * len, e = Math.sin(u * Math.PI);
        const b = cs(new THREE.Mesh(blob, snow));
        const sc = (0.7 + 0.5 * e) * (t.r / 1.4);
        b.scale.set(sc * 1.3, sc * 0.62, sc * 1.05);
        const rr = t.r * (0.7 + 0.08 * e);
        b.position.set(Math.cos(a) * rr, t.y + t.h * 0.28 + 0.06 * e, Math.sin(a) * rr);
        b.rotation.y = -a; tree.add(b);
      }
    });
  });

  // верхушка: большая снежная шапка
  const tip = cs(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 8), green));
  tip.position.y = 4.55; tree.add(tip);
  const cap = cs(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 1.05), new THREE.Vector2(0.14, 0.98), new THREE.Vector2(0.27, 0.72),
    new THREE.Vector2(0.42, 0.35), new THREE.Vector2(0.62, 0.1), new THREE.Vector2(0.64, 0),
    new THREE.Vector2(0.52, -0.1), new THREE.Vector2(0, -0.1)].reverse(), 16), snow));
  cap.position.y = 4.4; tree.add(cap);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, d = cs(new THREE.Mesh(blob, snow));
    d.scale.set(0.48, 0.42, 0.48); d.position.set(Math.cos(a) * 0.52, 4.38 - (i % 2) * 0.05, Math.sin(a) * 0.52);
    tree.add(d);
  }
  return tree;
}
