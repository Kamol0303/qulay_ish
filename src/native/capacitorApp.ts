import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Wire native shell: back button, status bar, splash, network banner hook */
export async function initNativeShell(onOfflineChange?: (offline: boolean) => void): Promise<void> {
  if (!isNativeApp()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {
    /* web or unsupported */
  }

  try {
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  if (onOfflineChange) {
    const status = await Network.getStatus();
    onOfflineChange(!status.connected);
    Network.addListener('networkStatusChange', (s) => onOfflineChange(!s.connected));
  }
}
