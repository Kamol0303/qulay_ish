const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const {authenticator} = require("otplib");
const bcrypt = require("bcryptjs");

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

authenticator.options = {
  window: 1,
};

/**
 * @return {Buffer}
 */
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

/**
 * @param {string} plaintext
 * @return {string}
 */
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

/**
 * @param {string} payload
 * @return {string}
 */
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

/**
 * @param {string} phone
 * @return {string}
 */
function normalizePhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("998")) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.length <= 9) {
    return `+998${digits}`;
  }
  return `+${digits.slice(0, 12)}`;
}

/**
 * @return {string}
 */
function createSessionId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * @return {string[]}
 */
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

/**
 * @param {string} code
 * @return {string}
 */
function hashBackupCode(code) {
  return crypto
      .createHash("sha256")
      .update(code.replace(/\s/g, "").toUpperCase())
      .digest("hex");
}

/**
 * @param {string} secret
 * @param {string} accountLabel
 * @return {string}
 */
function buildOtpauthUri(secret, accountLabel) {
  const label = encodeURIComponent(`${TOTP_ACCOUNT_NAME}:${accountLabel}`);
  const issuer = encodeURIComponent(TOTP_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * @param {FirebaseFirestore.DocumentSnapshot} sessionSnap
 */
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

/**
 * @param {FirebaseFirestore.DocumentReference} sessionRef
 * @param {Record<string, unknown>} sessionData
 * @param {string} code
 * @param {string} encryptedSecret
 */
async function verifyTotpCode(sessionRef, sessionData, code, encryptedSecret) {
  const secret = decryptSecret(encryptedSecret);
  const isValid = authenticator.verify({token: code, secret});

  if (!isValid) {
    await sessionRef.update({attempts: (sessionData.attempts || 0) + 1});
    throw new HttpsError("invalid-argument", "Tasdiqlash kodi noto'g'ri.");
  }
}

/**
 * Generate TOTP secret for registration and return QR URI + backup codes.
 */
exports.generateSecret = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {
    phoneNumber,
    password,
    fullName,
    role,
    email,
  } = request.data || {};

  if (!phoneNumber || !password || !fullName || !role) {
    throw new HttpsError(
        "invalid-argument",
        "Telefon, parol, ism va rol talab qilinadi.",
    );
  }

  if (!["worker", "employer"].includes(role)) {
    throw new HttpsError("invalid-argument", "Rol noto'g'ri.");
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const phoneDigits = normalizedPhone.replace(/\D/g, "");
  const syntheticEmail = email?.trim() ||
    `${phoneDigits}@qulayish.local`;

  const existingPhone = await db.collection("profiles")
      .where("phoneNumber", "==", normalizedPhone)
      .limit(1)
      .get();

  if (!existingPhone.empty) {
    throw new HttpsError(
        "already-exists",
        "Bu telefon raqam allaqachon ro'yxatdan o'tgan.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const secret = authenticator.generateSecret();
  const secretEncrypted = encryptSecret(secret);
  const backupCodes = createPlainBackupCodes();
  const backupCodesHashed = backupCodes.map(hashBackupCode);
  const sessionId = createSessionId("totp_reg");

  await db.collection("totp_sessions").doc(sessionId).set({
    sessionId,
    purpose: "registration",
    phoneNumber: normalizedPhone,
    email: syntheticEmail,
    fullName: String(fullName).trim(),
    role,
    passwordHash,
    secretEncrypted,
    backupCodesHashed,
    verified: false,
    attempts: 0,
    expiryTime: Date.now() + SESSION_TTL_MS,
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info("TOTP registration secret generated", {sessionId});

  return {
    success: true,
    sessionId,
    otpauthUri: buildOtpauthUri(secret, normalizedPhone),
    backupCodes,
  };
});

/**
 * Verify TOTP during registration and create the user account.
 */
exports.verifyTOTP = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {sessionId, code} = request.data || {};

  if (!sessionId || !code) {
    throw new HttpsError(
        "invalid-argument",
        "Sessiya ID va tasdiqlash kodi talab qilinadi.",
    );
  }

  const sessionRef = db.collection("totp_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  const sessionData = assertSessionActive(sessionSnap);

  if (sessionData.purpose !== "registration") {
    throw new HttpsError("failed-precondition", "Noto'g'ri TOTP sessiya turi.");
  }

  if (sessionData.verified) {
    throw new HttpsError("already-exists", "TOTP allaqachon tasdiqlangan.");
  }

  await verifyTotpCode(
      sessionRef,
      sessionData,
      String(code).trim(),
      sessionData.secretEncrypted,
  );

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: sessionData.email,
      password: crypto.randomBytes(24).toString("hex"),
      displayName: sessionData.fullName,
    });
  } catch (error) {
    logger.error("Failed to create Firebase user during TOTP registration", error);
    throw new HttpsError("internal", "Foydalanuvchi yaratishda xatolik yuz berdi.");
  }

  const profileRef = db.collection("profiles").doc(userRecord.uid);
  await profileRef.set({
    uid: userRecord.uid,
    fullName: sessionData.fullName,
    email: sessionData.email,
    phoneNumber: sessionData.phoneNumber,
    passwordHash: sessionData.passwordHash,
    role: sessionData.role,
    region: "Samarqand",
    district: "",
    neighborhood: "",
    bio: "",
    skills: [],
    isVerified: true,
    verificationStatus: "verified",
    status: "active",
    authMethod: "totp",
    totpEnabled: true,
    totpSecretEncrypted: sessionData.secretEncrypted,
    totpVerifiedAt: FieldValue.serverTimestamp(),
    backupCodes: sessionData.backupCodesHashed,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastActive: FieldValue.serverTimestamp(),
  });

  await sessionRef.update({
    verified: true,
    completed: true,
    uid: userRecord.uid,
    completedAt: FieldValue.serverTimestamp(),
  });

  const customToken = await auth.createCustomToken(userRecord.uid);

  logger.info("TOTP registration completed", {uid: userRecord.uid});

  return {
    success: true,
    uid: userRecord.uid,
    customToken,
  };
});

/**
 * Initiate login with phone + password, returning a TOTP session.
 */
exports.initiateTOTPLogin = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {phoneNumber, password} = request.data || {};

  if (!phoneNumber || !password) {
    throw new HttpsError(
        "invalid-argument",
        "Telefon va parol talab qilinadi.",
    );
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const profileSnap = await db.collection("profiles")
      .where("phoneNumber", "==", normalizedPhone)
      .limit(1)
      .get();

  if (profileSnap.empty) {
    throw new HttpsError("not-found", "Telefon raqam topilmadi.");
  }

  const profile = profileSnap.docs[0].data();
  const uid = profileSnap.docs[0].id;

  if (!profile.totpEnabled || !profile.totpSecretEncrypted) {
    throw new HttpsError(
        "failed-precondition",
        "Bu hisob uchun Google Authenticator sozlanmagan. Administrator bilan bog'laning.",
    );
  }

  if (!profile.passwordHash) {
    throw new HttpsError(
        "failed-precondition",
        "Bu hisob parol bilan himoyalanmagan. Administrator bilan bog'laning.",
    );
  }

  const passwordValid = await bcrypt.compare(password, profile.passwordHash);
  if (!passwordValid) {
    throw new HttpsError("permission-denied", "Telefon yoki parol noto'g'ri.");
  }

  const sessionId = createSessionId("totp_login");
  await db.collection("totp_sessions").doc(sessionId).set({
    sessionId,
    purpose: "login",
    uid,
    phoneNumber: normalizedPhone,
    verified: false,
    attempts: 0,
    expiryTime: Date.now() + SESSION_TTL_MS,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    sessionId,
  };
});

/**
 * Complete login after TOTP verification.
 */
exports.completeTOTPLogin = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {sessionId, code} = request.data || {};

  if (!sessionId || !code) {
    throw new HttpsError(
        "invalid-argument",
        "Sessiya ID va tasdiqlash kodi talab qilinadi.",
    );
  }

  const sessionRef = db.collection("totp_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  const sessionData = assertSessionActive(sessionSnap);

  if (sessionData.purpose !== "login") {
    throw new HttpsError("failed-precondition", "Noto'g'ri TOTP sessiya turi.");
  }

  const profileRef = db.collection("profiles").doc(sessionData.uid);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists) {
    throw new HttpsError("not-found", "Foydalanuvchi profili topilmadi.");
  }

  const profile = profileSnap.data();
  await verifyTotpCode(
      sessionRef,
      sessionData,
      String(code).trim(),
      profile.totpSecretEncrypted,
  );

  const customToken = await auth.createCustomToken(sessionData.uid);

  await profileRef.update({
    lastActive: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await sessionRef.update({
    verified: true,
    completed: true,
    completedAt: FieldValue.serverTimestamp(),
  });

  logger.info("TOTP login completed", {uid: sessionData.uid});

  return {
    success: true,
    customToken,
    uid: sessionData.uid,
  };
});

/**
 * Generate new backup codes for the authenticated user.
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

  if (!profileSnap.exists || !profileSnap.data().totpEnabled) {
    throw new HttpsError("failed-precondition", "TOTP yoqilmagan.");
  }

  const backupCodes = createPlainBackupCodes();
  const backupCodesHashed = backupCodes.map(hashBackupCode);

  await profileRef.update({
    backupCodes: backupCodesHashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    backupCodes,
  };
});

/**
 * Use a one-time backup code for login recovery.
 */
exports.useBackupCode = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {phoneNumber, password, backupCode} = request.data || {};

  if (!phoneNumber || !password || !backupCode) {
    throw new HttpsError(
        "invalid-argument",
        "Telefon, parol va zaxira kod talab qilinadi.",
    );
  }

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

  if (!profile.passwordHash) {
    throw new HttpsError("failed-precondition", "Parol sozlanmagan.");
  }

  const passwordValid = await bcrypt.compare(password, profile.passwordHash);
  if (!passwordValid) {
    throw new HttpsError("permission-denied", "Telefon yoki parol noto'g'ri.");
  }

  const hashedInput = hashBackupCode(String(backupCode));
  const storedCodes = Array.isArray(profile.backupCodes) ? profile.backupCodes : [];
  const matchIndex = storedCodes.indexOf(hashedInput);

  if (matchIndex === -1) {
    throw new HttpsError("invalid-argument", "Zaxira kod noto'g'ri yoki ishlatilgan.");
  }

  const updatedCodes = storedCodes.filter((_, index) => index !== matchIndex);

  await profileDoc.ref.update({
    backupCodes: updatedCodes,
    updatedAt: FieldValue.serverTimestamp(),
    lastActive: FieldValue.serverTimestamp(),
  });

  const customToken = await auth.createCustomToken(uid);

  logger.info("Backup code used for login", {uid, remainingCodes: updatedCodes.length});

  return {
    success: true,
    customToken,
    uid,
    remainingBackupCodes: updatedCodes.length,
  };
});

