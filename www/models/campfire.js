import * as THREE from 'three';
import { cs, std, snowMat } from './common.js';

// Костёр: шалаш из брёвен, пламя, каменное кольцо в снегу
export function createCampfire() {
  const g = new THREE.Group(); g.name = 'campfire';
  const bark = std(0x8a4f2a, { roughness: 0.9, flatShading: true });
  const cut = std(0xc28a55, { roughness: 0.9 });
  const stone = std(0x8d9096, { roughness: 0.9, flatShading: true });
  const snow = snowMat();
  const rope = std(0xc9a064, { roughness: 1 });

  // снежная подложка неровной формы
  const sh = new THREE.Shape();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 2.2 + Math.sin(a * 5) * 0.12 + Math.sin(a * 3 + 1) * 0.1; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const pad = cs(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 4 }), snow));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; g.add(pad);

  // камни
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2, s = cs(new THREE.Mesh(new THREE.DodecahedronGeometry(0.33, 0), stone));
    s.scale.set(1.3, 0.75, 1); s.position.set(Math.cos(a) * 1.6, 0.35, Math.sin(a) * 1.6); s.rotation.y = -a + i; g.add(s);
    if (i % 2 === 0) { const c = cs(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), snow)); c.scale.set(1.3, 0.4, 1); c.position.set(Math.cos(a) * 1.6, 0.6, Math.sin(a) * 1.6); g.add(c); }
  }

  // бревно
  function log(len, r) {
    const l = new THREE.Group();
    const b = cs(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 9), bark)); l.add(b);
    const c = cs(new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 9), cut)); c.rotation.x = -Math.PI / 2; c.position.y = len / 2 + 0.005; l.add(c);
    const k = cs(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.3, r * 0.6, 6), bark)); k.rotation.z = Math.PI / 2; k.position.set(r, len * 0.1, 0); l.add(k);
    return l;
  }
  // шалаш
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, L = log(i % 2 ? 1.5 : 2.2, 0.17);
    const tilt = i % 2 ? 0.55 : 0.3, R = i % 2 ? 0.95 : 0.6;
    L.position.set(Math.cos(a) * R * 0.6, i % 2 ? 0.7 : 1.1, Math.sin(a) * R * 0.6);
    L.rotation.set(0, -a, 0); L.rotateZ(tilt); L.rotation.order = 'YXZ';
    L.lookAt(0, 3, 0); L.rotateX(Math.PI / 2); g.add(L);
    L.position.set(Math.cos(a) * (i % 2 ? 0.8 : 0.55), i % 2 ? 0.7 : 1.15, Math.sin(a) * (i % 2 ? 0.8 : 0.55));
    L.lookAt(Math.cos(a) * -0.3, 3.2, Math.sin(a) * -0.3); L.rotateX(Math.PI / 2);
  }
  // верхние перекрещённые брёвна + верёвка
  [-1, 1].forEach(s => { const L = log(1.3, 0.16); L.position.set(s * 0.12, 2.35, 0); L.rotation.z = s * -0.35; g.add(L); });
  for (let i = 0; i < 2; i++) { const r = cs(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), rope)); r.rotation.x = Math.PI / 2; r.position.y = 2.4 + i * 0.08; g.add(r); }
  // мелкие поленья снаружи
  [[1.1, 0.8], [1.35, 0.6]].forEach(([x, z], i) => { const L = log(0.3, 0.09); L.rotation.z = Math.PI / 2; L.position.set(x, 0.15, z + 0.3 + i * 0.1); g.add(L); });

  // пламя: слои с аддитивным свечением
  const fire = new THREE.Group(); fire.position.y = 0.9; fire.userData.keep = true; g.add(fire);
  const flameGeo = new THREE.SphereGeometry(0.5, 24, 16); const pos = flameGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > 0) { const k = 1 - y / 0.5; pos.setX(i, pos.getX(i) * (0.2 + 0.8 * k)); pos.setZ(i, pos.getZ(i) * (0.2 + 0.8 * k)); pos.setY(i, y * 2.6); } }
  flameGeo.computeVertexNormals();
  const flames = [];
  [[0xff7a1a, 1.25, 0, 0], [0xffa530, 0.95, 0.35, 0.1], [0xffa530, 0.9, -0.35, -0.05], [0xffd060, 0.75, 0, 0.15], [0xfff0a0, 0.45, 0, 0.25]].forEach(([c, s, x, z], i) => {
    const m = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 - i * 0.05, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.scale.setScalar(s); m.position.set(x, 0, z); fire.add(m); flames.push(m);
  });
  const light = new THREE.PointLight(0xff8a30, 10, 7, 2); light.position.y = 1.3; g.add(light);

  g.userData.update = (t) => {
    flames.forEach((f, i) => { f.scale.y = f.scale.x * (1 + Math.sin(t * 9 + i * 2) * 0.1); f.rotation.y = t * 0.5 + i; });
    light.intensity = 9 + Math.sin(t * 11) * 1.5 + Math.sin(t * 17) * 1;
  };
  return g;
}
