import * as THREE from 'three';
import { joinRoom as tJoin, selfId } from '../vendor/trystero-nostr.js';
import { createChibi } from '../models/chibi.js';
import { createLan } from './lan.js';
import { registerPlugin, Capacitor } from '../vendor/capcore.js';
// в приложении (APK) — нативная локальная сеть: работает в раздаче вообще без интернета
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform?.());
const LN = NATIVE ? registerPlugin('LanNet') : null;
export const nativeHz = () => LN ? LN.hz().then(r => r.hz).catch(() => 0) : Promise.resolve(0);

// Онлайн без своего сервера: игроки находят друг друга через публичные nostr-реле (много серверов по миру,
// нужен совсем слабый интернет — хватает EDGE), дальше игра идёт напрямую P2P (WebRTC).
// В одной Wi-Fi/раздаче трафик идёт локально. Сайт может лежать на любом хостинге (Vercel).
const APP = 'cristime-lobby-v2';
const RTC = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:5349'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }] };
const TICK = 66;

function label(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = '600 30px system-ui,sans-serif'; const w = Math.min(240, x.measureText(text).width + 30);
  x.fillStyle = 'rgba(10,20,60,.6)'; x.beginPath(); x.roundRect((256 - w) / 2, 10, w, 44, 22); x.fill();
  x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.beginPath(); x.arc((256 - w) / 2 + 16, 32, 7, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128 + 8, 33);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
  sp.scale.set(1.0, 0.25, 1); sp.position.y = 1.55; sp.renderOrder = 10; return sp;
}