/**
 * Disable TOTP for a user (self-service or admin).
 */
exports.disableTOTP = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autentifikatsiya talab qilinadi.");
  }

  const {targetUid, adminVerified} = request.data || {};
  const callerUid = request.auth.uid;
  const profileRef = db.collection("profiles").doc(callerUid);
  const callerSnap = await profileRef.get();
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

  await targetRef.update({
    totpEnabled: false,
    totpSecretEncrypted: FieldValue.delete(),
    totpVerifiedAt: FieldValue.delete(),
    backupCodes: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info("TOTP disabled", {uid: resolvedUid, by: callerUid});

  return {
    success: true,
    uid: resolvedUid,
  };
});

/**
 * Rotate TOTP secret for the authenticated user.
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

  if (!profileSnap.exists || !profileSnap.data().totpEnabled) {
    throw new HttpsError("failed-precondition", "TOTP yoqilmagan.");
  }

  const profile = profileSnap.data();
  const currentSecret = decryptSecret(profile.totpSecretEncrypted);
  const isValid = authenticator.verify({token: String(code).trim(), secret: currentSecret});

  if (!isValid) {
    throw new HttpsError("invalid-argument", "Joriy TOTP kodi noto'g'ri.");
  }

  const newSecret = authenticator.generateSecret();
  const newSecretEncrypted = encryptSecret(newSecret);
  const backupCodes = createPlainBackupCodes();
  const backupCodesHashed = backupCodes.map(hashBackupCode);
  const accountLabel = profile.phoneNumber || profile.email || uid;

  await profileRef.update({
    totpSecretEncrypted: newSecretEncrypted,
    totpVerifiedAt: FieldValue.serverTimestamp(),
    backupCodes: backupCodesHashed,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    otpauthUri: buildOtpauthUri(newSecret, accountLabel),
    backupCodes,
  };
});
