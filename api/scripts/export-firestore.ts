/**
 * Export all Firestore collections + Firebase Auth users to data/firestore-export/
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { Firestore } from '@google-cloud/firestore';
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

  throw new Error('Firebase service account topilmadi. secrets/firebase-service-account.json yarating.');
}

function createFirestoreClient(
  projectId: string,
  databaseId: string,
  serviceAccount: Record<string, unknown>,
): Firestore {
  return new Firestore({
    projectId,
    databaseId,
    credentials: serviceAccount,
  });
}

async function listFirestoreDatabases(
  projectId: string,
  serviceAccount: Record<string, unknown>,
): Promise<string[]> {
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;
    const res = await client.request<{ databases?: Array<{ name: string }> }>({ url });
    return (res.data.databases ?? [])
      .map((db) => db.name?.split('/').pop())
      .filter((id): id is string => Boolean(id));
  } catch (err) {
    console.warn('Could not list Firestore databases:', err instanceof Error ? err.message : err);
    return [];
  }
}

async function probeDatabase(
  projectId: string,
  databaseId: string,
  serviceAccount: Record<string, unknown>,
): Promise<boolean> {
  try {
    const db = createFirestoreClient(projectId, databaseId, serviceAccount);
    await db.collection('profiles').limit(1).get();
    return true;
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    console.warn(`  Database "${databaseId}" unavailable (${code || 'error'})`);
    return false;
  }
}

async function resolveDatabaseId(
  projectId: string,
  serviceAccount: Record<string, unknown>,
  preferredId?: string,
): Promise<string> {
  const listed = await listFirestoreDatabases(projectId, serviceAccount);
  if (listed.length) {
    console.log('Available Firestore databases:', listed.join(', '));
  }

  const candidates = [
    ...new Set([
      preferredId?.trim(),
      ...listed,
      'ai-studio-4c1b1226-dd9d-4904-bc52-80793df46787',
      '(default)',
    ].filter((id): id is string => Boolean(id))),
  ];

  console.log('Trying databases:', candidates.join(', '));

  for (const databaseId of candidates) {
    console.log(`Probing "${databaseId}"...`);
    if (await probeDatabase(projectId, databaseId, serviceAccount)) {
      console.log(`Using Firestore database: ${databaseId}`);
      return databaseId;
    }
  }

  throw new Error(
    [
      'Firestore database ga ulanib bo\'lmadi.',
      `Project: ${projectId}`,
      listed.length ? `REST orqali topilgan: ${listed.join(', ')}` : 'Database ro\'yxati bo\'sh',
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

  const databaseId = await resolveDatabaseId(projectId, serviceAccount, preferredDatabaseId);
  const db = createFirestoreClient(projectId, databaseId, serviceAccount);

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
