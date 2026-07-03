const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const {authenticator} = require("otplib");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");

const ISSUER = "QulayIsh";
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const BACKUP_CODE_COUNT = 10;

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://qulay-ish.uz",
    "https://www.qulay-ish.uz",
  ],
  credentials: true,
};

authenticator.options = {window: 1};

function getEncryptionKey() {
  const keyHex = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new HttpsError(
        "failed-precondition",
        "TWO_FACTOR_ENCRYPTION_KEY must be a 64-character hex string.",
    );
  }
  return Buffer.from(keyHex, "hex");
}

function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptSecret(payload) {
  const [ivHex, authTagHex, encryptedHex] = String(payload).split(":");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function createBackupCodes() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let a = "";
    let b = "";
    for (let j = 0; j < 4; j++) {
      a += charset[crypto.randomInt(0, charset.length)];
      b += charset[crypto.randomInt(0, charset.length)];
    }
    codes.push(`${a}-${b}`);
  }
  return codes;
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map((code) => bcrypt.hash(code.replace(/\s/g, "").toUpperCase(), 10)));
}

function assertNotLocked(profile) {
  if (profile.twoFactorLockedUntil && Date.now() < profile.twoFactorLockedUntil) {
    throw new HttpsError(
        "resource-exhausted",
        "Juda ko'p xato urinish. 15 daqiqadan keyin qayta urinib ko'ring.",
    );
  }
}

async function recordFailedAttempt(profileRef, profile) {
  const attempts = (profile.twoFactorFailedAttempts || 0) + 1;
  const update = {twoFactorFailedAttempts: attempts, updatedAt: FieldValue.serverTimestamp()};
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    update.twoFactorLockedUntil = Date.now() + LOCKOUT_MS;
    update.twoFactorFailedAttempts = 0;
  }
  await profileRef.update(update);
}

