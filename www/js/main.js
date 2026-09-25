import * as THREE from 'three';
import { createMap } from '../models/map.js';
import { createPlayer } from './player.js';
import { createNet } from './net.js';
import { createSnowballs } from './snow.js';
import { createFestive } from './festive.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
window.__load?.(75, 'Строим карту…');

const qp = new URLSearchParams(location.search);
const SHOT = qp.get('shot');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!SHOT, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(SHOT ? 1 : Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;       // статичные тени — один раз
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2d52ad, 32, 70); scene.background = new THREE.Color(0x0a1850);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 400);
scene.add(new THREE.HemisphereLight(0xb4c8ff, 0x2a4290, 0.9));
const sun = new THREE.DirectionalLight(0xfff8f0, 1.35); sun.position.set(-14, 26, 22); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 25, bottom: -25, far: 100 }); sun.shadow.camera.updateProjectionMatrix();
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xfff4e0, 0.25); fill.position.set(6, 3, 5); scene.add(fill);

const map = createMap(); scene.add(map); map.userData.freeze(true);
const festive = createFestive({ scene, map, camera });
// дополнительные препятствия: столбы арки
const baseCols = map.userData.colliders;
map.userData.colliders = () => baseCols().concat([{ k: 'c', x: -1.1, z: 10.4, r: 0.15, top: 99 }, { k: 'c', x: 2.7, z: 10.4, r: 0.15, top: 99 }]);
let COLS = map.userData.colliders();

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const status = t => $('status').textContent = t || '';
let toastT; const toast = t => { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => e.style.display = 'none', 2600); };

const COLORS = [0xc8352c, 0x2f6fd6, 0x2f9a36, 0xf2b705, 0x9b4dd6, 0xff6fa8, 0x1fb5b0, 0xf07a22];
const prefs = JSON.parse(localStorage.getItem('cristime') || '{}');
prefs.name = prefs.name || ''; prefs.color = prefs.color ?? COLORS[0];
const savePrefs = () => localStorage.setItem('cristime', JSON.stringify(prefs));

let net;
const balls = createSnowballs({ scene, heightAt: map.userData.heightAt, getColliders: () => COLS,
  getTargets: () => [{ id: net?.myId || 'me', p: player.pos }, ...(net ? net.targets() : [])],
  onHitMe: () => { player.onHit(); const f = $('frost'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); } });
const player = createPlayer({ scene, camera, renderer, onThrow: (o, v) => { balls.spawn(o, v, net?.myId || 'me'); net?.throwBall(o, v); } });
net = createNet({ scene, getMe: () => ({ ...player.getState(), name: prefs.name, color: prefs.color }),
  onBall: b => balls.spawn(new THREE.Vector3(b.x, b.y, b.z), new THREE.Vector3(b.vx, b.vy, b.vz), b.o),
  onPlayers: list => { $('rList').innerHTML = list.map(p => `<div><i style="background:#${new THREE.Color(p.color).getHexString()}"></i>${esc(p.name || 'Игрок')}${p.me ? ' (ты)' : ''}</div>`).join(''); },
  onStatus: (k, v) => { if (k === 'join') toast('👋 ' + v + ' зашёл в лобби'); if (k === 'lanopen') { qrHide(); if (state !== 'game') { toGame(true); $('rCode').textContent = 'без интернета'; $('rCopy').style.display = 'none'; } else toast('Игрок подключён!'); } if (k === 'leave') toast(v + ' вышел'); if (k === 'info') status(v); if (k === 'empty') toast('В лобби ' + v + ' пока никого — проверь код или подожди друга'); if (k === 'error') { status(v); toast(v); if (state === 'game' && !net.online) $('room').style.display = 'none'; } } });

