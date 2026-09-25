package app.cristime.game;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

// Высокая частота экрана (90/120/144 Гц) + полный экран + экран не гаснет
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle b) { registerPlugin(LanNetPlugin.class); super.onCreate(b); boost(); }
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
