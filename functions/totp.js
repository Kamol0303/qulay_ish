const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const {authenticator} = require("otplib");
const QRCode = require("qrcode");

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

const TOTP_ISSUER = "Qulay Ish";
const TOTP_ACCOUNT_NAME = "Qulay Ish";
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
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
  const keyHex = process.env.TOTP_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new HttpsError(
        "failed-precondition",
        "TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
    );
  }
  return Buffer.from(keyHex, "hex");
}

function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decryptSecret(payload) {
  const [ivHex, authTagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new HttpsError("internal", "Invalid encrypted secret format.");
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function createSessionId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function createPlainBackupCodes() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let part1 = "";
    let part2 = "";
    for (let j = 0; j < 4; j++) {
      part1 += charset[crypto.randomInt(0, charset.length)];
      part2 += charset[crypto.randomInt(0, charset.length)];
    }
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

function hashBackupCode(code) {
  return crypto
      .createHash("sha256")
      .update(code.replace(/\s/g, "").toUpperCase())
      .digest("hex");
}

function buildOtpauthUri(secret, accountLabel) {
  const label = encodeURIComponent(`${TOTP_ACCOUNT_NAME}:${accountLabel}`);
  const issuer = encodeURIComponent(TOTP_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function isTwoFactorEnabled(profile) {
  return !!(profile?.twoFactorEnabled || profile?.totpEnabled);
}

function assertSessionActive(sessionSnap) {
  if (!sessionSnap.exists) {
    throw new HttpsError("not-found", "TOTP sessiyasi topilmadi.");
  }
  const sessionData = sessionSnap.data();
  if (Date.now() > sessionData.expiryTime) {
    throw new HttpsError("deadline-exceeded", "TOTP sessiyasi muddati tugagan.");
  }
  if (sessionData.attempts >= MAX_ATTEMPTS) {
    throw new HttpsError(
        "resource-exhausted",
        "Juda ko'p xato urinish. Qayta urinib ko'ring.",
    );
  }
  return sessionData;
}

async function verifyTotpToken(code, encryptedSecret) {
  const secret = decryptSecret(encryptedSecret);
  const isValid = authenticator.verify({token: String(code).trim(), secret});
  if (!isValid) {
    throw new HttpsError("invalid-argument", "Tasdiqlash kodi noto'g'ri.");
  }
}

async function generateQrDataUrl(otpauthUri) {
  return QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 2,
    color: {dark: "#1e3a8a", light: "#ffffff"},
  });
}

/**
 * Start 2FA enrollment for authenticated user (optional layer).
 */
exports.generateSecret = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const uid = request.auth.uid;
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists) {
    throw new HttpsError("not-found", "Profil topilmadi.");
  }

  const profile = profileSnap.data();
  if (isTwoFactorEnabled(profile)) {
    throw new HttpsError("already-exists", "Ikki bosqichli autentifikatsiya allaqachon yoqilgan.");
  }

  const secret = authenticator.generateSecret();
  const secretEncrypted = encryptSecret(secret);
  const backupCodes = createPlainBackupCodes();
  const backupCodesHashed = backupCodes.map(hashBackupCode);
  const sessionId = createSessionId("totp_enroll");
  const accountLabel = profile.phoneNumber || profile.email || uid;

  await db.collection("totp_sessions").doc(sessionId).set({
    sessionId,
    purpose: "enrollment",
    uid,
    secretEncrypted,
    backupCodesHashed,
    verified: false,
    attempts: 0,
    expiryTime: Date.now() + SESSION_TTL_MS,
    createdAt: FieldValue.serverTimestamp(),
  });

  const otpauthUri = buildOtpauthUri(secret, accountLabel);
  const qrCodeDataUrl = await generateQrDataUrl(otpauthUri);

  logger.info("2FA enrollment secret generated", {uid, sessionId});

  return {
    success: true,
    sessionId,
    otpauthUri,
    qrCodeDataUrl,
    backupCodes,
  };
});

