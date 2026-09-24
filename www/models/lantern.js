import * as THREE from 'three';
import { cs, std, snowMat, scroll, tube } from './common.js';

// Кованый фонарь со снежной шапкой
export function createLantern() {
  const g = new THREE.Group(); g.name = 'lantern';
  const iron = std(0x2f5a36, { roughness: 0.45, metalness: 0.35 });
  const snow = snowMat();
  const glass = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb548, emissiveIntensity: 1.6, roughness: 0.4 });

  // основание — ступенчатая база
  const base = cs(new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0], [0.55, 0], [0.55, 0.12], [0.48, 0.16], [0.46, 0.26], [0.36, 0.32], [0.32, 0.5], [0.3, 1.2],
    [0.34, 1.26], [0.34, 1.36], [0.24, 1.42], [0, 1.42]].map(p => new THREE.Vector2(...p)), 40), iron));
  g.add(base);
  const cap0 = cs(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), snow)); cap0.scale.set(1.2, 0.45, 1); cap0.position.set(-0.1, 1.44, 0.15); g.add(cap0);

  // изогнутая стойка
  g.add(tube([[0, 1.4, 0], [0.02, 2.0, 0], [-0.1, 2.5, 0], [-0.4, 2.9, 0], [-0.55, 3.5, 0], [-0.55, 4.3, 0]], 0.1, iron));
  const fin = cs(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), iron)); fin.position.set(-0.55, 4.55, 0); g.add(fin);
  const ring = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 20), iron)); ring.position.set(-0.55, 4.35, 0); g.add(ring);

  // кронштейн-дуга с завитками
  g.add(tube([[-0.55, 3.2, 0], [-0.3, 4.1, 0], [0.4, 4.55, 0], [1.05, 4.3, 0], [1.1, 3.9, 0]], 0.08, iron));
  const s1 = scroll(0.3, 1.1, 0.04, iron); s1.position.set(-0.15, 3.95, 0); g.add(s1);
  const s2 = scroll(0.22, 1.1, 0.035, iron, -1); s2.position.set(0.35, 4.2, 0); g.add(s2);
  const s3 = scroll(0.2, 1.0, 0.035, iron); s3.position.set(0.8, 4.2, 0); g.add(s3);
  const hook = cs(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), iron)); hook.position.set(1.1, 3.8, 0); g.add(hook);

  // фонарь — шестигранный, расширяется кверху
  const L = new THREE.Group(); L.position.set(1.1, 2.8, 0); g.add(L);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.9, 6), glass); L.add(body);
  const light = new THREE.PointLight(0xffb040, 5, 5, 2); L.add(light);
  const topRim = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.66, 0.12, 6), iron)); topRim.position.y = 0.5; L.add(topRim);
  const botRim = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, 0.14, 6), iron)); botRim.position.y = -0.5; L.add(botRim);
  const bot = cs(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.18, 6), iron)); bot.rotation.x = Math.PI; bot.position.y = -0.64; L.add(bot);
  // рама: вертикальные и горизонтальная перемычки на гранях
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const p1 = new THREE.Vector3(Math.cos(a) * 0.49, -0.45, Math.sin(a) * 0.49), p2 = new THREE.Vector3(Math.cos(a) * 0.63, 0.45, Math.sin(a) * 0.63);
    const d = p2.clone().sub(p1), m = cs(new THREE.Mesh(new THREE.BoxGeometry(0.06, d.length(), 0.06), iron));
    m.position.copy(p1).add(p2).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); L.add(m);
    // средние стойки граней
    const a2 = a + Math.PI / 6;
    const q1 = new THREE.Vector3(Math.cos(a2) * 0.43, -0.45, Math.sin(a2) * 0.43), q2 = new THREE.Vector3(Math.cos(a2) * 0.55, 0.45, Math.sin(a2) * 0.55);
    const e = q2.clone().sub(q1), n = cs(new THREE.Mesh(new THREE.BoxGeometry(0.035, e.length(), 0.035), iron));
    n.position.copy(q1).add(q2).multiplyScalar(0.5); n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.normalize()); L.add(n);
  }
  const mid = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.575, 0.05, 6, 1, true), iron)); mid.position.y = 0.02; mid.scale.setScalar(1.01); L.add(mid);

  // снежная шапка — пухлая, со свисающими краями
  const cap = cs(new THREE.Mesh(new THREE.SphereGeometry(0.82, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), snow));
  cap.scale.y = 0.42; cap.position.y = 0.55; L.add(cap);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.2, d = cs(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), snow));
    d.scale.set(1, 0.9 + (i % 3) * 0.3, 1); d.position.set(Math.cos(a) * 0.72, 0.5 - (i % 3) * 0.06, Math.sin(a) * 0.72); L.add(d);
  }
  // снежок на завитке и стойке
  [[0.45, 4.6, 0], [-0.55, 4.68, 0], [-0.3, 2.75, 0.05]].forEach(p => { const s = cs(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), snow)); s.scale.y = 0.5; s.position.set(...p); g.add(s); });

  g.userData.update = (t) => { const f = 1.5 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13) * 0.05; glass.emissiveIntensity = f; light.intensity = f * 3.2; };
  return g;
}
