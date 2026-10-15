package uz.mexrliqollar.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Must run before super.onCreate. Xiaomi kills the process if the splash
    // theme is applied after AppCompat has already started.
    SplashScreen.installSplashScreen(this);
    super.onCreate(savedInstanceState);
    // WebView remote debugging ONLY in debug builds (never in release).
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  }
}
