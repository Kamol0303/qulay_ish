import { debugLogger } from './lib/debugLogger';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Firebase config env yetishmayapti: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
  firestoreDatabaseId: requireEnv('VITE_FIRESTORE_DATABASE_ID'),
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let functionsInstance: ReturnType<typeof getFunctions> | null = null;
try {
  functionsInstance = getFunctions(app);
} catch (err) {
  debugLogger.warn('[Firebase] Functions initialization error (expected in some environments):', err);
}
export const functions = functionsInstance;

if (typeof window !== 'undefined') {
  debugLogger.log(
    '[Firebase] Active Configuration:\n' +
    `  Project: ${firebaseConfig.projectId}\n` +
    `  Auth Domain: ${firebaseConfig.authDomain}\n` +
    `  API Key: ${firebaseConfig.apiKey.substring(0, 20)}...\n` +
    `  Database: ${firebaseConfig.firestoreDatabaseId}`
  );
}

setPersistence(auth, browserLocalPersistence).catch((err) => {
  debugLogger.warn('[Firebase] Auth persistence config error:', err);
});

const USE_EMULATOR = (import.meta as { env?: { VITE_USE_EMULATOR?: string } }).env?.VITE_USE_EMULATOR === 'true';

if (USE_EMULATOR && window.location.hostname === 'localhost') {
  try {
    if (!(auth as { emulatorConfig?: unknown }).emulatorConfig) {
      debugLogger.log('[Firebase] Connecting to Auth emulator at localhost:9099');
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    if (!(db as { emulatorConfig?: unknown }).emulatorConfig) {
      debugLogger.log('[Firebase] Connecting to Firestore emulator at localhost:8080');
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  } catch (err) {
    debugLogger.warn('[Firebase] Emulator connection failed (expected if not running):', err);
  }
}
