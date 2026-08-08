package uz.ishliayol.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // WebView remote debugging ONLY in debug builds (never in release).
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  }
}
