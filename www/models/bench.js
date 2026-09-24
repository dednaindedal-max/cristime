import * as THREE from 'three';
import { cs, std, snowMat, woodTex, snowStrip, scroll, tube } from './common.js';

// Парковая скамейка: деревянные рейки, кованые боковины
export function createBench() {
  const g = new THREE.Group(); g.name = 'bench';
  const tex = woodTex();
  const wood = std(0xffffff, { map: tex, roughness: 0.6 });
  const iron = std(0x3a3d42, { roughness: 0.45, metalness: 0.5 });
  const snow = snowMat();
  const W = 3.4;
  const plank = (w, h, d) => cs(new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), wood));

  // сиденье: 3 рейки
  for (let i = 0; i < 3; i++) {
    const p = plank(W, 0.1, 0.3); p.position.set(0, 1.0, 0.4 - i * 0.34); g.add(p);
  }
  // спинка: верхняя, нижняя поперечины и вертикальные рейки
  const back = new THREE.Group(); back.position.set(0, 1.1, -0.55); back.rotation.x = -0.14; g.add(back);
  const topR = plank(W - 0.2, 0.3, 0.1); topR.position.y = 1.15; back.add(topR);
  const botR = plank(W - 0.2, 0.22, 0.1); botR.position.y = 0.2; back.add(botR);
  back.add(snowStrip(new THREE.Vector3(-1.4, 1.31, 0), new THREE.Vector3(1.4, 1.31, 0), 0.05, snow));
  for (let i = 0; i < 9; i++) { const s = plank(0.25, 0.72, 0.08); s.position.set(-1.35 + i * 0.3375, 0.68, 0.02); back.add(s); }

  // кованые боковины
  [-1, 1].forEach(side => {
    const S = new THREE.Group(); S.position.x = side * (W / 2 - 0.05); S.rotation.y = Math.PI / 2; g.add(S);
    // задняя стойка до верха спинки
    S.add(tube([[0.75, 0, 0], [0.62, 0.6, 0], [0.62, 1.2, 0], [0.8, 2.1, 0], [0.9, 2.5, 0]], 0.055, iron));
    const tsc = scroll(0.14, 1.1, 0.045, iron); tsc.rotation.y = Math.PI / 2; tsc.position.set(0, 2.45, -0.95); // top scroll
    const topScroll = scroll(0.15, 1.1, 0.05, iron); topScroll.position.set(0.8, 2.45, 0); S.add(topScroll);
    // передняя ножка с завитком внизу
    S.add(tube([[-0.55, 0.05, 0], [-0.45, 0.5, 0], [-0.5, 0.95, 0]], 0.055, iron));
    const footF = scroll(0.12, 1.0, 0.045, iron, -1); footF.position.set(-0.62, 0.12, 0); S.add(footF);
    const footB = scroll(0.12, 1.0, 0.045, iron); footB.position.set(0.85, 0.12, 0); S.add(footB);
    [[-0.62, 0], [0.88, 0]].forEach(([z]) => { const f = cs(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.14), iron)); f.position.set(z, 0.03, 0); S.add(f); });
    // подлокотник
    S.add(tube([[0.6, 1.55, 0], [0.1, 1.5, 0], [-0.45, 1.45, 0], [-0.62, 1.3, 0]], 0.05, iron));
    const armS = scroll(0.16, 1.2, 0.05, iron, -1); armS.position.set(-0.55, 1.2, 0); S.add(armS);
    S.add(tube([[-0.5, 1.0, 0], [-0.55, 1.25, 0]], 0.05, iron));
    S.add(snowStrip(new THREE.Vector3(0.55, 1.62, 0), new THREE.Vector3(-0.5, 1.52, 0), 0.05, snow));
    // рама под сиденьем + орнамент
    S.add(tube([[-0.6, 0.93, 0], [0.7, 0.93, 0]], 0.045, iron));
    S.add(tube([[-0.45, 0.4, 0], [0.62, 0.4, 0]], 0.035, iron));
    [[-0.15, 0.65, 1], [0.25, 0.65, -1]].forEach(([z, y, f]) => { const o = scroll(0.2, 1.1, 0.035, iron, f); o.position.set(z, y, 0); S.add(o); });
    const band = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12), std(0xa06a3a))); band.rotation.z = Math.PI / 2; band.position.set(0.05, 0.65, 0); S.add(band);
  });
  return g;
}