$('nick').value = prefs.name; $('nick').oninput = e => { prefs.name = e.target.value.trim().slice(0, 14); savePrefs(); $('nick').classList.remove('bad'); };
$('colors').innerHTML = COLORS.map(c => `<button data-c="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
const markColor = () => $('colors').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.c === prefs.color));
$('colors').onclick = e => { const c = e.target.dataset?.c; if (!c) return; prefs.color = +c; savePrefs(); markColor(); player.setColor(prefs.color).visible = true; };
markColor(); player.setColor(prefs.color);

// ---------- состояния ----------
let state = 'lobby';
const MENU_P = new THREE.Vector3(0.6, 0, 5.2);
function toLobby() {
  net.leave(); player.enable(false, map);
  state = 'lobby'; document.body.classList.add('inlobby'); $('lobby').classList.remove('hide'); $('room').style.display = 'none';
  $('scrMain').style.display = ''; $('scrJoin').style.display = 'none'; $('scrLan').style.display = 'none'; status(''); qrHide();
  const c = player.chibi; c.visible = true; c.position.copy(MENU_P); c.position.y = map.userData.heightAt(MENU_P.x, MENU_P.z); c.userData.setBlobY?.(0.012);
  camera.fov = 45; camera.updateProjectionMatrix();
}
function toGame(online) {
  state = 'game'; document.body.classList.remove('inlobby'); $('lobby').classList.add('hide');
  player.enable(true, map); COLS = map.userData.colliders();
  $('room').style.display = online ? 'block' : 'none'; if (online) $('rCode').textContent = net.code; $('rCopy').style.display = ''; $('rAdd').style.display = 'none';
  toast(online ? (net.isHost ? 'Лобби создано! Код: ' + net.code + ' — скажи его другу' : 'Ты в лобби ' + net.code + '. Ждём остальных…') : 'Горка — справа, снежки — кнопка ❄ / F / клик');
}
const needName = () => { if (prefs.name) return false; status('Сначала введи имя'); $('nick').classList.add('bad'); $('nick').focus(); return true; };
const busy = b => document.querySelectorAll('#lobby .big').forEach(x => x.disabled = b);
$('bHost').onclick = async () => { if (needName()) return; busy(true); status('Создаю лобби…'); try { await net.hostRoom(); toGame(true); } catch (e) {} busy(false); };
$('bJoinScr').onclick = () => { if (needName()) return; $('scrMain').style.display = 'none'; $('scrJoin').style.display = ''; $('code').focus(); status(''); };
$('bBack').onclick = () => { $('scrMain').style.display = ''; $('scrJoin').style.display = 'none'; status(''); };
$('bJoin').onclick = async () => { if (!prefs.name) { $('bBack').click(); return needName(); } const c = $('code').value.trim(); if (c.length < 5) return status('Введите код из 5 символов');
  busy(true); status('Подключаюсь…'); try { await net.joinRoom(c); toGame(true); } catch (e) {} busy(false); };
$('code').onkeydown = e => { if (e.key === 'Enter') $('bJoin').click(); };
$('bSolo').onclick = () => { if (!needName()) toGame(false); };
$('menuBtn').onclick = () => toLobby();
// ---------- без интернета: QR-рукопожатие ----------
const qr = { mode: null, stream: null, loop: 0 };
function qrShow(title, hint, code) {
  $('qTitle').textContent = title; $('qHint').textContent = hint; $('qrm').classList.add('on'); $('qText').value = ''; qr.code = code || '';
  if (code) { const q = window.qrcode(0, 'L'); q.addData(code); q.make(); $('qImg').innerHTML = q.createImgTag(4, 8); } else $('qImg').innerHTML = '';
}
function qrStop() { cancelAnimationFrame(qr.loop); qr.stream?.getTracks().forEach(t => t.stop()); qr.stream = null; $('qVid').style.display = 'none'; }
function qrHide() { qrStop(); $('qrm').classList.remove('on'); }
async function qrScan() {
  if (!('BarcodeDetector' in window)) { toast('Камера-сканер не поддерживается — используй «Код текстом»'); $('qrm').querySelector('details').open = true; return; }
  try {
    const bd = new BarcodeDetector({ formats: ['qr_code'] });
    qr.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('qVid'); v.srcObject = qr.stream; v.style.display = 'block'; $('qImg').innerHTML = ''; await v.play();
    const tick = async () => { try { const r = await bd.detect(v); if (r[0]) { qrStop(); return onCode(r[0].rawValue); } } catch (e) {} qr.loop = requestAnimationFrame(tick); };
    tick();
  } catch (e) { toast('Нет доступа к камере'); }
}
async function onCode(code) {
  try {
    if (qr.mode === 'hostScan') { await net.lan.acceptAnswer(code); qrShow('Подключаем…', 'Ещё пара секунд'); }
    else if (qr.mode === 'guestScan') { status(''); const ans = await net.lan.answerOffer(code); qr.mode = 'guestShow'; qrShow('Покажи этот QR хосту', 'Хост сканирует его — и ты в игре', ans); }
  } catch (e) { toast('Не тот QR: ' + e.message); }
}
async function hostAdd() { qr.mode = 'hostShow'; qrShow('Готовлю QR…', ''); const code = await net.lan.makeOffer();
  qrShow('1) Друг сканирует этот QR', '2) Потом нажми «Сканировать» и наведи на его QR', code); qr.mode = 'hostScan'; }
$('qScan').onclick = qrScan; $('qClose').onclick = qrHide;
$('qCopy').onclick = async () => { try { await navigator.clipboard.writeText(qr.code); toast('Скопировано'); } catch (e) { $('qText').value = qr.code; } };
$('qPaste').onclick = () => { const v = $('qText').value.trim(); if (v) onCode(v); };
$('bLan').onclick = () => { if (needName()) return; $('scrMain').style.display = 'none'; $('scrLan').style.display = ''; status('Все должны быть в одной раздаче / Wi-Fi'); };
$('bLanBack').onclick = () => { $('scrMain').style.display = ''; $('scrLan').style.display = 'none'; status(''); };
$('bLanHost').onclick = () => { net.openLan(true); toGame(true); $('rCode').textContent = 'без интернета'; $('rCopy').style.display = 'none'; $('rAdd').style.display = ''; hostAdd(); };
$('rAdd').onclick = hostAdd;
$('bLanJoin').onclick = () => { net.openLan(false); qr.mode = 'guestScan'; qrShow('Отсканируй QR хоста', 'Хост нажимает «➕ Игрок» и показывает QR'); qrScan(); };

$('rCopy').onclick = async () => { const url = location.origin + location.pathname + '?room=' + net.code;
  try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована!'); } catch (e) { prompt('Ссылка для друга:', url); } };
const fsUnused = async () => { try { if (!document.fullscreenElement) { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape').catch(() => {}); } else await document.exitFullscreen(); } catch (e) {} };

document.addEventListener('contextmenu', e => e.preventDefault());

// снег в меню
const sc = $('snowfx'), sx = sc.getContext('2d'); const flakes = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: 0.02 + Math.random() * 0.05, w: Math.random() * 6 }));
function snowUI(t) { if (sc.width !== innerWidth) { sc.width = innerWidth; sc.height = innerHeight; }
  sx.clearRect(0, 0, sc.width, sc.height); sx.fillStyle = 'rgba(255,255,255,.85)';
  for (const f of flakes) { f.y += f.v * 0.016; if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } sx.beginPath(); sx.arc((f.x + Math.sin(t * 0.8 + f.w) * 0.01) * sc.width, f.y * sc.height, f.r, 0, 7); sx.fill(); } }
function lobbyCam(t, dt) {
  const c = player.chibi, a = 0.35 + Math.sin(t * 0.12) * 0.45, R = 2.6;
  const base = c.position.clone().add(new THREE.Vector3(0, 0.55, 0));
  camera.position.set(base.x + Math.sin(a) * R, base.y + 0.35, base.z + Math.cos(a) * R);
  const right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
  camera.lookAt(base.clone().addScaledVector(right, innerWidth > innerHeight ? -0.75 : 0).add(new THREE.Vector3(0, 0.1, 0)));
  c.rotation.y = a * 0.8; c.userData.animate(dt, 0, t, false);
}
let portalCd = 0;
toLobby();
const urlRoom = qp.get('room');
if (urlRoom) { $('scrMain').style.display = 'none'; $('scrJoin').style.display = ''; $('code').value = urlRoom.toUpperCase(); status('Приглашение в комнату ' + urlRoom.toUpperCase() + ' — нажми «Войти»'); }
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); });
// ---------- авто-разрешение: держим частоту экрана (90/120/144 Гц), снижая чёткость только если GPU не успевает ----------
let hzMax = 60, resK = 1;
function autoRes(fps, ms) {
  if (SHOT) return; hzMax = Math.max(hzMax, fps); const budget = 1000 / hzMax;
  const old = resK;
  if (ms > budget * 0.85 && fps < hzMax * 0.92) resK = Math.max(0.55, resK - 0.08);
  else if (ms < budget * 0.5 && resK < 1) resK = Math.min(1, resK + 0.04);
  if (old !== resK) { renderer.setPixelRatio(basePR * resK); renderer.setSize(innerWidth, innerHeight); composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(innerWidth, innerHeight); }
}
let basePR = 1;
// ---------- настройки ----------
let composer = null, bloom = null;
const QH = ['Максимум FPS, без теней', 'Баланс', 'Чёткая картинка, мягкие тени', 'Супер-шейдеры: свечение огней (bloom), сглаживание SMAA, тени 4K, полное разрешение'];
prefs.q = prefs.q ?? 2; prefs.sens = prefs.sens ?? 1; prefs.fov = prefs.fov ?? 70; prefs.fps = prefs.fps ?? true;
function applySettings() {
  const q = prefs.q, dpr = devicePixelRatio;
  basePR = SHOT ? 1 : [0.75, 1, Math.min(dpr, 1.25), Math.min(dpr, 2)][q]; resK = 1; renderer.setPixelRatio(basePR);
  renderer.setSize(innerWidth, innerHeight);
  const sm = [512, 1024, 2048, 4096][q]; sun.castShadow = q > 0;
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  renderer.shadowMap.type = q >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; renderer.shadowMap.needsUpdate = true;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
  if (q === 3) { if (!composer) { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.82); composer.addPass(bloom);
      composer.addPass(new OutputPass()); composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio())); }
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
  camera.fov = prefs.fov; camera.updateProjectionMatrix(); player.setSens?.(prefs.sens); player.setFov?.(prefs.fov);
  $('fps').style.display = prefs.fps ? '' : 'none';
  document.querySelectorAll('#sQ button').forEach(b => b.classList.toggle('on', +b.dataset.v === q)); $('sQh').textContent = QH[q];
  $('sSens').value = prefs.sens; $('sSv').textContent = '×' + (+prefs.sens).toFixed(2); $('sFov').value = prefs.fov; $('sFv').textContent = prefs.fov + '°'; $('sFps').checked = prefs.fps;
  savePrefs();
}
document.querySelectorAll('#sQ button').forEach(b => b.onclick = () => { prefs.q = +b.dataset.v; applySettings(); });
$('sSens').oninput = e => { prefs.sens = +e.target.value; applySettings(); }; $('sFov').oninput = e => { prefs.fov = +e.target.value; applySettings(); };
$('sFps').onchange = e => { prefs.fps = e.target.checked; applySettings(); };
const openSet = () => $('setm').classList.add('on'); $('setBtn').onclick = openSet; $('bSet').onclick = openSet; $('sClose').onclick = () => $('setm').classList.remove('on');
// Enter на клавиатуре телефона = готово (клавиатура закрывается)
['nick', 'code'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); if (id === 'code') $('bJoin')?.click(); } }));
applySettings();

// ---------- производительность: реальный FPS (ограничен монитором) + время кадра на GPU ----------
const gl = renderer.getContext(), tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
let q = null, gpuMs = 0, qN = 0;
function renderTimed() {
  const measure = tq && !q && (qN++ % 10 === 0);
  if (measure) { q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); }
  if (composer && prefs.q === 3) composer.render(); else renderer.render(scene, camera);
  if (measure) gl.endQuery(tq.TIME_ELAPSED_EXT);
  if (q && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gpuMs = gpuMs ? gpuMs * 0.7 + ms * 0.3 : ms; } gl.deleteQuery(q); q = null; }
}
const clock = new THREE.Clock();
const fpsEl = $('fps'); let fN = 0, fT = performance.now(), cpuMs = 0;
function frame() {
  const t0 = performance.now();
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  map.userData.update(t); festive.update(dt, t);
  if (state === 'lobby') { lobbyCam(t, dt); snowUI(t); } else {
    player.update(dt, t);
    portalCd -= dt; if (portalCd <= 0 && player.pos.distanceTo(festive.portalPos) < 1.1) { portalCd = 4; toast('🎮 Мини-игры скоро появятся! Пока — горка и снежки'); }
  }
  balls.update(dt, net.myId || 'me'); net.update(dt, t);
  renderTimed();
  cpuMs = cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  fN++; const n = performance.now();
  if (n - fT > 500) { const fps = Math.round(fN * 1000 / (n - fT)); const frameMs = Math.max(cpuMs, gpuMs || 0);
    autoRes(fps, frameMs);
    fpsEl.innerHTML = `${fps} FPS <span>кадр ${frameMs.toFixed(1)} мс · запас ≈${Math.round(1000 / Math.max(frameMs, 0.3))} FPS</span>`; fN = 0; fT = n; }
}
if (SHOT) { document.getElementById('loader')?.remove();
  setTimeout(() => {
    if (qp.get('play')) { toGame(false); if (qp.get('view') === 'f') player.look(Math.PI, 0.12, qp.get('d') ? +qp.get('d') : 1.7);
      if (qp.get('slide')) player.debug.set('slide', +qp.get('slide')); if (qp.get('climb')) player.debug.set('climb', +qp.get('climb'));
      if (qp.get('yaw')) player.look(+qp.get('yaw'), 0.25, 4.5); if (qp.get('fp')) $('pView').click(); }
    const steps = +(qp.get('steps') || 40);
    for (let i = 0; i < steps; i++) { if (qp.get('th') && i === steps - +qp.get('th')) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); map.userData.update(i * 0.033); festive.update(0.033, i * 0.033); if (state === 'lobby') { lobbyCam(i * 0.033, 0.033); snowUI(i * 0.033); } else player.update(0.033, i * 0.033); }
    renderer.render(scene, camera); renderer.render(scene, camera);
    console.log('calls', renderer.info.render.calls, 'tris', renderer.info.render.triangles);
    const N = 60, t0 = performance.now(); for (let i = 0; i < N; i++) renderer.render(scene, camera); gl.finish();
    console.log('ms/frame', ((performance.now() - t0) / N).toFixed(2));
    document.title = 'done';
  }, 300);
} else { window.__load?.(88, 'Готовим шейдеры…'); setTimeout(() => { try { renderer.compile(scene, camera); } catch (e) {} window.__load?.(100, 'Готово!'); renderer.setAnimationLoop(frame); }, 30); }

if ('serviceWorker' in navigator && !SHOT) navigator.serviceWorker.register('sw.js').catch(() => {});
