import * as THREE from 'three';

// Снеговик в вязаной панаме и шарфе, со снежком в руке
export function createSnowman() {
  const g = new THREE.Group();
  g.name = 'snowman';
  const cs = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });

  // вязаная текстура
  function knitTex(base, dark, rot = false) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 128, 128);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      x.fillStyle = (i + j) % 3 ? dark : base;
      const px = i * 8, py = j * 8;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + 4, py + 8); x.lineTo(px + 8, py); x.lineTo(px + 6, py); x.lineTo(px + 4, py + 4); x.lineTo(px + 2, py); x.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    if (rot) t.rotation = Math.PI / 2;
    return t;
  }
  const knitHat = knitTex('#c9302c', '#a8221f'); knitHat.repeat.set(6, 2);
  const knitScarf = knitTex('#c9302c', '#a8221f'); knitScarf.repeat.set(6, 1);
  const knitEnd = knitTex('#c9302c', '#a8221f'); knitEnd.repeat.set(1, 3);

  const snow = std(0xf4f8fc, { roughness: 0.95, emissive: 0xdde8f5, emissiveIntensity: 0.12 });
  const coal = std(0x3a3632, { roughness: 0.6, flatShading: true });
  const wood = std(0x7a4a28, { roughness: 0.9 });
  const mitten = std(0x8b5a36, { roughness: 0.95 });
  const cuff = std(0xc9a47e, { roughness: 0.95 });
  const hatM = std(0xffffff, { map: knitHat, roughness: 1 });
  const scarfM = std(0xffffff, { map: knitScarf, roughness: 1 });
  const endM = std(0xffffff, { map: knitEnd, roughness: 1 });
  const white = std(0xffffff, { roughness: 1 });

  // тело
  const ball = (r, y, sy = 0.95) => { const m = cs(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), snow)); m.scale.y = sy; m.position.y = y; g.add(m); return m; };
  ball(1.05, 1.0, 0.95);
  ball(0.78, 2.45, 0.92);
  ball(0.68, 3.55, 1.0);

  // лицо
  [-0.24, 0.24].forEach(x => { const e = cs(new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), coal)); e.scale.z = 0.6; e.position.set(x, 3.72, 0.61); g.add(e); });
  const nose = cs(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.32, 16), std(0xf07a1c, { roughness: 0.6 })));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 3.56, 0.8); g.add(nose);
  for (let i = 0; i < 5; i++) { // улыбка
    const a = Math.PI * (1.2 + i * 0.15), s = cs(new THREE.Mesh(new THREE.DodecahedronGeometry(0.04), coal));
    const x = Math.cos(a) * 0.26, y = 3.5 + Math.sin(a) * 0.22;
    s.position.set(x, y, Math.sqrt(Math.max(0, 0.68 ** 2 - x * x - (y - 3.55) ** 2)) - 0.01); g.add(s);
  }
  [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ color: 0xffb3b3, transparent: true, opacity: 0.45 })); b.position.set(s * 0.4, 3.52, 0.53); b.rotation.y = s * 0.6; g.add(b); });

  // пуговицы
  [[2.6, 0.74], [2.25, 0.76], [1.25, 1.0]].forEach(([y, z]) => { const b = cs(new THREE.Mesh(new THREE.DodecahedronGeometry(0.085), coal)); b.position.set(0, y, z); b.scale.z = 0.6; g.add(b); });

  // шапка-панама
  const hat = new THREE.Group(); hat.position.set(0.04, 3.93, 0); hat.rotation.z = -0.1; hat.rotation.x = -0.06;
  // один замкнутый профиль: тулья + опущенные поля (снаружи и изнутри), без щелей
  const prof = [
    [0, 0.72], [0.3, 0.71], [0.44, 0.66], [0.5, 0.56], [0.55, 0.3], [0.58, 0.08],
    [0.7, 0.0], [0.84, -0.1], [0.92, -0.2], [0.93, -0.25], [0.88, -0.26],
    [0.78, -0.18], [0.62, -0.1], [0.52, -0.04], [0.5, 0.3], [0.45, 0.58], [0, 0.64]
  ].map(p => new THREE.Vector2(...p));
  const hatMesh = cs(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), hatM));
  hatM.side = THREE.DoubleSide; hat.add(hatMesh);
  const pom = cs(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), white)); pom.position.y = 0.84; hat.add(pom);
  // снежинки на шапке
  const flake = () => { const f = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.01), white); b.rotation.z = i * Math.PI / 3; f.add(b); } return f; };
  [[0.25, 0.4], [1.3, 0.35]].forEach(([a, y]) => { const f = flake(); f.position.set(Math.sin(a) * 0.58, y, Math.cos(a) * 0.58); f.rotation.y = a; f.rotation.x = -0.2; hat.add(f); });
  g.add(hat);

  // шарф
  const scarf = cs(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.17, 16, 48), scarfM)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 3.02; scarf.scale.z = 1.3; g.add(scarf);
  const end = new THREE.Group(); end.position.set(-0.3, 2.95, 0.55); end.rotation.z = -0.15; end.rotation.x = 0.25;
  const tail = cs(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.1, 2, 6, 1), endM)); tail.position.y = -0.37; end.add(tail);
  for (let i = 0; i < 7; i++) { const fr = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 5), endM)); fr.position.set(-0.12 + i * 0.04, -0.82, 0); end.add(fr); }
  g.add(end);

  // руки-ветки
  function arm(pts, side) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    g.add(cs(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.05, 8), wood)));
    // сучок
    const mid = curve.getPoint(0.55), twig = cs(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.25, 6), wood));
    twig.position.copy(mid).add(new THREE.Vector3(0, 0.1, 0)); twig.rotation.z = side * 0.8; g.add(twig);
    const end = curve.getPoint(1);
    const m = cs(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), mitten)); m.scale.set(0.9, 1.15, 0.75); m.position.copy(end); g.add(m);
    const th = cs(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mitten)); th.position.copy(end).add(new THREE.Vector3(side * -0.13, 0.05, 0.05)); g.add(th);
    const c = cs(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 10, 20), cuff));
    const dir = curve.getTangent(1); c.position.copy(end).addScaledVector(dir, -0.16);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); g.add(c);
    return end;
  }
  const lh = arm([[-0.6, 2.6, 0], [-1.1, 2.9, 0.1], [-1.35, 3.35, 0.2], [-1.4, 3.65, 0.25]], -1);
  arm([[0.6, 2.55, 0], [1.05, 2.3, 0.1], [1.3, 2.05, 0.15], [1.45, 1.8, 0.2]], 1);
  const sb = cs(new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), snow)); sb.position.copy(lh).add(new THREE.Vector3(0.02, 0.2, 0.08)); g.add(sb);

  // мягкое покачивание
  g.userData.update = (t) => { g.rotation.z = Math.sin(t * 1.2) * 0.015; };
  return g;
}
