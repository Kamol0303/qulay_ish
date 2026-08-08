import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.ishliayol.app',
  appName: 'ishliayol.uz',
  webDir: 'dist',
  server: {
    // Bundled SPA talks to production API via VITE_API_URL (absolute HTTPS).
    androidScheme: 'https',
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
  plugins: {
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