/**
 * Confirm 2FA enrollment with first valid TOTP code.
 */
exports.verifyTOTP = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const {sessionId, code} = request.data || {};
  if (!sessionId || !code) {
    throw new HttpsError(
        "invalid-argument",
        "Sessiya ID va tasdiqlash kodi talab qilinadi.",
    );
  }

  const uid = request.auth.uid;
  const sessionRef = db.collection("totp_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  const sessionData = assertSessionActive(sessionSnap);

  if (sessionData.purpose !== "enrollment" || sessionData.uid !== uid) {
    throw new HttpsError("permission-denied", "Noto'g'ri enrollment sessiyasi.");
  }

  try {
    await verifyTotpToken(code, sessionData.secretEncrypted);
  } catch (error) {
    if (error instanceof HttpsError && error.code === "invalid-argument") {
      await sessionRef.update({attempts: (sessionData.attempts || 0) + 1});
    }
    throw error;
  }

  await db.collection("profiles").doc(uid).update({
    twoFactorEnabled: true,
    totpEnabled: true,
    totpSecretEncrypted: sessionData.secretEncrypted,
    totpVerifiedAt: FieldValue.serverTimestamp(),
    backupCodes: sessionData.backupCodesHashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await sessionRef.update({
    verified: true,
    completed: true,
    completedAt: FieldValue.serverTimestamp(),
  });

  logger.info("2FA enrollment completed", {uid});

  return {success: true, uid};
});

/**
 * Verify 2FA code after first-factor login (user already authenticated).
 */
exports.verifyTwoFactor = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const {code} = request.data || {};
  if (!code) {
    throw new HttpsError("invalid-argument", "Tasdiqlash kodi talab qilinadi.");
  }

  const uid = request.auth.uid;
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists) {
    throw new HttpsError("not-found", "Profil topilmadi.");
  }

  const profile = profileSnap.data();
  if (!isTwoFactorEnabled(profile) || !profile.totpSecretEncrypted) {
    throw new HttpsError("failed-precondition", "2FA yoqilmagan.");
  }

  const sessionId = createSessionId("totp_2fa");
  const sessionRef = db.collection("totp_sessions").doc(sessionId);
  await sessionRef.set({
    sessionId,
    purpose: "login_challenge",
    uid,
    verified: false,
    attempts: 0,
    expiryTime: Date.now() + SESSION_TTL_MS,
    createdAt: FieldValue.serverTimestamp(),
  });

  const sessionSnap = await sessionRef.get();
  const sessionData = sessionSnap.data();

  try {
    await verifyTotpToken(code, profile.totpSecretEncrypted);
  } catch (error) {
    if (error instanceof HttpsError && error.code === "invalid-argument") {
      await sessionRef.update({attempts: (sessionData.attempts || 0) + 1});
    }
    throw error;
  }

  await profileRef.update({
    lastActive: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await sessionRef.update({
    verified: true,
    completed: true,
    completedAt: FieldValue.serverTimestamp(),
  });

  return {success: true, uid, verifiedAt: Date.now()};
});

/**
 * Regenerate backup codes for authenticated 2FA user.
 */
exports.generateBackupCodes = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const uid = request.auth.uid;
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists || !isTwoFactorEnabled(profileSnap.data())) {
    throw new HttpsError("failed-precondition", "2FA yoqilmagan.");
  }

  const backupCodes = createPlainBackupCodes();
  const backupCodesHashed = backupCodes.map(hashBackupCode);

  await profileRef.update({
    backupCodes: backupCodesHashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {success: true, backupCodes};
});

/**
 * Use one-time backup code during 2FA challenge (user already authenticated).
 */