export function createNet({ scene, getMe, onPlayers, onStatus, onBall }) {
  let lan = null, lanIds = {};
  let room = null, code = null, host = false, timer = null, sendSt = null, sendBall = null;
  const states = {}, seen = {}, avatars = new Map();
  const genCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');

  function avatarFor(id, st) {
    let a = avatars.get(id);
    if (a && (a.color !== st.color || a.name !== st.name)) { scene.remove(a.obj); avatars.delete(id); a = null; }
    if (!a) {
      const obj = createChibi({ color: st.color }); obj.scale.setScalar(0.95); obj.add(label(st.name || 'Игрок', st.color));
      obj.position.set(st.x, st.y, st.z); scene.add(obj);
      a = { obj, name: st.name, color: st.color, tgt: new THREE.Vector3(st.x, st.y, st.z), f: st.f, s: 0, air: 0 }; avatars.set(id, a);
    }
    a.tgt.set(st.x, st.y, st.z); a.f = st.f; a.s = st.s; a.air = st.a; a.m = st.m || 'walk'; a.th = st.th || 0;
  }
  function list() {
    const me = getMe();
    onPlayers?.([{ id: selfId, name: me.name, color: me.color, me: true }, ...Object.entries(states).map(([id, s]) => ({ id, name: s.name, color: s.color }))]);
  }
  function drop(id) { delete states[id]; delete seen[id]; const a = avatars.get(id); if (a) { scene.remove(a.obj); avatars.delete(id); } list(); }

  function open(c, isHost) {
    leave(); code = c.trim().toUpperCase(); host = isHost;
    try { room = tJoin({ appId: APP, rtcConfig: RTC }, code); }
    catch (e) { onStatus?.('error', 'Онлайн не запустился: ' + e.message); throw e; }
    const [sS, gS] = room.makeAction('st'); const [sB, gB] = room.makeAction('bl'); const [sR, gR] = room.makeAction('rl');
    sendSt = d => { sS(d); if (lnOn) lnSend({ k: 'st', id: selfId, d }); }; sendBall = d => { sB(d); if (lnOn) lnSend({ k: 'bl', id: selfId, d }); };
    relayNet = m => sR(m);
    const onSt = (d, id) => { recvSt(d, id); if (lnOn) lnSend({ k: 'st', id, d }); };
    gS(onSt); gB((b, id) => { onBall?.({ ...b, o: id }); if (lnOn) lnSend({ k: 'bl', id, d: b }); });
    gR(m => handle(m));
    if (isHost && LN) lnHost(code);
    room.onPeerJoin(() => list());
    room.onPeerLeave(id => { const n = states[id]?.name; drop(id); if (n) onStatus?.('leave', n); });
    timer = setInterval(() => {
      sendSt?.(getMe());
      const now = performance.now(); for (const id in seen) if (now - seen[id] > 8000) drop(id);   // пропал без сигнала
    }, TICK);
    list();
    return Promise.resolve(code);
  }
  // ---------- нативная LAN (APK): хост = TCP-сервер, гости находят его по коду ----------
  let lnOn = false, lnIds = {}, relayNet = null, lnSubs = [];
  const lnSend = (m, skip) => LN.send({ d: JSON.stringify(m), c: -1, skip: skip ?? -99 }).catch(() => {});
  function handle(m) { if (!m || m.id === selfId) return; if (m.k === 'st') recvSt(m.d, m.id); else if (m.k === 'bl') onBall?.({ ...m.d, o: m.id }); else if (m.k === 'bye') { const n = states[m.id]?.name; drop(m.id); if (n) onStatus?.('leave', n); } }
  async function lnListen(isHost) {
    lnSubs.push(await LN.addListener('msg', e => { let m; try { m = JSON.parse(e.d); } catch (x) { return; }
      if (isHost) { lnIds[e.c] = m.id; lnSend(m, e.c); relayNet?.(m); } handle(m); }));
    lnSubs.push(await LN.addListener('close', e => { if (isHost) { const id = lnIds[e.c]; if (id) { lnSend({ k: 'bye', id }); relayNet?.({ k: 'bye', id }); const n = states[id]?.name; drop(id); if (n) onStatus?.('leave', n); } }
      else onStatus?.('error', 'Связь с хостом потеряна'); }));
  }
  async function lnHost(c) { try { await LN.host({ code: c }); await lnListen(true); lnOn = true; } catch (e) { console.warn('LAN host', e); } }
  async function lnJoin(c) {
    await LN.join({ code: c, timeout: 2500 });     // бросит ошибку, если хоста в этой сети нет
    leave(); code = c; host = false; lnOn = true; await lnListen(false);
    sendSt = d => lnSend({ k: 'st', id: selfId, d }); sendBall = d => lnSend({ k: 'bl', id: selfId, d });
    timer = setInterval(() => { sendSt(getMe()); const now = performance.now(); for (const id in seen) if (now - seen[id] > 8000) drop(id); }, TICK);
    list(); return c;
  }
  // ---------- режим без интернета (QR) ----------
  function recvSt(d, id) { states[id] = d; seen[id] = performance.now(); avatarFor(id, d); const a = avatars.get(id); if (!a.listed) { a.listed = true; list(); onStatus?.('join', d.name); } }
  function openLan(isHost) {
    leave(); host = isHost; code = 'LAN';
    lan = createLan({
      onMsg: (key, m) => {
        if (m.id === selfId) return;
        if (isHost) { lanIds[key] = m.id; lan.send(m, key); }            // хост пересылает остальным
        if (m.k === 'st') recvSt(m.d, m.id); else if (m.k === 'bl') onBall?.({ ...m.d, o: m.id }); else if (m.k === 'bye') drop(m.id);
      },
      onOpen: key => { onStatus?.('lanopen', key); },
      onClose: key => { if (isHost && lanIds[key]) { lan.send({ k: 'bye', id: lanIds[key] }); drop(lanIds[key]); } if (!isHost) onStatus?.('error', 'Связь с хостом потеряна'); }
    });
    sendSt = d => lan.send({ k: 'st', id: selfId, d }); sendBall = d => lan.send({ k: 'bl', id: selfId, d });
    timer = setInterval(() => { sendSt(getMe()); const now = performance.now(); for (const id in seen) if (now - seen[id] > 8000) drop(id); }, TICK);
    list(); return lan;
  }
  const hostRoom = () => open(genCode(), true);
  async function joinRoom(c) { c = c.trim().toUpperCase();
    if (LN) { onStatus?.('info', 'Ищу лобби в этой сети…'); try { return await lnJoin(c); } catch (e) { onStatus?.('info', 'Подключаюсь через интернет…'); } }
    const r = await open(c, false);
    setTimeout(() => { if (room && code === c && !Object.keys(states).length) onStatus?.('empty', c); }, 12000);
    return r; }
  function leave() {
    clearInterval(timer); timer = null;
    try { room?.leave(); } catch (e) {}
    lan?.close(); lan = null; lanIds = {};
    if (lnOn) { lnOn = false; LN.stop().catch(() => {}); lnSubs.forEach(h => h.remove?.()); lnSubs = []; lnIds = {}; } relayNet = null;
    room = null; sendSt = sendBall = null; code = null; host = false;
    for (const id of Object.keys(states)) drop(id);
  }
  function update(dt, t) {
    const k = 1 - Math.exp(-dt * 12);
    for (const a of avatars.values()) {
      a.obj.position.lerp(a.tgt, k);
      let d = a.f - a.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); a.obj.rotation.y += d * k;
      a.obj.userData.animate(dt, a.s, t, !!a.air, a.m, a.th);
    }
  }
  const throwBall = (o, v) => sendBall?.({ x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2) });
  const targets = () => [...avatars.entries()].map(([id, a]) => ({ id, p: a.obj.position }));
  return { throwBall, targets, hostRoom, joinRoom, leave, update, get myId() { return selfId; }, get code() { return code; }, get online() { return !!room || !!lan || lnOn; }, get local() { return lnOn && !room; }, openLan, get lan() { return lan; }, get isHost() { return host; } };
}
