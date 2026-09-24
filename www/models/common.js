import * as THREE from 'three';
export const cs = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
export const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
export const snowMat = () => std(0xffffff, { roughness: 0.85, emissive: 0xeef3fa, emissiveIntensity: 0.15 });
// деревянная текстура с волокнами
export function woodTex(base = '#d98a3a', line = '#b8692a') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const x = cv.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 64);
  x.strokeStyle = line; x.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { x.beginPath(); const y = 4 + i * 7; x.moveTo(0, y);
    for (let k = 0; k <= 256; k += 16) x.lineTo(k, y + Math.sin(k * 0.05 + i) * 2); x.stroke(); }
  x.fillStyle = line; x.beginPath(); x.ellipse(170, 30, 6, 3, 0, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// снежный налёт вдоль линии (серия приплюснутых капсул)
export function snowStrip(a, b, w = 0.06, mat) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = cs(new THREE.Mesh(new THREE.CapsuleGeometry(w, len, 3, 6), mat));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.scale.set(1, 1, 0.55); return m;
}
// гладкая спираль-завиток для кованых деталей
export function scroll(r0, turns, thick, mat, flip = 1) {
  const pts = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * turns * Math.PI * 2, r = r0 * (1 - u * 0.8);
    pts.push(new THREE.Vector3(Math.cos(a) * r * flip, Math.sin(a) * r, 0)); }
  return cs(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, thick, 5), mat));
}
export function tube(points, r, mat, seg = 60) {
  return cs(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.min(seg, 24), r, 6), mat));
}

// ---------- оптимизация: склейка всех мешей модели по материалам (мало draw calls) ----------
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function bake(root, { keepLights = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(), keep = [];
  (function walk(node) {
    for (const o of [...node.children]) {
      if (o.userData.keep || o.isPoints) { keep.push(o); continue; }
      if (o.isLight) { if (keepLights) keep.push(o); continue; }
      if (o.isMesh && !Array.isArray(o.material)) {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        const k = o.material.uuid; if (!groups.has(k)) groups.set(k, { mat: o.material, geos: [] });
        groups.get(k).geos.push(g);
      }
      walk(o);
    }
  })(root);
  const keepMats = keep.map(o => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
  root.clear();
  groups.forEach(({ mat, geos }) => {
    const needUv = !!mat.map;
    geos.forEach(g => {
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (needUv && !g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!needUv && g.attributes.uv) g.deleteAttribute('uv');
      g.morphAttributes = {};
    });
    const merged = mergeGeometries(geos, false); if (!merged) return;
    const m = new THREE.Mesh(merged, mat);
    const solid = !mat.transparent && !mat.isMeshBasicMaterial;
    m.castShadow = solid; m.receiveShadow = true; root.add(m);
  });
  keep.forEach((o, i) => { keepMats[i].decompose(o.position, o.quaternion, o.scale); root.add(o); });
  return root;
}
