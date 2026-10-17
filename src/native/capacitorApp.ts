import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Wire native shell: back button, status bar, network banner hook. */
export async function initNativeShell(onOfflineChange?: (offline: boolean) => void): Promise<void> {
  if (!isNativeApp()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {
    /* web or unsupported */
  }

  App.addListener('backButton', () => {
    // Never finish the activity. An empty WebView history closes the APK.
    window.dispatchEvent(new Event('app:back'));
  });

  if (onOfflineChange) {
    const status = await Network.getStatus();
    onOfflineChange(!status.connected);
    Network.addListener('networkStatusChange', (s) => onOfflineChange(!s.connected));
  }
}
