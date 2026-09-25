package app.cristime.game;

import android.content.Context;
import android.net.wifi.WifiManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

// Локальная сеть без интернета: хост ищется по коду лобби (UDP-broadcast), игра идёт по TCP внутри раздачи/Wi-Fi.
@CapacitorPlugin(name = "LanNet")
public class LanNetPlugin extends Plugin {
  static final int UDP = 47777, TCP = 47778;
  private volatile boolean running = false;
  private DatagramSocket udp; private ServerSocket server; private Socket guest; private PrintWriter guestOut;
  private final Map<Integer, PrintWriter> clients = new ConcurrentHashMap<>(); private final Map<Integer, Socket> socks = new ConcurrentHashMap<>();
  private int nextId = 1; private WifiManager.MulticastLock mlock;
  private final ExecutorService sendPool = Executors.newSingleThreadExecutor();

  private void lock() { try { if (mlock == null) { WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE); mlock = wm.createMulticastLock("cristime"); mlock.setReferenceCounted(false); } mlock.acquire(); } catch (Throwable t) {} }
  private void emit(String ev, int c, String d) { JSObject o = new JSObject(); o.put("c", c); if (d != null) o.put("d", d); notifyListeners(ev, o); }

  @PluginMethod public void host(PluginCall call) {
    stopAll(); final String code = call.getString("code", ""); running = true; lock();
    try {
      server = new ServerSocket(); server.setReuseAddress(true); server.bind(new InetSocketAddress(TCP));
      udp = new DatagramSocket(null); udp.setReuseAddress(true); udp.setBroadcast(true); udp.bind(new InetSocketAddress(UDP));
    } catch (Exception e) { call.reject("host: " + e.getMessage()); return; }
    new Thread(() -> { byte[] buf = new byte[256];
      while (running) { try { DatagramPacket p = new DatagramPacket(buf, buf.length); udp.receive(p);
        String s = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
        if (s.equals("CRISTIME?" + code)) { byte[] r = ("CRISTIME!" + code).getBytes(StandardCharsets.UTF_8); udp.send(new DatagramPacket(r, r.length, p.getAddress(), p.getPort())); }
      } catch (Exception e) { if (!running) break; } } }).start();
    new Thread(() -> { while (running) { try { final Socket s = server.accept(); s.setTcpNoDelay(true); final int id; synchronized (this) { id = nextId++; }
        clients.put(id, new PrintWriter(new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true)); socks.put(id, s); emit("open", id, null);
        new Thread(() -> { try { BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8)); String l;
            while ((l = in.readLine()) != null) emit("msg", id, l); } catch (Exception e) {}
          clients.remove(id); socks.remove(id); try { s.close(); } catch (Exception e) {} emit("close", id, null); }).start();
      } catch (Exception e) { if (!running) break; } } }).start();
    call.resolve();
  }

  private List<InetAddress> broadcasts() { List<InetAddress> out = new ArrayList<>();
    try { for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) { if (!ni.isUp() || ni.isLoopback()) continue;
      for (InterfaceAddress a : ni.getInterfaceAddresses()) if (a.getBroadcast() != null) out.add(a.getBroadcast()); } } catch (Exception e) {}
    try { out.add(InetAddress.getByName("255.255.255.255")); out.add(InetAddress.getByName("192.168.43.255")); } catch (Exception e) {}
    return out; }

  @PluginMethod public void join(PluginCall call) {
    stopAll(); final String code = call.getString("code", ""); final int wait = call.getInt("timeout", 2500); running = true; lock();
    new Thread(() -> {
      InetAddress hostIp = null;
      try (DatagramSocket ds = new DatagramSocket()) { ds.setBroadcast(true); ds.setSoTimeout(300);
        byte[] q = ("CRISTIME?" + code).getBytes(StandardCharsets.UTF_8); long end = System.currentTimeMillis() + wait; byte[] buf = new byte[256];
        while (hostIp == null && System.currentTimeMillis() < end && running) {
          for (InetAddress b : broadcasts()) try { ds.send(new DatagramPacket(q, q.length, b, UDP)); } catch (Exception e) {}
          try { DatagramPacket p = new DatagramPacket(buf, buf.length); ds.receive(p);
            if (new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8).equals("CRISTIME!" + code)) hostIp = p.getAddress(); } catch (SocketTimeoutException e) {}
        }
      } catch (Exception e) {}
      if (hostIp == null) { call.reject("notfound"); return; }
      try { guest = new Socket(); guest.setTcpNoDelay(true); guest.connect(new InetSocketAddress(hostIp, TCP), 3000);
        guestOut = new PrintWriter(new OutputStreamWriter(guest.getOutputStream(), StandardCharsets.UTF_8), true);
      } catch (Exception e) { call.reject("connect: " + e.getMessage()); return; }
      JSObject r = new JSObject(); r.put("ip", hostIp.getHostAddress()); call.resolve(r);
      final Socket g = guest;
      try { BufferedReader in = new BufferedReader(new InputStreamReader(g.getInputStream(), StandardCharsets.UTF_8)); String l;
        while ((l = in.readLine()) != null) emit("msg", 0, l); } catch (Exception e) {}
      if (g == guest) emit("close", 0, null);
    }).start();
  }

  // send: c = -1 всем клиентам (хост) или хосту (гость); c > 0 конкретному; skip — кроме этого
  @PluginMethod public void send(PluginCall call) {
    final String d = call.getString("d", ""); final int c = call.getInt("c", -1), skip = call.getInt("skip", -99);
    sendPool.execute(() -> {
      if (guestOut != null) { guestOut.println(d); return; }
      if (c > 0) { PrintWriter w = clients.get(c); if (w != null) w.println(d); }
      else for (Map.Entry<Integer, PrintWriter> e : clients.entrySet()) if (e.getKey() != skip) e.getValue().println(d);
    });
    call.resolve();
  }
  @PluginMethod public void stop(PluginCall call) { stopAll(); call.resolve(); }
  private void stopAll() {
    running = false;
    try { if (udp != null) udp.close(); } catch (Exception e) {} udp = null;
    try { if (server != null) server.close(); } catch (Exception e) {} server = null;
    for (Socket s : socks.values()) try { s.close(); } catch (Exception e) {} socks.clear(); clients.clear();
    Socket g = guest; guest = null; guestOut = null; try { if (g != null) g.close(); } catch (Exception e) {}
  }
}
