#!/usr/bin/env node
/**
 * scripts/setRole.js
 *
 * Usage:
 *   node scripts/setRole.js /path/to/serviceAccountKey.json <uid> <role>
 *
 * Example:
 *   node scripts/setRole.js ./serviceAccountKey.json uXyZ12345 super_admin
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 5) {
  console.error('Usage: node scripts/setRole.js /path/to/serviceAccountKey.json <uid> <role>');
  process.exit(1);
}

const serviceAccountPath = process.argv[2];
const uid = process.argv[3];
const role = process.argv[4];

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setRole(targetUid, newRole) {
  const ref = db.collection('profiles').doc(targetUid);
  await ref.set(
    {
      role: newRole,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Updated role for ${targetUid} -> ${newRole}`);
}

setRole(uid, role)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error setting role:', err);
    process.exit(2);
  });
