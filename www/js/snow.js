import * as THREE from 'three';

// Снежки: полёт по дуге, попадания, снежные брызги. Один InstancedMesh + один Points — 2 draw call'а.
export function createSnowballs({ scene, heightAt, getColliders, getTargets, onHitMe, onSplat }) {
  const MAX = 96, balls = [];
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xdde8ff, emissiveIntensity: 0.35 }), MAX);
  im.count = 0; im.frustumCulled = false; scene.add(im);
  const PN = 600, pp = new Float32Array(PN * 3), pv = new Float32Array(PN * 3), pl = new Float32Array(PN); let pi = 0;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.95, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  for (let i = 0; i < PN; i++) pp[i * 3 + 1] = -99;
  const m4 = new THREE.Matrix4();

  function splat(p, n = 22) {
    for (let i = 0; i < n; i++) { const k = pi++ % PN; pp[k * 3] = p.x; pp[k * 3 + 1] = p.y; pp[k * 3 + 2] = p.z;
      const a = Math.random() * 6.283, s = 1 + Math.random() * 2.2; pv[k * 3] = Math.cos(a) * s; pv[k * 3 + 1] = 1.5 + Math.random() * 2.5; pv[k * 3 + 2] = Math.sin(a) * s; pl[k] = 0.5 + Math.random() * 0.4; }
  }
  function spawn(o, v, owner) { if (balls.length >= MAX) balls.shift(); balls.push({ p: new THREE.Vector3().copy(o), v: new THREE.Vector3().copy(v), owner, life: 4 }); }
  function update(dt, myId) {
    const cols = getColliders(), targets = getTargets();
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i]; b.v.y -= 14 * dt; b.p.addScaledVector(b.v, dt); b.life -= dt;
      let hit = b.life <= 0 || b.p.y <= heightAt(b.p.x, b.p.z) + 0.05;
      if (!hit) for (const c of cols) { if (b.p.y > (c.top > 50 ? 3.5 : c.top)) continue;
        if (c.k === 'c') { if (Math.hypot(b.p.x - c.x, b.p.z - c.z) < c.r * (c.top > 50 ? 0.8 : 1)) { hit = true; break; } }
        else { const dx = b.p.x - c.x, dz = b.p.z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) { hit = true; break; } } }
      if (!hit) for (const t of targets) { if (t.id === b.owner) continue; const dy = b.p.y - (t.p.y + 0.55);
        if (Math.hypot(b.p.x - t.p.x, dy * 0.8, b.p.z - t.p.z) < 0.5) { hit = true; t.hit?.(); if (t.id === myId) onHitMe?.(); break; } }
      if (hit) { splat(b.p); onSplat?.(b.p); balls.splice(i, 1); }
    }
    im.count = balls.length; balls.forEach((b, i) => im.setMatrixAt(i, m4.makeTranslation(b.p.x, b.p.y, b.p.z))); im.instanceMatrix.needsUpdate = true;
    let any = false;
    for (let k = 0; k < PN; k++) { if (pl[k] <= 0) continue; any = true; pl[k] -= dt; pv[k * 3 + 1] -= 9 * dt;
      pp[k * 3] += pv[k * 3] * dt; pp[k * 3 + 1] += pv[k * 3 + 1] * dt; pp[k * 3 + 2] += pv[k * 3 + 2] * dt; if (pl[k] <= 0) pp[k * 3 + 1] = -99; }
    if (any) pg.attributes.position.needsUpdate = true;
  }
  return { spawn, update };
}
