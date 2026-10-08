import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { clearLegacyDemoStorage } from './lib/demoMode';
import { hydrateTokenFromNativePreferences } from './native/tokenPreferences';

// Suppress React DevTools message and other noise in development
if (import.meta.env.DEV) {
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const message = String(args[0] || '');
    if (!message.includes('Download the React DevTools') && 
        !message.includes('Active Configuration')) {
      originalLog(...args);
    }
  };
}

clearLegacyDemoStorage();

async function boot() {
  await hydrateTokenFromNativePreferences();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
