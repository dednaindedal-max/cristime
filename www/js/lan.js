// Игра БЕЗ интернета: соединение WebRTC напрямую по раздаче/Wi-Fi, «рукопожатие» — через QR-коды.
const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
const slim = sdp => sdp.split('\r\n').filter(l => !/^a=(extmap|msid-semantic|ice-options)/.test(l)).join('\r\n');
function gather(pc) {
  return new Promise(res => { if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
}
export function createLan({ onMsg, onOpen, onClose }) {
  const peers = new Map(); let n = 0, pending = null;
  const wire = (dc, key) => {
    dc.onopen = () => { peers.set(key, dc); onOpen?.(key); };
    dc.onclose = () => { peers.delete(key); onClose?.(key); };
    dc.onmessage = e => { try { onMsg?.(key, JSON.parse(e.data)); } catch (err) {} };
  };
  const newPc = () => new RTCPeerConnection({ iceServers: [] });
  return {
    async makeOffer() {                               // хост: QR для очередного друга
      const pc = newPc(), key = 'p' + (++n); wire(pc.createDataChannel('g'), key);
      await pc.setLocalDescription(await pc.createOffer()); await gather(pc);
      pending = pc; return enc({ t: 'o', s: slim(pc.localDescription.sdp) });
    },
    async acceptAnswer(code) { const d = dec(code); if (d.t !== 'a' || !pending) throw new Error('Это не QR-ответ'); await pending.setRemoteDescription({ type: 'answer', sdp: d.s }); pending = null; },
    async answerOffer(code) {                         // гость: сканировал QR хоста → свой QR-ответ
      const d = dec(code); if (d.t !== 'o') throw new Error('Это не QR хоста');
      const pc = newPc(); pc.ondatachannel = e => wire(e.channel, 'host');
      await pc.setRemoteDescription({ type: 'offer', sdp: d.s });
      await pc.setLocalDescription(await pc.createAnswer()); await gather(pc);
      return enc({ t: 'a', s: slim(pc.localDescription.sdp) });
    },
    send(msg, except) { const s = JSON.stringify(msg); for (const [k, dc] of peers) if (k !== except && dc.readyState === 'open') dc.send(s); },
    close() { for (const dc of peers.values()) try { dc.close(); } catch (e) {} peers.clear(); pending = null; },
    get count() { return peers.size; }
  };
}