exports.useBackupCode = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const {backupCode} = request.data || {};
  if (!backupCode) {
    throw new HttpsError("invalid-argument", "Zaxira kod talab qilinadi.");
  }

  const uid = request.auth.uid;
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists) {
    throw new HttpsError("not-found", "Profil topilmadi.");
  }

  const profile = profileSnap.data();
  if (!isTwoFactorEnabled(profile)) {
    throw new HttpsError("failed-precondition", "2FA yoqilmagan.");
  }

  const hashedInput = hashBackupCode(String(backupCode));
  const storedCodes = Array.isArray(profile.backupCodes) ? profile.backupCodes : [];
  const matchIndex = storedCodes.indexOf(hashedInput);

  if (matchIndex === -1) {
    throw new HttpsError("invalid-argument", "Zaxira kod noto'g'ri yoki ishlatilgan.");
  }

  const updatedCodes = storedCodes.filter((_, index) => index !== matchIndex);

  await profileRef.update({
    backupCodes: updatedCodes,
    updatedAt: FieldValue.serverTimestamp(),
    lastActive: FieldValue.serverTimestamp(),
  });

  logger.info("Backup code used for 2FA", {uid, remainingCodes: updatedCodes.length});

  return {
    success: true,
    uid,
    verifiedAt: Date.now(),
    remainingBackupCodes: updatedCodes.length,
  };
});

/**
 * Disable 2FA (self or admin with verification).
 */
exports.disableTOTP = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const {targetUid, adminVerified, code} = request.data || {};
  const callerUid = request.auth.uid;
  const callerSnap = await db.collection("profiles").doc(callerUid).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;
  const isAdmin = callerRole === "admin" || callerRole === "super_admin";
  const resolvedUid = targetUid && isAdmin ? targetUid : callerUid;

  if (targetUid && targetUid !== callerUid && !isAdmin) {
    throw new HttpsError("permission-denied", "Ruxsat yo'q.");
  }

  if (targetUid && targetUid !== callerUid && !adminVerified) {
    throw new HttpsError(
        "failed-precondition",
        "Administrator tasdiqlashi talab qilinadi.",
    );
  }

  const targetRef = db.collection("profiles").doc(resolvedUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Foydalanuvchi topilmadi.");
  }

  const targetProfile = targetSnap.data();
  if (resolvedUid === callerUid && isTwoFactorEnabled(targetProfile)) {
    if (!code) {
      throw new HttpsError("invalid-argument", "2FA o'chirish uchun joriy kod talab qilinadi.");
    }
    await verifyTotpToken(code, targetProfile.totpSecretEncrypted);
  }

  await targetRef.update({
    twoFactorEnabled: false,
    totpEnabled: false,
    totpSecretEncrypted: FieldValue.delete(),
    totpVerifiedAt: FieldValue.delete(),
    backupCodes: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info("2FA disabled", {uid: resolvedUid, by: callerUid});
  return {success: true, uid: resolvedUid};
});

/**
 * Rotate TOTP secret after verifying current code.
 */
exports.rotateSecret = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const {code} = request.data || {};
  if (!code) {
    throw new HttpsError("invalid-argument", "Joriy TOTP kodi talab qilinadi.");
  }

  const uid = request.auth.uid;
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists || !isTwoFactorEnabled(profileSnap.data())) {
    throw new HttpsError("failed-precondition", "2FA yoqilmagan.");
  }

  const profile = profileSnap.data();
  await verifyTotpToken(code, profile.totpSecretEncrypted);

  const newSecret = authenticator.generateSecret();
  const newSecretEncrypted = encryptSecret(newSecret);
  const backupCodes = createPlainBackupCodes();
  const backupCodesHashed = backupCodes.map(hashBackupCode);
  const accountLabel = profile.phoneNumber || profile.email || uid;
  const otpauthUri = buildOtpauthUri(newSecret, accountLabel);
  const qrCodeDataUrl = await generateQrDataUrl(otpauthUri);

  await profileRef.update({
    totpSecretEncrypted: newSecretEncrypted,
    totpVerifiedAt: FieldValue.serverTimestamp(),
    backupCodes: backupCodesHashed,
    twoFactorEnabled: true,
    totpEnabled: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {success: true, otpauthUri, qrCodeDataUrl, backupCodes};
});
