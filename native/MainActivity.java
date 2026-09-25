package app.cristime.game;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import java.io.*;
import java.util.*;
import java.util.zip.InflaterInputStream;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

// Высокая частота экрана (90/120/144 Гц) + полный экран + экран не гаснет
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle b) { registerPlugin(LanNetPlugin.class); super.onCreate(b); vault(); boost(); }
  // ---- игра лежит зашифрованной в assets/game.dat и расшифровывается только в память ----
  private final HashMap<String, byte[]> V = new HashMap<>();
  private static final int[] A = {0x18,0x5a,0x50,0x51,0x0c,0x81,0x05,0x00,0xef,0x7a,0xd9,0xf4,0xd1,0xab,0x76,0x77};
  private static final int[] Bk = {0x64,0x6c,0xc7,0x86,0xb3,0x22,0x2a,0x0b,0xd7,0xbe,0xb3,0xc0,0x4c,0x46,0xfd,0x71};
  private void vault() {
    try {
      InputStream in = getAssets().open("game.dat"); ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] t = new byte[65536]; int n;
      while ((n = in.read(t)) > 0) bo.write(t, 0, n); in.close(); byte[] f = bo.toByteArray();
      byte[] k = new byte[16]; for (int i = 0; i < 16; i++) k[i] = (byte) (A[i] ^ Bk[i]);
      Cipher c = Cipher.getInstance("AES/CTR/NoPadding"); c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(k, "AES"), new IvParameterSpec(Arrays.copyOfRange(f, 4, 20)));
      byte[] z = c.doFinal(f, 20, f.length - 20);
      DataInputStream d = new DataInputStream(new InflaterInputStream(new ByteArrayInputStream(z)));
      int cnt = d.readInt(); for (int i = 0; i < cnt; i++) { byte[] p = new byte[d.readUnsignedShort()]; d.readFully(p); byte[] data = new byte[d.readInt()]; d.readFully(data); V.put(new String(p, "UTF-8"), data); }
      // расшифрованная игра — во внутренней памяти приложения (недоступна другим приложениям и файловым менеджерам)
      File dir = new File(getFilesDir(), "g"); deleteDir(dir); dir.mkdirs();
      for (Map.Entry<String, byte[]> e : V.entrySet()) { File o = new File(dir, e.getKey().substring(1)); o.getParentFile().mkdirs(); FileOutputStream fo = new FileOutputStream(o); fo.write(e.getValue()); fo.close(); }
      V.clear();
      getBridge().setServerBasePath(dir.getAbsolutePath());
    } catch (Throwable e) { }
  }
  private static void deleteDir(File f) { if (f.isDirectory()) { File[] l = f.listFiles(); if (l != null) for (File c : l) deleteDir(c); } f.delete(); }
  private static String mime(String p) {
    if (p.endsWith(".js")) return "text/javascript"; if (p.endsWith(".html")) return "text/html"; if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".json")) return "application/json"; if (p.endsWith(".ogg")) return "audio/ogg"; if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".jpg")) return "image/jpeg"; return "application/octet-stream";
  }
  @Override public void onResume() { super.onResume(); boost(); }
  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) boost(); }
  private void boost() {
    try {
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
      if (d != null && Build.VERSION.SDK_INT >= 23) {
        Display.Mode cur = d.getMode(), best = cur;
        for (Display.Mode m : d.getSupportedModes())
          if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight() && m.getRefreshRate() > best.getRefreshRate()) best = m;
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        if (lp.preferredDisplayModeId == best.getModeId()) { hideBars(); return; }   // уже выставлено — не трогаем окно (иначе моргает)
        lp.preferredDisplayModeId = best.getModeId();
        lp.preferredRefreshRate = best.getRefreshRate();
        if (Build.VERSION.SDK_INT >= 28) lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        getWindow().setAttributes(lp);
      }
      hideBars();
    } catch (Throwable t) { }
  }
  private int lastUi = -1;
  private void hideBars() {
    try { int f = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
      if (getWindow().getDecorView().getSystemUiVisibility() != f) getWindow().getDecorView().setSystemUiVisibility(f);
    } catch (Throwable t) { }
  }
  private void unusedOld() {
    try {
      getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    } catch (Throwable t) { }
  }
}
