/**
 * Debug Logger - Only logs in development mode
 * Filters out Firebase config and other noise
 */

const isDev = import.meta.env.DEV;

// Messages to suppress
const suppressedPatterns = [
  '[Firebase] Active Configuration',
  'Download the React DevTools',
  'Active Configuration:',
];

const shouldSuppress = (message: string): boolean => {
  return suppressedPatterns.some(pattern => 
    String(message).includes(pattern)
  );
};

export const debugLogger = {
  log: (label: string, data?: unknown) => {
    if (isDev && !shouldSuppress(label)) {
      console.log(`[${label}]`, data);
    }
  },

  error: (label: string, error?: unknown) => {
    if (isDev) {
      // Always show errors
      console.error(`[${label}]`, error);
    }
  },

  warn: (label: string, data?: unknown) => {
    if (isDev && !shouldSuppress(label)) {
      console.warn(`[${label}]`, data);
    }
  },

  info: (label: string, data?: unknown) => {
    if (isDev && !shouldSuppress(label)) {
      console.info(`[${label}]`, data);
    }
  },
};
