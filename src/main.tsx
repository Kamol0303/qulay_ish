import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

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

// Force light mode — remove any dark class that may have been persisted
document.documentElement.classList.remove('dark');
localStorage.removeItem('theme');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
