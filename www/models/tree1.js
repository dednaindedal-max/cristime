import * as THREE from 'three';

// Большая украшенная новогодняя ёлка (tree1)
export function createTree1() {
  const tree = new THREE.Group();
  tree.name = 'tree1';
  const cs = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

  const M = {
    green: std(0x56b83a, { roughness: 0.7, flatShading: true }),
    greenD: std(0x3f9a2a, { roughness: 0.75, flatShading: true }),
    bark: std(0x8e4f2a, { roughness: 0.9 }),
    snow: std(0xffffff, { roughness: 0.85, emissive: 0xf0f4fa, emissiveIntensity: 0.15 }),
    potRed: std(0xc8262a, { roughness: 0.45 }),
    gold: std(0xe8b23a, { metalness: 0.8, roughness: 0.28 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd780, emissiveIntensity: 3 }),
    wire: std(0xc79a3a, { metalness: 0.6, roughness: 0.4 }),
    star: new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xffa800, emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.3 }),
  };

  // ---------- Кадка ----------
  const pot = new THREE.Group();
  pot.add(cs(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.85, 40), M.potRed)));
  pot.children[0].position.y = 0.5;
  const base = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.95, 0.12, 40), M.gold));
  base.position.y = 0.06; pot.add(base);
  const rim = cs(new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.07, 12, 48), M.gold));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.93; pot.add(rim);
  const rim2 = cs(new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.045, 10, 48), M.gold));
  rim2.rotation.x = Math.PI / 2; rim2.position.y = 0.14; pot.add(rim2);
  // золотые фестоны
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, a = a0 + (a1 - a0) * u;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.95, 0.8 - Math.sin(u * Math.PI) * 0.22, Math.sin(a) * 0.95));
    }
    pot.add(cs(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 8), M.gold)));
    const knob = cs(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), M.gold));
    knob.position.set(Math.cos(a0) * 0.96, 0.81, Math.sin(a0) * 0.96); pot.add(knob);
  }
  const potSnow = cs(new THREE.Mesh(new THREE.SphereGeometry(0.88, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.snow));
  potSnow.scale.y = 0.18; potSnow.position.y = 0.92; pot.add(potSnow);
  tree.add(pot);

  // ---------- Ствол ----------
  const trunk = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.3, 16), M.bark));
  trunk.position.y = 1.5; tree.add(trunk);

  // ---------- Ярусы ----------
  const tiers = [
    { y: 1.75, r: 2.15, h: 1.5 },
    { y: 2.75, r: 1.85, h: 1.4 },
    { y: 3.7,  r: 1.5,  h: 1.25 },
    { y: 4.55, r: 1.12, h: 1.1 },
    { y: 5.3,  r: 0.75, h: 0.95 },
  ];
  const lobeGeo = new THREE.CylinderGeometry(0.34, 0.26, 0.22, 6);

  function snowRing(r, y, thick, seed) {
    const g = new THREE.TorusGeometry(r, thick, 10, 64);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.y, v.x);
      const wave = Math.sin(a * 9 + seed) * 0.5 + Math.sin(a * 17 + seed * 2) * 0.25;
      // тор лежит в XY -> после поворота z станет высотой
      if (v.z < 0) v.z *= 1.0 + 0.9 * Math.max(0, wave); // капли вниз
      v.z *= 0.75;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = cs(new THREE.Mesh(g, M.snow));
    m.rotation.x = -Math.PI / 2; m.position.y = y;
    return m;
  }

  tiers.forEach((t, ti) => {
    const cone = cs(new THREE.Mesh(new THREE.ConeGeometry(t.r * 0.95, t.h, 12), ti % 2 ? M.green : M.greenD));
    cone.position.y = t.y + t.h / 2; cone.rotation.y = ti * 0.26;
    tree.add(cone);
    const n = Math.round(t.r * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ti * 0.3;
      const pv = new THREE.Group(); pv.position.y = t.y + 0.02; pv.rotation.y = -a;
      const lobe = cs(new THREE.Mesh(lobeGeo, i % 2 ? M.green : M.greenD));
      const s = Math.min(1, t.r / 1.6);
      lobe.scale.set(1.2 * s, 1, 0.95 * s);
      lobe.position.x = t.r * 0.95; lobe.rotation.z = -0.5; lobe.rotation.y = Math.PI / 6;
      pv.add(lobe); tree.add(pv);
    }
    // волнистое снежное кольцо поверх следующего яруса
    const ringY = t.y + t.h * 0.22, ringR = t.r * 0.78;
    tree.add(snowRing(ringR, ringY, 0.16 + t.r * 0.04, ti * 1.7));
  });

  // верхушка + снег
  const tip = cs(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 10), M.green));
  tip.position.y = 6.45; tree.add(tip);
  const cap = cs(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0.62), new THREE.Vector2(0.14, 0.56), new THREE.Vector2(0.3, 0.3),
    new THREE.Vector2(0.48, 0.05), new THREE.Vector2(0.5, -0.05), new THREE.Vector2(0, -0.05)], 28), M.snow));
  cap.position.y = 6.3; tree.add(cap);
  // маленькие снежные пятнышки у верхушки
  [[0.35, 6.2, 0.3], [-0.25, 6.05, 0.4], [0.1, 5.95, 0.55]].forEach(([x, y, z]) => {
    const d = cs(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.snow));
    d.position.set(x, y, z); tree.add(d);
  });

  // радиус поверхности ёлки на высоте y
  function surfaceR(y) {
    for (const t of tiers) if (y >= t.y && y <= t.y + t.h) return t.r * 0.95 * (1 - (y - t.y) / t.h);
    return 0.4;
  }

  // ---------- Гирлянда ----------
  const garland = [];
  const gPts = [];
  const turns = 4.2, y0 = 1.95, y1 = 6.35;
  for (let k = 0; k <= 400; k++) {
    const u = k / 400, y = y0 + (y1 - y0) * u, a = u * turns * Math.PI * 2 + 0.6;
    // тянем гирлянду между ярусами: провисание
    const r = Math.max(surfaceR(y), 0) + 0.28 * (1 - u * 0.5);
    gPts.push(new THREE.Vector3(Math.cos(a) * r, y - 0.08 * Math.sin(a * 2), Math.sin(a) * r));
  }
  const gCurve = new THREE.CatmullRomCurve3(gPts);
  tree.add(new THREE.Mesh(new THREE.TubeGeometry(gCurve, 300, 0.022, 4), M.wire));
  const bulbGeo = new THREE.SphereGeometry(0.06, 6, 4);
  for (let i = 0; i < 90; i++) {
    const p = gCurve.getPoint(i / 89);
    const b = new THREE.Mesh(bulbGeo, M.bulb);
    b.position.copy(p); tree.add(b); garland.push(b);
  }

  // ---------- Игрушки ----------
  const palettes = [0xd8262e, 0x2a6fd6, 0x2fae3e, 0xe8b23a, 0xc0c8d0];
  function stripeTexture(c1, c2) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = c1; x.fillRect(0, 0, 64, 64);
    x.fillStyle = c2; for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 7);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const stripeMats = [
    std(0xffffff, { map: stripeTexture('#d8262e', '#f3e6c8'), roughness: 0.35 }),
    std(0xffffff, { map: stripeTexture('#2a6fd6', '#e9eef8'), roughness: 0.35 }),
  ];
  function ball(color, r, striped) {
    const g = new THREE.Group();
    const mat = striped != null ? stripeMats[striped]
      : std(color, { metalness: 0.35, roughness: 0.25, emissive: color, emissiveIntensity: 0.06 });
    const s = cs(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat)); s.position.y = -r; g.add(s);
    const c = cs(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, r * 0.3, 12), M.gold)); c.position.y = 0.01; g.add(c);
    const lp = new THREE.Mesh(new THREE.TorusGeometry(r * 0.15, r * 0.04, 6, 12), M.gold); lp.position.y = r * 0.2; g.add(lp);
    return g;
  }
  function bell() {
    const g = new THREE.Group();
    const body = cs(new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.13, -0.02), new THREE.Vector2(0.11, -0.06),
      new THREE.Vector2(0.075, -0.14), new THREE.Vector2(0.06, -0.22), new THREE.Vector2(0, -0.24)].reverse(), 16), M.gold));
    body.position.y = -0.04; g.add(body);
    const bowM = std(0xd8262e, { roughness: 0.5 });
    [-1, 1].forEach(s => { const l = cs(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bowM)); l.scale.set(1.3, 0.8, 0.5); l.position.set(s * 0.07, 0.0, 0.02); g.add(l); });
    return g;
  }
  function miniStar() {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.05 : 0.12, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const m = cs(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), M.gold));
    m.position.y = -0.12; const g = new THREE.Group(); g.add(m); return g;
  }
  function bowGift() { // бантик-игрушка
    const g = new THREE.Group(); const m = std(0x2a6fd6, { roughness: 0.45 });
    [-1, 1].forEach(s => { const l = cs(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 8, 14), m)); l.position.x = s * 0.055; l.rotation.y = s * 0.3; g.add(l); });
    const k = cs(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m)); g.add(k); g.position.y -= 0.02; return g;
  }

  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const orn = [];
  tiers.forEach((t, ti) => {
    // по краю яруса (висят снизу) и на поверхности
    const n = Math.round(t.r * 5.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ti * 0.7 + rnd() * 0.3;
      const kind = rnd();
      let o;
      if (kind < 0.55) o = ball(palettes[Math.floor(rnd() * palettes.length)], 0.13 + rnd() * 0.05);
      else if (kind < 0.7) o = ball(0, 0.14, Math.floor(rnd() * 2));
      else if (kind < 0.82) o = bell();
      else if (kind < 0.93) o = miniStar();
      else o = bowGift();
      const edge = i % 2 === 0;
      const y = edge ? t.y + 0.02 : t.y + t.h * 0.45;
      const r = edge ? t.r * 1.0 : surfaceR(y) + 0.1;
      o.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      o.rotation.y = -a + Math.PI / 2;
      o.userData.phase = rnd() * 6;
      tree.add(o); orn.push(o);
    }
  });

  // ---------- Звезда ----------
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.26 : 0.6, a = i / 10 * Math.PI * 2 + Math.PI / 2;
    i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.08, bevelSegments: 3 });
  starGeo.center();
  const star = cs(new THREE.Mesh(starGeo, M.star));
  star.position.y = 7.45; star.userData.keep = true; tree.add(star);
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  inner.scale.setScalar(0.55); inner.position.set(0, 7.45, 0.16); inner.userData.keep = true; tree.add(inner);
  // точки-стразы на звезде
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + Math.PI / 2;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.bulb);
    d.position.set(Math.cos(a) * 0.42, 7.45 + Math.sin(a) * 0.42, 0.14); tree.add(d);
  }
  const stem = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 12), M.gold));
  stem.position.y = 6.85; tree.add(stem);
  const starLight = new THREE.PointLight(0xffc860, 6, 5, 2);
  starLight.position.set(0, 7.45, 0.6); tree.add(starLight);

  // ---------- Анимация ----------
  tree.userData.update = (t) => {
    M.bulb.emissiveIntensity = 2.4 + Math.sin(t * 3) * 0.9;
    orn.forEach(o => { o.rotation.z = Math.sin(t * 1.4 + o.userData.phase) * 0.06; });
    star.rotation.y = Math.sin(t * 0.8) * 0.25;
    inner.rotation.y = star.rotation.y;
    starLight.intensity = 5 + Math.sin(t * 2) * 1.5;
  };
  return tree;
}
