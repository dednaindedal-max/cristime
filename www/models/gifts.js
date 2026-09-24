import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cs, std } from './common.js';

// Группа подарков: красный с золотом, зелёный с красным, синий с белым, фиолетовый сзади
export function createGifts() {
  const g = new THREE.Group(); g.name = 'gifts';
  const snow = std(0xffffff, { roughness: 0.9 });

  function gift(size, boxColor, ribbonColor, withBow = true) {
    const G = new THREE.Group();
    const box = std(boxColor, { roughness: 0.35 }), rib = std(ribbonColor, { roughness: 0.3, metalness: ribbonColor === 0xf0b632 ? 0.4 : 0 });
    const [w, h, d] = size;
    const body = cs(new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.82, d, 2, 0.06), box)); body.position.y = h * 0.41; G.add(body);
    const lid = cs(new THREE.Mesh(new RoundedBoxGeometry(w * 1.06, h * 0.2, d * 1.06, 2, 0.05), box)); lid.position.y = h * 0.88; G.add(lid);
    const rw = w * 0.16;
    const r1 = cs(new THREE.Mesh(new RoundedBoxGeometry(rw, h * 1.0, d * 1.08, 2, 0.02), rib)); r1.position.y = h * 0.5; G.add(r1);
    const r2 = cs(new THREE.Mesh(new RoundedBoxGeometry(w * 1.08, h * 1.0, rw, 2, 0.02), rib)); r2.position.y = h * 0.5; G.add(r2);
    // бант: две петли, узел, два хвостика
    const bow = new THREE.Group(); bow.position.y = h * 1.0; if (withBow) G.add(bow);
    const loop = new THREE.TorusGeometry(w * 0.17, w * 0.06, 6, 14);
    [-1, 1].forEach(s => {
      const l = cs(new THREE.Mesh(loop, rib)); l.scale.set(1.2, 1, 1.6); l.position.set(s * w * 0.18, w * 0.12, 0); l.rotation.set(0, 0, s * 0.5); bow.add(l);
      const tail = cs(new THREE.Mesh(new THREE.BoxGeometry(w * 0.1, 0.03, w * 0.35), rib)); tail.position.set(s * w * 0.1, 0.01, w * 0.16); tail.rotation.y = s * 0.5; bow.add(tail);
    });
    const knot = cs(new THREE.Mesh(new THREE.SphereGeometry(w * 0.08, 12, 10), rib)); knot.position.y = w * 0.06; bow.add(knot);
    // снежные крупинки
    for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.02, 6, 5), snow);
      s.position.set((Math.random() - .5) * w, h * 0.99, (Math.random() - .5) * d); G.add(s); }
    return G;
  }
  const red = gift([1.3, 1.25, 1.3], 0xd12a22, 0xf0b632); red.position.set(-0.75, 0, 0.3); red.rotation.y = 0.35; g.add(red);
  const purple = gift([0.8, 0.7, 0.8], 0x7a3fb8, 0xf0b632, false); purple.position.set(0.25, 0, -0.9); g.add(purple);
  const blue = gift([1.05, 0.95, 1.05], 0x2c5fc4, 0xf4f4f4); blue.position.set(0.65, 0, 0.35); blue.rotation.y = -0.3; g.add(blue);
  const green = gift([0.95, 0.75, 0.9], 0x3d8f36, 0xd8262a); green.position.set(0.05, 0.98, -0.25); green.rotation.set(0.12, 0.4, -0.08); g.add(green);
  return g;
}