async function clearFailedAttempts(profileRef) {
  await profileRef.update({
    twoFactorFailedAttempts: 0,
    twoFactorLockedUntil: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

exports.initiate2FASetup = onCall({maxInstances: 10, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");

  const uid = request.auth.uid;
  const db = getFirestore();
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "Profil topilmadi.");

  const profile = profileSnap.data();
  if (profile.twoFactorEnabled) {
    throw new HttpsError("already-exists", "Ikki bosqichli tasdiqlash allaqachon yoqilgan.");
  }

  const secret = authenticator.generateSecret();
  const email = profile.email || uid;
  const manualEntryKey = secret;
  const uri = authenticator.keyuri(email, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {width: 220, margin: 2});

  await profileRef.update({
    totpPendingSecretEncrypted: encryptSecret(secret),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {qrCodeDataUrl, manualEntryKey};
});

exports.confirm2FASetup = onCall({maxInstances: 10, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");

  const {code} = request.data || {};
  if (!code) throw new HttpsError("invalid-argument", "6 xonali kod talab qilinadi.");

  const uid = request.auth.uid;
  const db = getFirestore();
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "Profil topilmadi.");

  const profile = profileSnap.data();
  if (!profile.totpPendingSecretEncrypted) {
    throw new HttpsError("failed-precondition", "Avval 2FA sozlashni boshlang.");
  }

  const secret = decryptSecret(profile.totpPendingSecretEncrypted);
  const valid = authenticator.verify({token: String(code).trim(), secret});
  if (!valid) throw new HttpsError("invalid-argument", "Tasdiqlash kodi noto'g'ri.");

  const plainBackupCodes = createBackupCodes();
  const backupCodesHashed = await hashBackupCodes(plainBackupCodes);

  await profileRef.update({
    twoFactorEnabled: true,
    totpSecretEncrypted: profile.totpPendingSecretEncrypted,
    totpPendingSecretEncrypted: FieldValue.delete(),
    backupCodesHashed,
    twoFactorVerifiedAt: FieldValue.serverTimestamp(),
    twoFactorFailedAttempts: 0,
    twoFactorLockedUntil: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {backupCodes: plainBackupCodes};
});

exports.verify2FALogin = onCall({maxInstances: 20, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");

  const {code, backupCode} = request.data || {};
  if (!code && !backupCode) {
    throw new HttpsError("invalid-argument", "Kod yoki zaxira kod talab qilinadi.");
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const profileRef = db.collection("profiles").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new HttpsError("not-found", "Profil topilmadi.");
    const profile = snap.data();
    assertNotLocked(profile);

    if (!profile.twoFactorEnabled || !profile.totpSecretEncrypted) {
      throw new HttpsError("failed-precondition", "2FA yoqilmagan.");
    }

    let verified = false;

    if (code) {
      const secret = decryptSecret(profile.totpSecretEncrypted);
      verified = authenticator.verify({token: String(code).trim(), secret});
    }

    if (!verified && backupCode) {
      const normalized = String(backupCode).replace(/\s/g, "").toUpperCase();
      const hashedList = Array.isArray(profile.backupCodesHashed) ? profile.backupCodesHashed : [];
      for (let i = 0; i < hashedList.length; i++) {
        const match = await bcrypt.compare(normalized, hashedList[i]);
        if (match) {
          verified = true;
          const updated = hashedList.filter((_, idx) => idx !== i);
          tx.update(profileRef, {
            backupCodesHashed: updated,
            twoFactorVerifiedAt: FieldValue.serverTimestamp(),
            twoFactorFailedAttempts: 0,
            twoFactorLockedUntil: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          return;
        }
      }
    }

    if (!verified) {
      const attempts = (profile.twoFactorFailedAttempts || 0) + 1;
      const update = {
        twoFactorFailedAttempts: attempts,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        update.twoFactorLockedUntil = Date.now() + LOCKOUT_MS;
        update.twoFactorFailedAttempts = 0;
      }
      tx.update(profileRef, update);
      throw new HttpsError("invalid-argument", "Tasdiqlash kodi noto'g'ri.");
    }

    tx.update(profileRef, {
      twoFactorVerifiedAt: FieldValue.serverTimestamp(),
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  logger.info("2FA login verified", {uid});
  return {success: true, verifiedAt: Date.now()};
});

exports.disable2FA = onCall({maxInstances: 10, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");

  const {code, password} = request.data || {};
  const uid = request.auth.uid;
  const db = getFirestore();
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "Profil topilmadi.");

  const profile = profileSnap.data();
  if (!profile.twoFactorEnabled) throw new HttpsError("failed-precondition", "2FA yoqilmagan.");

  let authorized = false;
  if (code && profile.totpSecretEncrypted) {
    const secret = decryptSecret(profile.totpSecretEncrypted);
    authorized = authenticator.verify({token: String(code).trim(), secret});
  }

  if (!authorized && password) {
    const credRef = db.collection("private_credentials").doc(uid);
    const credSnap = await credRef.get();
    if (credSnap.exists && credSnap.data().passwordHash) {
      authorized = await bcrypt.compare(password, credSnap.data().passwordHash);
    }
  }

  if (!authorized) {
    throw new HttpsError("permission-denied", "Tasdiqlash uchun joriy kod yoki parol talab qilinadi.");
  }

  await profileRef.update({
    twoFactorEnabled: false,
    totpSecretEncrypted: FieldValue.delete(),
    totpPendingSecretEncrypted: FieldValue.delete(),
    backupCodesHashed: FieldValue.delete(),
    twoFactorVerifiedAt: FieldValue.delete(),
    twoFactorFailedAttempts: FieldValue.delete(),
    twoFactorLockedUntil: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {success: true};
});

exports.regenerateBackupCodes = onCall({maxInstances: 10, cors: corsOptions}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  const {code} = request.data || {};
  if (!code) throw new HttpsError("invalid-argument", "Joriy kod talab qilinadi.");

  const uid = request.auth.uid;
  const db = getFirestore();
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists || !profileSnap.data().twoFactorEnabled) {
    throw new HttpsError("failed-precondition", "2FA yoqilmagan.");
  }

  const profile = profileSnap.data();
  const secret = decryptSecret(profile.totpSecretEncrypted);
  const valid = authenticator.verify({token: String(code).trim(), secret});
  if (!valid) throw new HttpsError("invalid-argument", "Kod noto'g'ri.");

  const plainBackupCodes = createBackupCodes();
  const backupCodesHashed = await hashBackupCodes(plainBackupCodes);
  await profileRef.update({backupCodesHashed, updatedAt: FieldValue.serverTimestamp()});
  return {backupCodes: plainBackupCodes};
});
