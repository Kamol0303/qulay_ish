import { debugLogger } from './lib/debugLogger';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

function envOrEmpty(value: string | undefined, name: string): string {
  if (!value && import.meta.env.DEV) {
    debugLogger.warn(`[Firebase] Missing environment variable: ${name}`);
  }
  return value || '';
}

// Firebase configuration from environment variables (see .env.example)
const firebaseConfig = {
  apiKey: envOrEmpty(import.meta.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY'),
  authDomain: envOrEmpty(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: envOrEmpty(import.meta.env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID'),
  storageBucket: envOrEmpty(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, 'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: envOrEmpty(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: envOrEmpty(import.meta.env.VITE_FIREBASE_APP_ID, 'VITE_FIREBASE_APP_ID'),
  firestoreDatabaseId: envOrEmpty(import.meta.env.VITE_FIRESTORE_DATABASE_ID, 'VITE_FIRESTORE_DATABASE_ID'),
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  debugLogger.error('[Firebase] Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase app (SINGLE SOURCE OF TRUTH)
const app = initializeApp(firebaseConfig);

// Export auth and db
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize functions with error handling
let functionsInstance: any = null;
try {
  functionsInstance = getFunctions(app);
} catch (err) {
  debugLogger.warn('[Firebase] Functions initialization error (expected in some environments):', err);
}
export const functions = functionsInstance;

// Debug: Log active Firebase project (development only)
if (typeof window !== 'undefined' && import.meta.env.DEV && firebaseConfig.projectId) {
  debugLogger.log(
    '[Firebase] Active Configuration:\n' +
    `  Project: ${firebaseConfig.projectId}\n` +
    `  Auth Domain: ${firebaseConfig.authDomain}\n` +
    `  Database: ${firebaseConfig.firestoreDatabaseId}`
  );
}

// Configure Auth persistence for session management
setPersistence(auth, browserLocalPersistence).catch((err) => {
  debugLogger.warn('[Firebase] Auth persistence config error:', err);
});

// EMULATOR CONFIGURATION - Production safe
// Only connects when explicitly enabled via VITE_USE_EMULATOR=true
// Prevents auth/network-request-failed errors on localhost without emulators running
// To use emulators: firebase emulators:start --project=gen-lang-client-0528497200

const USE_EMULATOR = (import.meta as any).env?.VITE_USE_EMULATOR === 'true';

if (USE_EMULATOR && window.location.hostname === 'localhost') {
  try {
    if (!(auth as any).emulatorConfig) {
      debugLogger.log('[Firebase] Connecting to Auth emulator at localhost:9099');
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    if (!(db as any).emulatorConfig) {
      debugLogger.log('[Firebase] Connecting to Firestore emulator at localhost:8080');
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  } catch (err) {
    debugLogger.warn('[Firebase] Emulator connection failed (expected if not running):', err);
  }
}
