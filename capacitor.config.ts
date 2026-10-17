import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.mexrliqollar.app',
  appName: "Mehrli qo'llar",
  webDir: 'dist',
  server: {
    // Must NOT be ishliayol.uz. Capacitor serves the app from this hostname and
    // treats every request to it as a local file. The API is also
    // https://ishliayol.uz/api, so that hostname swallows OTP/stats calls inside
    // the APK (home stays 0, SMS is never sent). localhost keeps Origin
    // https://localhost, which the API already allows.
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
    allowNavigation: [
      'ishliayol.uz',
      'www.ishliayol.uz',
      'mexrliqollar.uz',
      'www.mexrliqollar.uz',
      'localhost',
      '127.0.0.1',
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#102833',
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#102833',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  plugins: {
    // Native HTTP patches fetch/XHR — WebView CORS cheklovlarini aylanib o'tadi
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      // Duration 0: the plugin must not touch Android 12's splash view.
      // On Xiaomi that second touch throws and closes the APK at launch.
      launchAutoHide: true,
      launchShowDuration: 0,
      launchFadeOutDuration: 0,
      backgroundColor: '#102833',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#102833',
    },
  },
};

export default config;
