import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.ishliayol.app',
  appName: 'ishliayol.uz',
  webDir: 'dist',
  server: {
    // Bundled SPA + absolute API (VITE_API_URL). Hostname matches production
    // so WebView Origin is https://ishliayol.uz (CORS/same-site friendly).
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'ishliayol.uz',
    cleartext: false,
    allowNavigation: [
      'ishliayol.uz',
      'www.ishliayol.uz',
      'localhost',
      '127.0.0.1',
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#0f172a',
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
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
