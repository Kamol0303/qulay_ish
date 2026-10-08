import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.mexrliqollar.app',
  appName: "Mehrli qo'llar",
  webDir: 'dist',
  server: {
    // Live API host is still ishliayol.uz until mexrliqollar.uz DNS is ready.
    // WebView Origin https://ishliayol.uz → CORS/same-site friendly.
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'ishliayol.uz',
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
      launchAutoHide: true,
      launchShowDuration: 1200,
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
