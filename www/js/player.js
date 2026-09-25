import * as THREE from 'three';
import { createChibi } from '../models/chibi.js';

// Игрок: ходьба, прыжок, скольжение на животе (зажать прыжок), лестница на горку, спуск по жёлобу, снежки.
const BOUND = { x: 0.3, z: -3, rx: 21.5, rz: 16.5 };
export function createPlayer({ scene, camera, renderer, onThrow }) {
  const ui = document.getElementById('play');
  const joy = document.getElementById('joy'), knob = joy.querySelector('i');
  let chibi = createChibi(); const S = 0.95; chibi.scale.setScalar(S); chibi.visible = false; scene.add(chibi);
  // ---------- вид от 1-го лица: пингвиньи ласты + снежок в руке ----------
  const vm = new THREE.Group(); vm.scale.setScalar(0.7); vm.position.set(0, 0, -0.1); vm.visible = false; camera.add(vm); if (!camera.parent) scene.add(camera);
  const vmMat = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r, emissive: c, emissiveIntensity: 0.25 });
  const navy = vmMat(0x1d2c63), belly = vmMat(0xf4efe4, 0.8), snowM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xdde8ff, emissiveIntensity: 0.35 });
  // ласта: плоская изогнутая «лопасть» (контур как у пингвина), тёмная сверху, светлая снизу
  function finGeo(w, h, d) { const sh = new THREE.Shape();
    sh.moveTo(-w * 0.5, 0); sh.bezierCurveTo(-w * 0.62, h * 0.45, -w * 0.4, h * 0.9, -w * 0.05, h);
    sh.bezierCurveTo(w * 0.2, h * 1.02, w * 0.36, h * 0.8, w * 0.38, h * 0.55); sh.bezierCurveTo(w * 0.42, h * 0.3, w * 0.5, h * 0.1, w * 0.5, 0);
    sh.lineTo(-w * 0.5, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: d * 0.9, bevelSize: w * 0.12, bevelSegments: 5, curveSegments: 24 });
    g.translate(0, 0, -d / 2); const P = g.attributes.position;   // лёгкий изгиб лопасти
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), x = P.getX(i); P.setZ(i, P.getZ(i) - (y / h) ** 2 * w * 0.35 + x * x * 0.6); }
    g.computeVertexNormals(); return g; }
  const finTop = finGeo(0.13, 0.36, 0.018), finBot = finGeo(0.1, 0.3, 0.008);
  function flipper(side) {
    const g = new THREE.Group(), blade = new THREE.Group(); g.add(blade); blade.scale.x = side;
    const top = new THREE.Mesh(finTop, navy); blade.add(top);
    const bot = new THREE.Mesh(finBot, belly); bot.position.set(0.012, 0.025, -0.03); blade.add(bot);
    g.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.frustumCulled = false; } }); return g;
  }
  const fL = flipper(-1), fR = flipper(1); vm.add(fL, fR);
  const hand = new THREE.Group(); fR.add(hand); hand.position.set(-0.015, 0.3, 0.1);
  const vball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.068, 4), snowM); hand.add(vball);
  for (let i = 0; i < 9; i++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.009 + Math.random() * 0.006, 1), snowM); k.position.setFromSphericalCoords(0.066, Math.random() * 3, Math.random() * 6.3); vball.add(k); }
  vball.traverse(o => { if (o.isMesh) { o.renderOrder = 11; o.frustumCulled = false; } });
  let vmT = 0;
  let vmAir = 0, vmSpd = 0;
  function animVM(dt, spd) {
    if (!vm.visible) return;
    vmSpd += (spd - vmSpd) * Math.min(1, dt * 8); vmAir += ((onGround ? 0 : 1) - vmAir) * Math.min(1, dt * 10);
    vmT += dt * (2 + vmSpd * 9);
    const w = Math.sin(vmT), w2 = Math.sin(vmT * 2), br = Math.sin(performance.now() * 0.002) * 0.008;
    const A = Math.min(1.2, vmSpd), asp = Math.min(1.6, camera.aspect) / 1.6;
    const bob = Math.abs(w) * 0.03 * A + br;                       // шаг вразвалочку: ласты качаются поочерёдно
    const flap = vmAir * (0.5 + Math.sin(performance.now() * 0.03) * 0.35);   // в прыжке машет
    fL.position.set(-0.42 * asp - 0.02 - A * 0.02, -0.5 + bob + vmAir * 0.08, -0.5 + w * 0.06 * A);
    fL.rotation.set(-0.35 + w * 0.35 * A, 0.35, -0.8 + w2 * 0.06 * A - flap);
    let rx = -0.35 - w * 0.35 * A, rz = 0.6 + flap, px = 0.38 * asp + 0.02 + A * 0.02, py = -0.48 + bob + vmAir * 0.08, pz = -0.5 - w * 0.06 * A;
    if (throwT > 0) { const u = throwT; flapK = 0;
      if (u < 0.45) { const k = Math.sin(u / 0.45 * Math.PI / 2); rx += 1.2 * k; py += 0.14 * k; pz += 0.2 * k; rz -= 0.5 * k; px += 0.04 * k; }   // замах за плечо
      else { const k = 1 - (1 - Math.min(1, (u - 0.45) / 0.18)) ** 3, back = Math.max(0, (u - 0.63) / 0.37);
        rx += 1.2 - 2.1 * k + 0.9 * back; py += 0.14 - 0.1 * k - 0.04 * back; pz += 0.2 - 0.34 * k + 0.14 * back; rz -= 0.5 - 0.2 * k - 0.3 * back; px += 0.04 - 0.1 * k + 0.06 * back; } }
    fR.position.set(px, py, pz); fR.rotation.set(rx, -0.35, rz);
    const vis = throwT > 0.45 ? Math.max(0, (throwT - 0.75) / 0.25) : 1; vball.scale.setScalar(Math.max(0.001, vis * (1 + (1 - vis) * 0.3)));
    vm.position.set(Math.sin(vmT * 0.5) * 0.006 * A, -Math.abs(w) * 0.006 * A, -0.1);
  }
  let flapK = 0;

  const pos = new THREE.Vector3(0, 0, 4), vel = new THREE.Vector3();
  let yaw = 0, pitch = -0.12, vy = 0, onGround = true, face = Math.PI, lastSpd = 0;
  let spawned = false, active = false, third = true, map = null, colliders = [], ride = null;
  let mode = 'walk', pose = 'walk', climbU = 0, slideU = 0, slideV = 0, dive = false, jumpHeld = false, jumpT = 0, jumpAt = -9, throwT = 0, thrown = false, hitT = 0;
  const keys = {}; const mv = { x: 0, y: 0 }; let run = false, camDist = 3.4;
  const groundY = (x, z) => map ? map.userData.heightAt(x, z) : 0;
  let clock = 0;

  // ---------- ввод ----------
  const jumpDown = () => { if (jumpHeld) return; jumpHeld = true; jumpT = 0; jumpAt = clock; jump(); };
  const jumpUp = () => { jumpHeld = false; };
  addEventListener('keydown', e => { if (!active || e.target.tagName === 'INPUT') return; keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); jumpDown(); } if (e.code === 'KeyV') setThird(!third); if (e.code === 'KeyF' || e.code === 'KeyE') throwBall(); });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') jumpUp(); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; jumpUp(); });
  function jump() {
    if (mode === 'belly') { mode = 'walk'; vy = 3.6; onGround = false; return; }
    if ((mode === 'walk' || mode === 'deck') && onGround) { vy = 4.4; onGround = false; dive = false; }
  }
  function throwBall() { if (throwT > 0 || mode === 'climb' || mode === 'slide') return; throwT = 0.0001; thrown = false; }

  const cv = renderer.domElement; const look = new Map(); let joyId = null, joyC = { x: 0, y: 0 };
  cv.addEventListener('pointerdown', e => {
    if (!active) return;
    const isTouch = e.pointerType === 'touch';
    if (isTouch && e.clientX < innerWidth * 0.42 && joyId === null) {
      joyId = e.pointerId; joyC = { x: e.clientX, y: e.clientY };
      joy.style.left = (e.clientX - 55) + 'px'; joy.style.top = (e.clientY - 55) + 'px'; joy.classList.add('on');
    } else look.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!isTouch) { if (document.pointerLockElement === cv) { if (e.button === 0) throwBall(); } else cv.requestPointerLock?.(); }
  });
  addEventListener('pointermove', e => {
    if (!active) return;
    if (e.pointerId === joyId) {
      let dx = e.clientX - joyC.x, dy = e.clientY - joyC.y; const l = Math.hypot(dx, dy), m = 50;
      if (l > m) { dx *= m / l; dy *= m / l; }
      mv.x = dx / m; mv.y = -dy / m; run = l > m * 0.95; knob.style.transform = `translate(${dx}px,${dy}px)`; return;
    }
    if (document.pointerLockElement === cv) { turn(e.movementX, e.movementY, 0.0024); return; }
    const p = look.get(e.pointerId); if (!p) return;
    turn(e.clientX - p.x, e.clientY - p.y, e.pointerType === 'touch' ? 0.006 : 0.005); p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => { if (e.pointerId === joyId) { joyId = null; mv.x = mv.y = 0; run = false; knob.style.transform = ''; joy.classList.remove('on'); } look.delete(e.pointerId); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  let sens = 1, fovV = 70; const turn = (dx, dy, k) => { k *= sens; yaw -= dx * k; pitch = THREE.MathUtils.clamp(pitch - dy * k, -1.2, 1.0); };
  cv.addEventListener('wheel', e => { if (active && third) camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.004, 1.8, 8); }, { passive: true });
  const jb = document.getElementById('pJump');
  jb.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); jumpDown(); });
  jb.addEventListener('pointerup', jumpUp); jb.addEventListener('pointercancel', jumpUp); jb.addEventListener('pointerleave', jumpUp);
  document.getElementById('pBall').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); throwBall(); });
  document.getElementById('pView').onclick = () => setThird(!third);
  document.getElementById('pRun').onclick = e => { run = !run; e.currentTarget.classList.toggle('on', run); };
  function setThird(v) { third = v; chibi.visible = third; vm.visible = !third; document.getElementById('pView').textContent = third ? '👁 1-е лицо' : '🎥 3-е лицо'; }

  function enable(on, m) {
    active = on; map = m; ui.style.display = on ? 'flex' : 'none';
    if (on) {
      colliders = map.userData.colliders(); ride = map.userData.sledRide();
      if (!spawned) { spawned = true; pos.set(0.5 + (Math.random() - 0.5) * 3, 0, 4.4 + Math.random() * 0.6); yaw = 0; face = Math.PI; pitch = -0.12; mode = 'walk'; }
      camera.fov = fovV; camera.updateProjectionMatrix(); setThird(third);
    } else { chibi.visible = false; vm.visible = false; document.exitPointerLock?.(); }
  }

  // ---------- физика ----------
  function collide(PR = 0.2) {
    let hit = false;
    for (let it = 0; it < 2; it++) for (const c of colliders) {
      if (pos.y > c.top - 0.05) continue;
      if (c.k === 'c') { const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + PR; if (d < m) { const n = d > 1e-4 ? d : 1; pos.x = c.x + (d > 1e-4 ? dx : m) / n * m; pos.z = c.z + (d > 1e-4 ? dz : 0) / n * m; hit = true; } }
      else {
        const dx = pos.x - c.x, dz = pos.z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
        const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez); if (d >= PR) continue;
        let nx, nz;
        if (d > 1e-5) { nx = qx + ex / d * PR; nz = qz + ez / d * PR; }
        else { const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz); if (px < pz) { nx = Math.sign(lx || 1) * (c.hx + PR); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (c.hz + PR); } }
        pos.x = c.x + nx * c.cos + nz * c.sin; pos.z = c.z - nx * c.sin + nz * c.cos; hit = true;
      }
    }
    // граница карты — невидимая стена по краю леса
    const ex = (pos.x - BOUND.x) / BOUND.rx, ez = (pos.z - BOUND.z) / BOUND.rz, e = Math.hypot(ex, ez);
    if (e > 1) { pos.x = BOUND.x + ex / e * BOUND.rx; pos.z = BOUND.z + ez / e * BOUND.rz; hit = true; }
    return hit;
  }
  const floorAt = () => {
    let f = groundY(pos.x, pos.z);
    for (const c of colliders) { if (c.k !== 'b' || pos.y < c.top - 0.3) continue; const dx = pos.x - c.x, dz = pos.z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) f = Math.max(f, c.top); }
    return f;
  };
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3();
  const turnFace = (target, k) => { let d = target - face; d = Math.atan2(Math.sin(d), Math.cos(d)); face += d * Math.min(1, k); };

  function update(dt, t) {
    if (!active) return; dt = Math.min(dt, 0.05); clock = t; if (jumpHeld) jumpT += dt;
    let ix = mv.x + (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let iy = mv.y + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const sprint = run || keys.ShiftLeft || keys.ShiftRight; const speed = sprint ? 5.4 : 3.0;
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(-fwd.z, 0, fwd.x);
    dir.copy(fwd).multiplyScalar(iy).addScaledVector(right, ix);
    const mag = dir.length();
    let animSpd = 0;

    if (mode === 'walk') {
      vel.copy(dir).multiplyScalar(speed);
      pos.addScaledVector(vel, dt);
      collide();
      if (jumpHeld && jumpT > 0.16 && !onGround) dive = true;           // зажатый прыжок → нырок на живот
      vy -= 13 * dt; pos.y += vy * dt;
      const fl = floorAt();
      if (pos.y <= fl) { pos.y = fl; vy = 0;
        if (!onGround && dive) { mode = 'belly'; pose = 'belly'; const h = Math.max(mag * speed * 1.45, 4.8); vel.set(-Math.sin(face) * -1, 0, 0); vel.set(Math.sin(face), 0, Math.cos(face)).multiplyScalar(h); }
        onGround = true; dive = false; }
      else if (pos.y > fl + 0.05) onGround = false;
      if (mag > 0.05) turnFace(Math.atan2(dir.x, dir.z), dt * 12);
      animSpd = onGround ? mag * (sprint ? 1.35 : 0.85) : 0.3;
      pose = dive ? 'belly' : 'walk';
      // лестница: подойти к низу лестницы
      if (ride && onGround) { const b = ride.ladderBot; tmp.set(ride.ladderTop.x - b.x, 0, ride.ladderTop.z - b.z).normalize();
        const dx = pos.x - b.x, dz = pos.z - b.z;
        if (Math.hypot(dx, dz) < 0.75 && (mag < 0.05 || dir.dot(tmp) > 0.2)) { mode = 'climb'; climbU = 0; vy = 0; } }
    } else if (mode === 'climb') {
      const b = ride.ladderBot, tp = ride.ladderTop, L = b.distanceTo(tp);
      climbU = Math.min(1, climbU + dt * 1.25 / L * (0.6 + Math.max(0, iy) * 0.8 + (mag < 0.05 ? 0.4 : 0)));
      tmp.set(tp.x - b.x, 0, tp.z - b.z).normalize();
      pos.lerpVectors(b, tp, climbU).addScaledVector(tmp, -0.3);
      face = Math.atan2(tmp.x, tmp.z); animSpd = 0.9; pose = 'climb';
      if (climbU >= 1) { mode = 'deck'; tmp.subVectors(ride.deck, tp).setY(0).normalize(); pos.copy(tp).addScaledVector(tmp, 0.3); pos.y = ride.deck.y; }
    } else if (mode === 'deck') {
      vel.copy(dir).multiplyScalar(2.2); pos.addScaledVector(vel, dt); pos.y = ride.deck.y; onGround = true;
      if (mag > 0.05) turnFace(Math.atan2(dir.x, dir.z), dt * 12);
      animSpd = mag * 0.8; pose = 'walk';
      const l = ride.toLocal(pos), d = ride.deck, hx = ride.deckHalf.x, hz = ride.deckHalf.y;
      if (l.x < d.x - hx + 0.1) {                                         // шагнул к жёлобу — поехали!
        mode = 'slide'; slideU = 0.015; slideV = 1.6; pose = (jumpHeld || clock - jumpAt < 0.6) ? 'belly' : 'sit';
      } else {
        l.x = Math.min(l.x, d.x + hx - 0.15); l.z = THREE.MathUtils.clamp(l.z, d.z - hz + 0.12, d.z + hz - 0.12);
        if (l.x >= d.x + hx - 0.16 && Math.abs(l.z - d.z) < 0.35 && iy !== 0 && dir.dot(tmp.subVectors(ride.ladderBot, ride.deck).setY(0).normalize()) > 0.3) { mode = 'climb'; climbU = 0.95; }
        else pos.copy(l.applyMatrix4(ride.toWorld ?? new THREE.Matrix4())).setY(d.y);
      }
    } else if (mode === 'slide') {
      const tg = ride.tangent(slideU);
      slideV += (9.8 * Math.max(0, -tg.y) * 0.95 - 0.35 - slideV * 0.03) * dt;
      slideV = Math.max(slideV, 1.4);
      slideU += slideV * dt / ride.length;
      if (slideU >= 1) { mode = 'belly'; slideU = 1; const t2 = ride.tangent(1); vel.set(t2.x, 0, t2.z).normalize().multiplyScalar(slideV); pos.copy(ride.point(1)); }
      else { pos.copy(ride.point(slideU)); pos.y += 0.04; face = Math.atan2(tg.x, tg.z); }
      animSpd = 0;
    } else if (mode === 'belly') {                                        // скольжение по снегу с инерцией
      const sp = vel.length();
      if (mag > 0.05) { const want = tmp.copy(dir).normalize().multiplyScalar(sp); vel.lerp(want, Math.min(1, dt * 1.2)); vel.setLength(sp); }
      const ns = Math.max(0, sp - (1.6 + sp * 0.12) * dt); vel.setLength(ns);
      const px = pos.x, pz = pos.z; pos.addScaledVector(vel, dt);
      if (collide(0.3)) { vel.set(pos.x - px, 0, pos.z - pz).divideScalar(Math.max(dt, 1e-4)).multiplyScalar(0.6); }
      vy -= 13 * dt; pos.y += vy * dt; const fl = floorAt(); if (pos.y <= fl) { pos.y = fl; vy = 0; }
      if (ns > 0.2) turnFace(Math.atan2(vel.x, vel.z), dt * 8);
      if (ns < 0.35) { mode = 'walk'; pose = 'walk'; }
      animSpd = 0;
    }

    // бросок снежка
    if (throwT > 0) { throwT += dt / 0.42; if (!thrown && throwT > 0.45) { thrown = true;
        const cd = new THREE.Vector3(); camera.getWorldDirection(cd); if (!third) face = yaw + Math.PI;
        const o = pos.clone().add(new THREE.Vector3(0, 0.95 * S, 0)).addScaledVector(new THREE.Vector3(Math.cos(face), 0, -Math.sin(face)), -0.2);
        if (third) { turnFace(Math.atan2(cd.x, cd.z), 1); }
        const v = cd.multiplyScalar(15).add(new THREE.Vector3(0, 3.2, 0)); onThrow?.(o, v); }
      if (throwT >= 1) throwT = 0; }
    if (hitT > 0) hitT = Math.max(0, hitT - dt);

    chibi.position.copy(pos); chibi.userData.setBlobY?.((groundY(pos.x, pos.z) - pos.y) / S + 0.012);
    chibi.rotation.y = face;
    const animPose = mode === 'climb' ? 'climb' : mode === 'slide' ? pose : mode === 'belly' ? (pose === 'sit' ? 'sit' : 'belly') : pose;
    lastSpd = animSpd; lastPose = animPose;
    chibi.userData.animate(dt, animSpd, t, !onGround && mode === 'walk', animPose, throwT); animVM(dt, mode === 'walk' && onGround ? animSpd : 0);

    // камера
    const low = animPose === 'belly' ? 0.45 : animPose === 'sit' ? 0.6 : 1;
    if (!third) {
      const eye = pos.y + 1.0 * S * low;
      camera.position.set(pos.x, eye + Math.abs(Math.sin(vmT)) * 0.025 * Math.min(1, vmSpd), pos.z); camera.rotation.set(pitch, yaw, Math.sin(vmT) * 0.008 * Math.min(1, vmSpd), 'YXZ');
    } else {
      if (mode === 'slide' || mode === 'climb' || mode === 'deck') {       // на горке камера сама встаёт сзади-сверху
        let d = face + Math.PI - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (mode !== 'deck' || mag < 0.05) yaw += d * Math.min(1, dt * 3);
        pitch += (-0.42 - pitch) * Math.min(1, dt * 3);
      }
      const cp = Math.cos(pitch), off = tmp.set(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(camDist);
      const tgt = new THREE.Vector3(pos.x, pos.y + 0.75 * S * low, pos.z);
      camera.position.copy(tgt).add(off);
      camera.position.y = Math.max(camera.position.y, groundY(camera.position.x, camera.position.z) + 0.25, mode === 'slide' || mode === 'climb' || mode === 'deck' ? tgt.y + 1.2 : -99);
      camera.lookAt(tgt);
    }
  }
  let lastPose = 'walk';
  function setColor(c) { const v = chibi.visible; scene.remove(chibi); chibi = createChibi({ color: c }); chibi.scale.setScalar(S); chibi.visible = v; scene.add(chibi); chibi.position.copy(pos); chibi.rotation.y = face; return chibi; }
  const getState = () => ({ x: +pos.x.toFixed(3), y: +pos.y.toFixed(3), z: +pos.z.toFixed(3), f: +face.toFixed(3), s: +lastSpd.toFixed(2), a: !onGround && mode === 'walk' ? 1 : 0, m: lastPose, th: +throwT.toFixed(2) });
  const onHit = () => { hitT = 0.6; };
  return { setColor, getState, onHit, get chibi() { return chibi; }, get pos() { return pos; }, enable, update, isActive: () => active,
    setSens: v => sens = v, setFov: v => fovV = v, look: (y, p, d) => { yaw = y; pitch = p; if (d) camDist = d; }, debug: { set: (m, u) => { mode = m; if (m === 'slide') { slideU = u; slideV = 5; pose = 'belly'; } if (m === 'climb') climbU = u; } } };
}
