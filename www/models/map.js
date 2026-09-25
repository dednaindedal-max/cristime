import * as THREE from 'three';
import { cs, std, bake } from './common.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTree1 } from './tree1.js';
import { createTree2 } from './tree2.js';
import { createSnowman } from './snowman.js';
import { createLantern } from './lantern.js';
import { createBench } from './bench.js';
import { createCampfire } from './campfire.js';
import { createGifts } from './gifts.js';
import { createSledHill } from './sledhill.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT } from './layout.js';

// Зимняя карта-парк. Все позиции заданы в пикселях изображения карты (1408x768)
// и переводятся в мир лучом из "эталонной" камеры — раскладка совпадает с картинкой.
export const MAP_CAMERA = { fov: 40, pos: [0, 14, 21], target: [0, 0.7, -2.4], aspect: 1408 / 768 };

export function createMap() {
  const map = new THREE.Group(); map.name = 'map';
  const updates = [];
  const K = 1.15;
  let SLIDE_ZONE = null;

  // --- пиксель картинки -> точка на земле ---
  const refCam = new THREE.PerspectiveCamera(MAP_CAMERA.fov, MAP_CAMERA.aspect, 0.1, 500);
  refCam.position.set(...MAP_CAMERA.pos); refCam.lookAt(...MAP_CAMERA.target); refCam.updateMatrixWorld(); refCam.updateProjectionMatrix();
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const px = (u, v, h = 0) => { plane.constant = -h; ray.setFromCamera(new THREE.Vector2(u / 1408 * 2 - 1, -(v / 768) * 2 + 1), refCam); const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p); return p; };

  const put = (obj, p, s = 1) => {
    if (obj.name === 'tree2' && SLIDE_ZONE && Math.hypot(p.x - SLIDE_ZONE.x, p.z - SLIDE_ZONE.z) < 6) return obj; obj.position.x = p.x; obj.position.z = p.z; obj.scale.multiplyScalar(s * K); return register(obj); };
  const items = [];
  // склейка + кэш одинаковых моделей (ели, скамейки, фонари...) — одна геометрия на все копии
  let instDirty = false, inst = [];
  function syncInstances() {
    if (!CACHE.tree2) return;
    const trees = items.filter(o => o.userData.type === 'tree2');
    if (!inst.length) inst = CACHE.tree2.map(c => { const im = new THREE.InstancedMesh(c.g, c.m, 1500); im.castShadow = c.cs; im.receiveShadow = true; im.frustumCulled = false; map.add(im); return im; });
    trees.forEach((t, i) => { t.updateMatrixWorld(); inst.forEach(im => im.setMatrixAt(i, t.matrixWorld)); });
    inst.forEach(im => { im.count = trees.length; im.instanceMatrix.needsUpdate = true; });
    instDirty = false;
  }
  const CACHE = {}, CACHED = new Set(['tree2', 'block', 'bench', 'lantern', 'gifts']);
  function register(obj) {
    const type = obj.name; let o = obj;
    if (type === 'tree2') {            // ели — инстансинг: 1 draw call на материал для всех елей
      if (!CACHE.tree2) { bake(obj, { keepLights: false }); CACHE.tree2 = obj.children.map(c => ({ g: c.geometry, m: c.material, cs: c.castShadow }));
        const bb = new THREE.Box3().setFromObject(obj); CACHE.tree2box = bb; }
      o = new THREE.Group(); o.name = type; o.position.copy(obj.position); o.rotation.copy(obj.rotation); o.scale.copy(obj.scale);
      const bb = CACHE.tree2box, hs = bb.getSize(new THREE.Vector3()), hc = bb.getCenter(new THREE.Vector3());
      const hit = new THREE.Mesh(new THREE.BoxGeometry(hs.x * 0.7, hs.y, hs.z * 0.7), new THREE.MeshBasicMaterial()); hit.visible = false; hit.position.copy(hc); o.add(hit);
      o.userData.type = type; map.add(o); items.push(o); instDirty = true; return o;
    }
    if (CACHED.has(type)) {
      if (!CACHE[type]) { bake(obj, { keepLights: false }); CACHE[type] = obj.children.map(c => ({ g: c.geometry, m: c.material, cs: c.castShadow })); }
      else {
        o = new THREE.Group(); o.name = type; o.position.copy(obj.position); o.rotation.copy(obj.rotation); o.scale.copy(obj.scale);
        CACHE[type].forEach(c => { const m = new THREE.Mesh(c.g, c.m); m.castShadow = c.cs; m.receiveShadow = true; o.add(m); });
      }
    } else bake(obj, { keepLights: type === 'campfire' });
    o.userData.type = type; map.add(o); items.push(o); if (o.userData.update) updates.push(o.userData.update); return o;
  }
  const faceTo = (o, t) => { o.rotation.y = Math.atan2(t.x - o.position.x, t.z - o.position.z); return o; };

  // ---------- небо + звёзды ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x050d38) }, bottom: { value: new THREE.Color(0x3563c0) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = pow(clamp(vp.y*3.5,0.,1.),0.7); gl_FragColor = vec4(mix(bottom, top, h),1.); }'
  }));
  map.add(sky);
  const sp = []; for (let i = 0; i < 1400; i++) { const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 1.3, r = 200; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, transparent: true, opacity: 0.9, fog: false }));
  map.add(stars);

  // ---------- раскладка (пиксели картинки) ----------
  const TREE = px(705, 385);

  // ---------- ровные дорожки: идеальный эллипс вокруг площадки + прямые лучи ----------
  const T1 = LAYOUT?.find?.(d => d.t === 'tree1');
  const C = T1 ? new THREE.Vector3(T1.x, 0, T1.z) : TREE.clone();
  const RX = 6.8, RZ = 4.9;                                  // кольцевая дорожка (осевая линия)
  const onRing = (deg) => { const a = THREE.MathUtils.degToRad(deg); return new THREE.Vector3(C.x + Math.cos(a) * RX, 0, C.z + Math.sin(a) * RZ); };
  const ringPts = []; for (let i = 0; i <= 240; i++) { const a = i / 240 * Math.PI * 2; ringPts.push(new THREE.Vector3(C.x + Math.cos(a) * RX, 0, C.z + Math.sin(a) * RZ)); }
  const line = (a, b) => { const out = []; for (let i = 0; i <= 40; i++) out.push(a.clone().lerp(b, i / 40)); return out; };
  const paths = [
    { pts: ringPts, w: 1.25 },
    { pts: line(onRing(140), new THREE.Vector3(-30, 0, C.z + 13)), w: 1.1 },   // налево (между скамейкой и костром)
    { pts: line(onRing(20), new THREE.Vector3(30, 0, C.z + 10)), w: 1.1 },     // направо
    { pts: line(onRing(-35), new THREE.Vector3(C.x + 11.5, 0, C.z - 5.2)), w: 1.0 }, // к горке
    { pts: line(onRing(55), new THREE.Vector3(C.x + 13, 0, C.z + 24)), w: 1.05 },   // вниз-вправо
  ];
  const drifts = [[150, 250, 2.6, 0.55], [80, 520, 2.2, 0.5], [880, 640, 3.2, 0.45], [1040, 420, 2.4, 0.5], [1150, 460, 1.8, 0.35],
    [760, 185, 2.2, 0.35], [560, 205, 2.0, 0.3], [500, 330, 1.2, 0.25], [1250, 330, 2.0, 0.4], [620, 700, 1.8, 0.3], [260, 420, 1.3, 0.3]]
    .map(([u, v, r, h]) => { const p = px(u, v); return [p.x, p.z, r, h]; });

  // ---------- рельеф земли: плато, протоптанные тропинки, сугробы ----------
  const GX = 100, GZ = 66, SX = 250, SZ = 165;
  const gg = new THREE.PlaneGeometry(GX, GZ, SX, SZ); gg.rotateX(-Math.PI / 2); gg.translate(0, 0, -12);
  const P = gg.attributes.position, cols = new Float32Array(P.count * 3);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const white = new THREE.Color(0xffffff), trail = new THREE.Color(0xc6d6f0), groove = new THREE.Color(0xa9bee3), tmp = new THREE.Color();
  function distToPath(x, z, path) {
    let best = 1e9; const a = path.pts;
    for (let i = 0; i < a.length - 1; i++) {
      const ax = a[i].x, az = a[i].z, bx = a[i + 1].x, bz = a[i + 1].z, dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const ex = ax + dx * t - x, ez = az + dz * t - z, d = ex * ex + ez * ez; if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    let h = 0, pathF = 0, grooveF = 0;
    // плато под ёлкой
    const ed = Math.hypot((x - C.x) / (RX - 1.9), (z - C.z) / (RZ - 1.45));
    const plat = 1 - sm(0.9, 1.08, ed);
    h += 0.42 * plat + 0.06 * Math.exp(-(((ed - 0.95) / 0.05) ** 2));
    // тропинки
    let bank = 0;
    for (const pth of paths) {
      const d = distToPath(x, z, pth), w = pth.w;
      const f = 1 - sm(w * 0.65, w * 1.05, d);
      pathF = Math.max(pathF, f);
      bank = Math.max(bank, Math.exp(-(((d - w * 1.2) / 0.38) ** 2)));
      // следы от санок / ног внутри тропинки
      grooveF = Math.max(grooveF, f * Math.max(Math.exp(-(((d - w * 0.35) / 0.07) ** 2)), 0.6 * Math.exp(-(((d - w * 0.7) / 0.06) ** 2))));
    }
    h = h * (1 - pathF) - 0.2 * pathF + 0.12 * bank * (1 - plat);
    // сугробы
    for (const [dx, dz, r, dh] of drifts) { const q = ((x - dx) ** 2 + (z - dz) ** 2) / (r * r); if (q < 4) h += dh * Math.exp(-q * 1.6) * (1 - pathF); }
    // мягкий шум
    P.setY(i, h);
    tmp.copy(white).lerp(trail, Math.min(1, pathF * 1.1));
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  gg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); gg.computeVertexNormals();
  const terrain = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  terrain.receiveShadow = true; map.add(terrain); map.userData.terrain = terrain;
  const far = new THREE.Mesh(new THREE.CircleGeometry(300, 64), std(0xffffff, { roughness: 0.95 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.6; far.receiveShadow = true; map.add(far);
  const snow = std(0xffffff, { roughness: 0.95 });

  // ---------- световые пятна на снегу ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,205,120,1)'); gr.addColorStop(0.35, 'rgba(255,180,90,0.45)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false });
  const pool = (p, r, y = 0.5) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r), glowMat); m.rotation.x = -Math.PI / 2; m.position.set(p.x, y, p.z); m.renderOrder = 2; map.add(m); };

  // ---------- объекты ----------
  const blockGeo = new RoundedBoxGeometry(1.0, 0.6, 0.75, 3, 0.15);
  function makeBlock() { const g = new THREE.Group(); g.name = 'block'; const m = cs(new THREE.Mesh(blockGeo, snow)); m.position.y = 0.3; g.add(m); return g; }
  const FACT = { tree1: createTree1, tree2: createTree2, snowman: createSnowman, lantern: createLantern, bench: createBench,
    campfire: createCampfire, gifts: createGifts, sledhill: createSledHill, block: makeBlock };
  // световые пятна и детали — дочерние, двигаются вместе с объектом
  function decorate(o) {
    if (o.userData.decorated) return; o.userData.decorated = true;
    const sc = o.scale.x, t = o.userData.type;
    const addPool = (lx, size) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size / sc, size / sc), glowMat); m.rotation.x = -Math.PI / 2; m.position.set(lx, 0.08 / sc, 0); m.renderOrder = 2; o.add(m); };
    if (t === 'lantern') addPool(1.1, 5.5);
    if (t === 'tree1') addPool(0, 8);
    if (t === 'campfire') { addPool(0, 9); const d = cs(new THREE.Mesh(new THREE.CylinderGeometry(1.25 / sc, 1.45 / sc, 0.14 / sc, 40), snow)); d.position.y = 0.02 / sc; o.add(d);
      o.traverse(c => { if (c.isPointLight) c.distance = 9; }); }
  }
  function spawn(d) {
    const f = FACT[d.t]; if (!f) return null;
    let o = f(); o.position.set(d.x, d.y || 0, d.z); o.rotation.y = d.r || 0; o.scale.setScalar(d.s || 1);
    o = register(o); decorate(o); return o;
  }
  function removeItem(o) { const i = items.indexOf(o); if (i >= 0) items.splice(i, 1); map.remove(o); instDirty = true; const u = o.userData.update; if (u) { const k = updates.indexOf(u); if (k >= 0) updates.splice(k, 1); } }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  function exportCode() {
    const rows = items.map(o => `  { t: '${o.userData.type}', x: ${r3(o.position.x)}, y: ${r3(o.position.y)}, z: ${r3(o.position.z)}, r: ${r3(o.rotation.y)}, s: ${r3(o.scale.x)} },`);
    return `// Сюда вставляется код из редактора (кнопка «Скопировать код»).\nexport const LAYOUT = [\n${rows.join('\n')}\n];\n`;
  }

  if (LAYOUT && LAYOUT.length) LAYOUT.forEach(spawn);
  else { defaults(); items.forEach(decorate); }

  function defaults() {
  // ---------- центр ----------
  const tree = createTree1(); tree.position.y = 0.4; put(tree, TREE, 0.72);
  [[640, 405, 0.55, 0.4], [770, 400, 0.5, -0.5], [700, 430, 0.42, 0.1]].forEach(([u, v, s, r]) => { const g = createGifts(); g.position.y = 0.4; put(g, px(u, v, 0.4), s).rotation.y = r; });

  // ---------- объекты по картинке ----------
  faceTo(put(createSnowman(), px(410, 415), 0.55), px(430, 700));

  const SLIDE = new THREE.Vector3();
  // горка: башня и конец спуска в точках картинки
  { const T = px(1215, 290), E = px(990, 330);
    const Lt = new THREE.Vector3(1.3, 0, -0.3), Le = new THREE.Vector3(-5.2, 0, 0.8), L = Le.clone().sub(Lt), W = E.clone().sub(T);
    const s = 1.15, th = Math.atan2(L.z, L.x) - Math.atan2(W.z, W.x);
    const hill = createSledHill(); hill.scale.setScalar(s); hill.rotation.y = th;
    const off = Lt.clone().multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 1, 0), th);
    hill.position.copy(T).sub(off); register(hill); SLIDE.copy(T); SLIDE_ZONE = T.clone().lerp(E, 0.35); }

  // костёр + снежные блоки
  const F = px(545, 578);
  const fire = put(createCampfire(), F, 0.55); fire.traverse(o => { if (o.isPointLight) o.distance = 9; });
  const FR = px(690, 578).x - F.x, FRZ = px(545, 655).z - F.z;
  for (let i = 0; i < 10; i++) {
    const a = THREE.MathUtils.degToRad(-120 + i * 26), b = makeBlock();
    b.position.set(F.x + Math.cos(a) * FR, 0, F.z + Math.sin(a) * FRZ); b.rotation.y = -a + Math.PI / 2; register(b);
  }

  // скамейки: [позиция, куда смотрит сиденье] — сверено с картинкой
  [[[460, 240], [500, 420]],    // верхняя — лицом к камере, чуть вправо
   [[300, 300], [350, 470]],    // у фонаря слева — к камере
   [[355, 470], [420, 620]],    // под снеговиком — к камере, над дорожкой
   [[345, 640], [520, 560]],    // у костра — спиной к камере, к огню
   [[480, 675], [530, 560]],    // у костра — спиной к камере, к огню
   [[1195, 480], [1080, 470]]]  // справа — боком, к дорожке слева
    .forEach(([p, t]) => faceTo(put(createBench(), px(...p), 0.6), px(...t)));

  // фонари: основание + точка, куда направлен кронштейн
  [[[237, 345], [330, 345]], [[380, 285], [470, 285]], [[550, 238], [640, 238]], [[873, 305], [960, 300]], [[1220, 415], [1130, 415]], [[258, 540], [350, 540]], [[1122, 640], [1030, 640]]]
    .forEach(([p, t]) => {
      const b = px(...p), tp = px(...t), l = put(createLantern(), b, 0.55);
      const ang = Math.atan2(tp.z - b.z, tp.x - b.x); l.rotation.y = -ang;
    });

  // ---------- ели ----------
  const firPx = [[35, 300], [65, 250], [100, 200], [140, 170], [185, 130], [250, 120], [290, 160], [330, 120], [430, 110], [500, 110], [570, 100], [840, 110], [890, 120], [960, 100], [1050, 110], [1110, 90], [1300, 110], [1350, 150], [1380, 230], [1320, 300], [1360, 350],
    [30, 480], [1390, 520], [150, 330], [200, 280], [1290, 250]];
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  firPx.forEach(([u, v]) => put(createTree2(), px(u, v), 0.55 + rnd() * 0.2).rotation.y = rnd() * 6);
  [[230, 700], [1175, 705], [1320, 640]].forEach(([u, v]) => put(createTree2(), px(u, v), 0.42).rotation.y = rnd() * 6);
  for (let v = 170; v <= 600; v += 55) { put(createTree2(), px(20 + rnd() * 60, v), 0.6 + rnd() * 0.15).rotation.y = rnd() * 6; put(createTree2(), px(1330 + rnd() * 60, v + 20), 0.6 + rnd() * 0.15).rotation.y = rnd() * 6; }
  for (let u = 80; u <= 1330; u += 95) if (u < 1000 || u > 1300) put(createTree2(), px(u + rnd() * 40, 150 + rnd() * 25), 0.55 + rnd() * 0.15).rotation.y = rnd() * 6;
  // задние ряды до горизонта
  for (let u = -100; u <= 1500; u += 75) put(createTree2(), px(u + rnd() * 30, 118 + rnd() * 20), 0.6 + rnd() * 0.2).rotation.y = rnd() * 6;
  for (let u = -60; u <= 1500; u += 90) put(createTree2(), px(u + rnd() * 30, 80), 0.7).rotation.y = rnd() * 6;
  for (let x = -30; x <= 30; x += 99) put(createTree2(), new THREE.Vector3(x + rnd(), 0, -15.5 - rnd() * 2), 0.9 + rnd() * 0.3).rotation.y = rnd() * 6;
  for (let z = -10; z <= 14; z += 2.6) { put(createTree2(), new THREE.Vector3(-21 - rnd() * 2, 0, z), 0.9).rotation.y = rnd() * 6; put(createTree2(), new THREE.Vector3(21 + rnd() * 2, 0, z), 0.9).rotation.y = rnd() * 6; }

  }

  map.userData.items = items; map.userData.sync = () => { instDirty = true; syncInstances(); }; map.userData.spawn = spawn; map.userData.removeItem = removeItem; map.userData.exportCode = exportCode;
  syncInstances();

  // ---------- высота земли по сетке (без рейкаста) ----------
  const hp = gg.attributes.position, stepX = GX / SX, stepZ = GZ / SZ;
  map.userData.heightAt = (x, z) => {
    const fx = (x + GX / 2) / stepX, fz = (z + 12 + GZ / 2) / stepZ;
    const ix = Math.max(0, Math.min(SX - 1, Math.floor(fx))), iz = Math.max(0, Math.min(SZ - 1, Math.floor(fz)));
    const ux = Math.min(1, Math.max(0, fx - ix)), uz = Math.min(1, Math.max(0, fz - iz));
    const h = (a, b) => hp.getY(b * (SX + 1) + a);
    return (h(ix, iz) * (1 - ux) + h(ix + 1, iz) * ux) * (1 - uz) + (h(ix, iz + 1) * (1 - ux) + h(ix + 1, iz + 1) * ux) * uz;
  };
  // ---------- склейка всей статики в несколько draw call'ов (для игры) ----------
  let frozen = null;
  map.userData.freeze = (on) => {
    if (frozen) { frozen.forEach(m => { map.remove(m); m.geometry.dispose(); }); frozen = null; items.forEach(o => o.visible = true); }
    if (!on) return;
    map.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(map.matrixWorld).invert(), groups = new Map();
    items.forEach(o => {
      if (o.userData.type === 'tree2' || o.userData.type === 'tree1' || o.userData.type === 'campfire') return;
      o.traverse(c => {
        if (!c.isMesh || Array.isArray(c.material)) return;
        const gm = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        gm.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        for (const n of Object.keys(gm.attributes)) if (!['position', 'normal', 'uv'].includes(n)) gm.deleteAttribute(n);
        if (!gm.attributes.normal) gm.computeVertexNormals();
        if (c.material.map && !gm.attributes.uv) gm.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gm.attributes.position.count * 2), 2));
        if (!c.material.map && gm.attributes.uv) gm.deleteAttribute('uv');
        const k = c.material.uuid + (c.castShadow ? 1 : 0) + '|' + (c.renderOrder || 0);
        if (!groups.has(k)) groups.set(k, { m: c.material, cs: c.castShadow, ro: c.renderOrder, g: [] });
        groups.get(k).g.push(gm);
      });
      o.visible = false;
    });
    frozen = [];
    groups.forEach(v => { const mg = mergeGeometries(v.g, false); v.g.forEach(x => x.dispose()); if (!mg) return;
      mg.computeBoundingSphere(); const m = new THREE.Mesh(mg, v.m); m.castShadow = v.cs; m.receiveShadow = true; m.renderOrder = v.ro; map.add(m); frozen.push(m); });
    items.forEach(o => { if (!o.visible && (o.userData.type === 'tree2')) o.visible = true; });
  };
  // ---------- коллизии: повернутые прямоугольники и круги по реальным габаритам ----------
  map.userData.colliders = () => items.flatMap(o => {
    const t = o.userData.type;
    if (t === 'sledhill') return sledColliders(o);
    const _r = (() => { const ry = o.rotation.y; o.rotation.y = 0; o.updateMatrixWorld(true);
    let bb;
    if (t === 'tree2') { bb = CACHE.tree2box.clone(); bb.min.multiplyScalar(o.scale.x); bb.max.multiplyScalar(o.scale.x); bb.translate(o.position); }
    else { bb = new THREE.Box3(); o.traverse(c => { if (c.isMesh && c.visible !== false && !(c.material && c.material.transparent)) { c.geometry.computeBoundingBox(); bb.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld)); } }); }
    o.rotation.y = ry; o.updateMatrixWorld(true);
    if (bb.isEmpty()) return null;
    const c = bb.getCenter(new THREE.Vector3()), h = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const off = new THREE.Vector3(c.x - o.position.x, 0, c.z - o.position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    const cx = o.position.x + off.x, cz = o.position.z + off.z, top = bb.max.y;
    if (t === 'tree2') return { k: 'c', x: o.position.x, z: o.position.z, r: Math.max(h.x, h.z) * 0.6, top: 99 };
    if (t === 'tree1') return { k: 'c', x: o.position.x, z: o.position.z, r: Math.max(h.x, h.z) * 0.85, top: 99 };
    if (t === 'lantern') return { k: 'c', x: o.position.x, z: o.position.z, r: 0.14, top };
    if (t === 'snowman') return { k: 'c', x: cx, z: cz, r: Math.min(h.x, h.z) * 0.95, top };
    if (t === 'campfire') return { k: 'c', x: o.position.x, z: o.position.z, r: 1.0, top };
    const f = t === 'sledhill' ? 0.9 : t === 'gifts' ? 0.9 : 1;
    return { k: 'b', x: cx, z: cz, hx: h.x * f, hz: h.z * f, cos: Math.cos(ry), sin: Math.sin(ry), top };
    })(); return _r ? [_r] : [];
  });
  function sledColliders(o) {
    o.updateMatrixWorld(true); const R = o.userData.ride, sc = o.scale.x, out = [];
    const w = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld);
    const c1 = w(1.1, 0, -0.25); out.push({ k: 'c', x: c1.x, z: c1.z, r: 1.95 * sc, top: 99 });
    [[0.3, -1.3, 1.05], [2.1, -1.4, 0.8], [-0.3, 0.9, 0.75]].forEach(([x, z, r]) => { const q = w(x, 0, z); out.push({ k: 'c', x: q.x, z: q.z, r: r * sc, top: 99 }); });
    [-0.35, 0.35].forEach(z => { const q = w(4.0, 0, z); out.push({ k: 'c', x: q.x, z: q.z, r: 0.07 * sc, top: 99 }); });   // стойки лестницы
    const c2 = w(1.9, 0, 0.9); out.push({ k: 'c', x: c2.x, z: c2.z, r: 1.1 * sc, top: 99 });
    for (let i = 0; i <= 8; i++) { const u = i / 8 * 0.78, p = R.path.getPoint(u), q = w(p.x, 0, p.z); out.push({ k: 'c', x: q.x, z: q.z, r: (1.25 + p.y * 0.2) * sc, top: 99 }); }
    return out;
  }
  // мировые данные горки для лестницы/спуска
  map.userData.sledRide = () => {
    const o = items.find(i => i.userData.type === 'sledhill'); if (!o) return null;
    o.updateMatrixWorld(true); const R = o.userData.ride, M = o.matrixWorld;
    const W = v => v.clone().applyMatrix4(M);
    return { ladderBot: W(R.ladderBot), ladderTop: W(R.ladderTop), deck: W(R.deck), scale: o.scale.x, ry: o.rotation.y,
      toWorld: M.clone(), toLocal: v => v.clone().applyMatrix4(M.clone().invert()), deckHalf: R.deckHalf,
      point: u => W(R.path.getPoint(u)), tangent: u => R.path.getTangent(u).transformDirection(M), length: R.path.getLength() * o.scale.x };
  };
  map.userData.update = (t) => { if (instDirty) syncInstances(); updates.forEach(u => u(t)); stars.material.opacity = 0.75 + Math.sin(t * 2) * 0.15; };
  return map;
}
