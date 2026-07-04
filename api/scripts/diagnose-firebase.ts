/**
 * Firebase ulanish diagnostikasi — export ishlamasa avval buni ishga tushiring.
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import type { ServiceAccount } from 'firebase-admin/app';

config({ path: path.resolve(__dirname, '../../.env') });
config({ path: path.resolve(__dirname, '../.env') });

const ROOT_DIR = path.resolve(__dirname, '../..');

function loadServiceAccount(): Record<string, unknown> {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        : path.resolve(ROOT_DIR, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : null,
    path.resolve(ROOT_DIR, 'secrets/firebase-service-account.json'),
  ].filter((p): p is string => Boolean(p));

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    }
  }
  throw new Error('secrets/firebase-service-account.json topilmadi');
}

async function listDatabasesRest(projectId: string, credentials: Record<string, unknown>) {
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;
  const res = await client.request<{ databases?: Array<{ name: string; type?: string; locationId?: string }> }>({
    url,
  });
  return res.data.databases ?? [];
}

async function main() {
  const serviceAccount = loadServiceAccount();
  const saProjectId = String(serviceAccount.project_id ?? '');
  const envProjectId =
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || saProjectId;
  const envDatabaseId =
    process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || '(not set)';

  console.log('=== Firebase diagnostika ===\n');
  console.log('Service account email:', serviceAccount.client_email);
  console.log('Service account project_id:', saProjectId);
  console.log('.env FIREBASE_PROJECT_ID:', envProjectId);
  console.log('.env FIRESTORE_DATABASE_ID:', envDatabaseId);

  if (saProjectId && envProjectId && saProjectId !== envProjectId) {
    console.warn('\n⚠️  project_id mos kelmaydi! Service account boshqa loyihaga tegishli bo\'lishi mumkin.');
  }

  const admin = await import('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
      projectId: envProjectId,
    });
  }

  console.log('\n--- Firebase Auth ---');
  try {
    const authResult = await admin.auth().listUsers(5);
    console.log(`✅ Auth ishlayapti. Foydalanuvchilar: kamida ${authResult.users.length} (max 5 ko\'rsatildi)`);
    for (const u of authResult.users) {
      console.log(`   - ${u.uid} | ${u.email ?? u.phoneNumber ?? 'no contact'}`);
    }
  } catch (err) {
    console.error('❌ Auth xato:', err instanceof Error ? err.message : err);
  }

  console.log('\n--- Firestore REST: database ro\'yxati ---');
  try {
    const databases = await listDatabasesRest(envProjectId, serviceAccount);
    if (!databases.length) {
      console.error('❌ Hech qanday Firestore database yo\'q!');
      console.error('   Firebase Console → Firestore Database → Create database');
      console.error('   Yoki ma\'lumotlar boshqa joyda (demo mode / boshqa project).');
    } else {
      console.log(`✅ Topilgan databaselar (${databases.length}):`);
      for (const db of databases) {
        const id = db.name?.split('/').pop() ?? db.name;
        console.log(`   - ${id} (${db.type ?? 'unknown'}, ${db.locationId ?? 'unknown region'})`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Firestore REST xato:', msg);
    if (msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
      console.error('   Service account ga "Cloud Datastore User" yoki "Firebase Admin" roli kerak.');
    }
    if (msg.includes('SERVICE_DISABLED') || msg.includes('403')) {
      console.error('   GCP da "Cloud Firestore API" yoqilmagan bo\'lishi mumkin.');
    }
  }

  console.log('\n--- Firestore @google-cloud/firestore probe ---');
  const { Firestore } = await import('@google-cloud/firestore');
  const probeIds = [
    ...(await listDatabasesRest(envProjectId, serviceAccount)).map((d) => d.name?.split('/').pop() ?? ''),
    'ai-studio-4c1b1226-dd9d-4904-bc52-80793df46787',
    '(default)',
  ].filter((id, i, arr) => Boolean(id) && arr.indexOf(id) === i);

  for (const dbId of probeIds) {
    try {
      const db = new Firestore({
        projectId: envProjectId,
        databaseId: dbId,
        credentials: serviceAccount,
      });
      const snap = await db.collection('profiles').limit(1).get();
      console.log(`✅ "${dbId}" ishlayapti (profiles sample: ${snap.size})`);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: unknown }).code : '';
      console.log(`❌ "${dbId}": ${code || (err instanceof Error ? err.message : err)}`);
    }
  }

  console.log('\n--- Firestore Admin SDK probe (eski usul) ---');
  const { getFirestore } = await import('firebase-admin/firestore');
  for (const dbId of probeIds.slice(0, 2)) {
    try {
      const db = dbId === '(default)' ? getFirestore() : getFirestore(undefined, dbId);
      const snap = await db.collection('profiles').limit(1).get();
      console.log(`✅ admin SDK "${dbId}": ${snap.size}`);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: unknown }).code : '';
      console.log(`❌ admin SDK "${dbId}": ${code}`);
    }
  }

  console.log('\n=== Tavsiya ===');
  console.log('1. Yuqorida database ro\'yxati bo\'lsa — shu ID ni api/.env ga yozing');
  console.log('2. Ro\'yxat bo\'sh bo\'lsa — Firestore yaratilmagan; Console dan yarating yoki demo seed ishlating');
  console.log('3. Auth ishlaydi, Firestore yo\'q — ma\'lumotlar faqat Auth da, Firestore bo\'sh');
}

main().catch((err) => {
  console.error('Diagnostika xato:', err instanceof Error ? err.message : err);
  process.exit(1);
});
