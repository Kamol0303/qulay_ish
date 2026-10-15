package uz.mexrliqollar.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens the system screens the location gate needs when the user must turn location on. */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {
  @PluginMethod
  public void openAppSettings(PluginCall call) {
    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
    intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
    start(intent);
    call.resolve();
  }

  @PluginMethod
  public void openLocationSettings(PluginCall call) {
    start(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
    call.resolve();
  }

  private void start(Intent intent) {
    if (getActivity() != null) {
      getActivity().startActivity(intent);
      return;
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
  }
}
