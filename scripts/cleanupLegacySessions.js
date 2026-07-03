/**
 * One-time cleanup for deprecated session collections.
 * Usage: node scripts/cleanupLegacySessions.js
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin default credentials.
 */
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`[cleanup] ${collectionName}: nothing to delete`);
    return 0;
  }

  let deleted = 0;
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    deleted++;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
  console.log(`[cleanup] ${collectionName}: deleted ${deleted} documents`);
  return deleted;
}

async function main() {
  await deleteCollection("otp_sessions");
  await deleteCollection("totp_sessions");
  console.log("[cleanup] done");
}

main().catch((error) => {
  console.error("[cleanup] failed", error);
  process.exit(1);
});
