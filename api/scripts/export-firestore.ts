/**
 * Export all Firestore collections + Firebase Auth users to data/firestore-export/
 *
 * Requires:
 *   FIREBASE_SERVICE_ACCOUNT — full JSON string (GitHub/Cursor secret)
 *   FIREBASE_PROJECT_ID
 *   FIRESTORE_DATABASE_ID
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import type { ServiceAccount } from 'firebase-admin/app';

config({ path: path.resolve(__dirname, '../../.env') });
config({ path: path.resolve(__dirname, '../.env') });

const ROOT_DIR = path.resolve(__dirname, '../..');
const EXPORT_DIR = path.resolve(ROOT_DIR, 'data/firestore-export');

const DEFAULT_SERVICE_ACCOUNT_PATHS = [
  'secrets/firebase-service-account.json',
  'firebase-service-account.json',
  'secrets/gen-lang-client-firebase-adminsdk.json',
] as const;

const COLLECTIONS = [
  'profiles',
  'jobs',
  'applications',
  'contracts',
  'service_posts',
  'chat_messages',
  'notifications',
  'disputes',
  'verification_requests',
  'reviews',
  'savedJobs',
  'payments',
  'violations',
  'activity_logs',
  'system_logs',
] as const;

function resolveServiceAccountPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);
}

function loadServiceAccount(): Record<string, unknown> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    return JSON.parse(json) as Record<string, unknown>;
  }

  const candidates: string[] = [];
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    candidates.push(resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  }
  for (const relativePath of DEFAULT_SERVICE_ACCOUNT_PATHS) {
    candidates.push(path.resolve(ROOT_DIR, relativePath));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`Using service account: ${candidate}`);
      return JSON.parse(fs.readFileSync(candidate, 'utf8')) as Record<string, unknown>;
    }
  }

  const checked = [...new Set(candidates)].map((p) => `  - ${p}`).join('\n');
  throw new Error(
    [
      'Firebase service account topilmadi.',
      '',
      '1-variant (tavsiya): JSON fayl yarating:',
      `   mkdir -p ${path.join(ROOT_DIR, 'secrets')}`,
      `   # Firebase Console → Project Settings → Service accounts → Generate new private key`,
      `   # Faylni shu joyga saqlang: ${path.join(ROOT_DIR, 'secrets/firebase-service-account.json')}`,
      '',
      '2-variant: root .env yoki api/.env ga qo\'shing:',
      '   FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json',
      '',
      '3-variant: to\'liq JSON string:',
      '   FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}',
      '',
      'Tekshirilgan yo\'llar:',
      checked,
    ].join('\n')
  );
}

async function listFirestoreDatabases(
  projectId: string,
  serviceAccount: Record<string, unknown>,
): Promise<string[]> {
  try {
    const { v1 } = await import('@google-cloud/firestore');
    const client = new v1.FirestoreAdminClient({
      credentials: serviceAccount,
      projectId,
    });
    const [databases] = await client.listDatabases({ parent: `projects/${projectId}` });
    return databases
      .map((db) => db.name?.split('/').pop())
      .filter((id): id is string => Boolean(id));
  } catch (err) {
    console.warn('Could not list Firestore databases:', err instanceof Error ? err.message : err);
    return [];
  }
}

async function probeDatabase(
  getFirestore: typeof import('firebase-admin/firestore').getFirestore,
  databaseId: string,
): Promise<boolean> {
  try {
    const db = databaseId === '(default)' ? getFirestore() : getFirestore(undefined, databaseId);
    await db.collection('profiles').limit(1).get();
    return true;
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    console.warn(`  Database "${databaseId}" unavailable (${code || 'error'})`);
    return false;
  }
}

async function resolveDatabaseId(
  getFirestore: typeof import('firebase-admin/firestore').getFirestore,
  projectId: string,
  serviceAccount: Record<string, unknown>,
  preferredId?: string,
): Promise<string> {
  const fromEnv = preferredId?.trim();
  const knownIds = [
    fromEnv,
    'ai-studio-4c1b1226-dd9d-4904-bc52-80793f46787',
    '(default)',
  ].filter((id): id is string => Boolean(id));

  const listed = await listFirestoreDatabases(projectId, serviceAccount);
  if (listed.length) {
    console.log('Available Firestore databases:', listed.join(', '));
  }

  const candidates = [...new Set([...knownIds, ...listed])];
  console.log('Trying databases:', candidates.join(', '));

  for (const databaseId of candidates) {
    console.log(`Probing "${databaseId}"...`);
    if (await probeDatabase(getFirestore, databaseId)) {
      console.log(`Using Firestore database: ${databaseId}`);
      return databaseId;
    }
  }

  throw new Error(
    [
      'Firestore database topilmadi (NOT_FOUND).',
      '',
      `Project: ${projectId}`,
      fromEnv ? `So\'ralgan database: ${fromEnv}` : 'FIRESTORE_DATABASE_ID .env da ko\'rsatilmagan',
      listed.length ? `Mavjud databaselar: ${listed.join(', ')}` : 'Database ro\'yxati olinmadi — Firebase Console → Firestore → Database ID ni tekshiring',
      '',
      'api/.env ga to\'g\'ri ID qo\'ying, masalan:',
      'FIRESTORE_DATABASE_ID=(default)',
      'yoki',
      'FIRESTORE_DATABASE_ID=ai-studio-4c1b1226-dd9d-4904-bc52-80793f46787',
    ].join('\n')
  );
}

async function main() {
  const admin = await import('firebase-admin');
  const serviceAccount = loadServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    String(serviceAccount.project_id || '');
  const preferredDatabaseId =
    process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID yoki service account project_id kerak');
  }

  console.log(`Firebase project: ${projectId}`);
  if (preferredDatabaseId) {
    console.log(`Requested database: ${preferredDatabaseId}`);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
      projectId,
    });
  }

  const { getFirestore } = await import('firebase-admin/firestore');
  const databaseId = await resolveDatabaseId(getFirestore, projectId, serviceAccount, preferredDatabaseId);
  const db = databaseId === '(default)' ? getFirestore() : getFirestore(undefined, databaseId);

  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const report: Record<string, number> = {};

  for (const collectionName of COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    fs.writeFileSync(
      path.join(EXPORT_DIR, `${collectionName}.json`),
      JSON.stringify({ collection: collectionName, count: documents.length, documents }, null, 2)
    );
    report[collectionName] = documents.length;
    console.log(`Exported ${collectionName}: ${documents.length}`);
  }

  // Single-document collections
  for (const [col, docId] of [
    ['settings', 'global_config'],
    ['system_stats', 'revenue'],
  ] as const) {
    const snap = await db.collection(col).doc(docId).get();
    const dir = path.join(EXPORT_DIR, col);
    fs.mkdirSync(dir, { recursive: true });
    if (snap.exists) {
      fs.writeFileSync(
        path.join(dir, `${docId}.json`),
        JSON.stringify({ id: docId, data: snap.data() }, null, 2)
      );
      report[`${col}/${docId}`] = 1;
    } else {
      report[`${col}/${docId}`] = 0;
    }
  }

  // Firebase Auth users
  const authUsers: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const user of result.users) {
      authUsers.push({
        uid: user.uid,
        email: user.email ?? null,
        phoneNumber: user.phoneNumber ?? null,
        displayName: user.displayName ?? null,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  fs.writeFileSync(
    path.join(EXPORT_DIR, 'auth_users.json'),
    JSON.stringify({ count: authUsers.length, users: authUsers }, null, 2)
  );
  report.auth_users = authUsers.length;

  fs.writeFileSync(
    path.join(EXPORT_DIR, '_report.json'),
    JSON.stringify({ exportedAt: new Date().toISOString(), projectId, databaseId, report }, null, 2)
  );

  console.log('\nExport complete:', report);
}

main().catch((err) => {
  console.error('Export failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
