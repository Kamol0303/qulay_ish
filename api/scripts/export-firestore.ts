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

const EXPORT_DIR = path.resolve(__dirname, '../../data/firestore-export');

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

function loadServiceAccount(): Record<string, unknown> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    return JSON.parse(json) as Record<string, unknown>;
  }
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  }
  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT (JSON string) or FIREBASE_SERVICE_ACCOUNT_PATH is required for export.'
  );
}

async function main() {
  const admin = await import('firebase-admin');
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID;

  if (!projectId || !databaseId) {
    throw new Error('FIREBASE_PROJECT_ID and FIRESTORE_DATABASE_ID must be set in .env');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount() as ServiceAccount),
      projectId,
    });
  }

  const { getFirestore } = await import('firebase-admin/firestore');
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
  console.error('Export failed:', err.message);
  process.exit(1);
});
