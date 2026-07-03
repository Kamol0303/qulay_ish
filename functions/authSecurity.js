const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const bcrypt = require("bcryptjs");

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://qulay-ish.uz",
    "https://www.qulay-ish.uz",
  ],
  credentials: true,
};

function normalizePhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("998")) return `+${digits.slice(0, 12)}`;
  if (digits.length <= 9) return `+998${digits}`;
  return `+${digits.slice(0, 12)}`;
}

exports.verifyPasswordServerSide = onCall({maxInstances: 20, cors: corsOptions}, async (request) => {
  const {phoneNumber, password} = request.data || {};
  if (!phoneNumber || !password) {
    throw new HttpsError("invalid-argument", "Telefon va parol talab qilinadi.");
  }

  const db = getFirestore();
  const auth = getAuth();
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  const profileSnap = await db.collection("profiles")
      .where("phoneNumber", "==", normalizedPhone)
      .limit(1)
      .get();

  if (profileSnap.empty) {
    throw new HttpsError("not-found", "Telefon raqam topilmadi.");
  }

  const profileDoc = profileSnap.docs[0];
  const profile = profileDoc.data();
  const uid = profileDoc.id;

  const credSnap = await db.collection("private_credentials").doc(uid).get();
  const legacyHash = profile.passwordHash;
  const secureHash = credSnap.exists ? credSnap.data().passwordHash : null;
  const passwordHash = secureHash || legacyHash;

  if (!passwordHash) {
    throw new HttpsError("failed-precondition", "Parol bilan kirish sozlanmagan.");
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    throw new HttpsError("permission-denied", "Telefon yoki parol noto'g'ri.");
  }

  if (secureHash && legacyHash) {
    await profileDoc.ref.update({
      passwordHash: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const customToken = await auth.createCustomToken(uid, {
    role: profile.role || "worker",
  });

  await profileDoc.ref.update({
    lastActive: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {customToken, uid, email: profile.email};
});

exports.storePasswordCredentials = onCall({maxInstances: 10, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");

  const {password} = request.data || {};
  if (!password) throw new HttpsError("invalid-argument", "Parol talab qilinadi.");

  const uid = request.auth.uid;
  const db = getFirestore();
  const passwordHash = await bcrypt.hash(password, 10);

  await db.collection("private_credentials").doc(uid).set({
    uid,
    passwordHash,
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();
  if (profileSnap.exists && profileSnap.data().passwordHash) {
    await profileRef.update({
      passwordHash: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return {success: true};
});

exports.setSuperAdminClaim = onCall({maxInstances: 3, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const auth = getAuth();
  const callerSnap = await db.collection("profiles").doc(callerUid).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;

  const {targetUid} = request.data || {};
  const resolvedUid = targetUid || callerUid;

  if (targetUid && targetUid !== callerUid && callerRole !== "super_admin") {
    throw new HttpsError("permission-denied", "Faqat Super Admin claim o'rnatishi mumkin.");
  }

  const targetSnap = await db.collection("profiles").doc(resolvedUid).get();
  if (!targetSnap.exists || targetSnap.data().role !== "super_admin") {
    throw new HttpsError("failed-precondition", "Foydalanuvchi super_admin emas.");
  }

  await auth.setCustomUserClaims(resolvedUid, {role: "super_admin"});
  logger.info("Super admin claim set", {uid: resolvedUid, by: callerUid});
  return {success: true, uid: resolvedUid};
});
