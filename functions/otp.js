const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();
const auth = getAuth();

// CORS configuration for development and production
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://qulay-ish.uz",
    "https://www.qulay-ish.uz",
  ],
  credentials: true,
};

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizePhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("998")) return `+${digits.slice(0, 12)}`;
  if (digits.length <= 9) return `+998${digits}`;
  return `+${digits.slice(0, 12)}`;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createOtpSessionId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

async function dispatchOtp(identifier, identifierType, otp, purpose) {
  try {
    if (identifierType === "phone") {
      logger.info(`Sending OTP SMS to ${identifier}`, {purpose});
    } else {
      logger.info(`Sending OTP email to ${identifier}`, {purpose});
    }
  } catch (error) {
    logger.warn("OTP dispatch failed (non-fatal)", error);
  }
}

/**
 * Server-side OTP registration session (secret never exposed to client rules).
 */
exports.createOTPRegistrationSession = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {phoneOrEmail, fullName, role} = request.data || {};
  if (!phoneOrEmail || !fullName || !role) {
    throw new HttpsError("invalid-argument", "Majburiy maydonlar to'ldirilmagan.");
  }

  const isPhone = /^(\+|[0-9])/.test(String(phoneOrEmail).trim());
  const isEmail = String(phoneOrEmail).includes("@");
  if (!isPhone && !isEmail) {
    throw new HttpsError("invalid-argument", "Telefon yoki email noto'g'ri.");
  }

  const normalizedIdentifier = isPhone ?
    normalizePhoneNumber(phoneOrEmail) : String(phoneOrEmail).trim();
  const identifierField = isPhone ? "phoneNumber" : "email";

  const existing = await db.collection("profiles")
      .where(identifierField, "==", normalizedIdentifier)
      .limit(1)
      .get();
  if (!existing.empty) {
    throw new HttpsError(
        "already-exists",
        isPhone ? "Bu telefon raqam allaqachon ro'yxatdan o'tgan" :
        "Bu email allaqachon ro'yxatdan o'tgan",
    );
  }

  const otp = generateOtpCode();
  const sessionId = createOtpSessionId("otp_reg");
  await db.collection("otp_sessions").doc(sessionId).set({
    sessionId,
    identifier: normalizedIdentifier,
    identifierType: isPhone ? "phone" : "email",
    otp,
    fullName: String(fullName).trim(),
    role,
    verified: false,
    expiryTime: Date.now() + OTP_TTL_MS,
    createdAt: FieldValue.serverTimestamp(),
    attempts: 0,
  });

  await dispatchOtp(normalizedIdentifier, isPhone ? "phone" : "email", otp, "registration");
  return {success: true, sessionId};
});

/**
 * Server-side OTP login session.
 */
exports.createOTPLoginSession = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {phoneOrEmail} = request.data || {};
  if (!phoneOrEmail) {
    throw new HttpsError("invalid-argument", "Telefon yoki email talab qilinadi.");
  }

  const isPhone = /^(\+|[0-9])/.test(String(phoneOrEmail).trim());
  const isEmail = String(phoneOrEmail).includes("@");
  if (!isPhone && !isEmail) {
    throw new HttpsError("invalid-argument", "Telefon yoki email noto'g'ri.");
  }

  const normalizedIdentifier = isPhone ?
    normalizePhoneNumber(phoneOrEmail) : String(phoneOrEmail).trim();
  const identifierField = isPhone ? "phoneNumber" : "email";

  const userSnap = await db.collection("profiles")
      .where(identifierField, "==", normalizedIdentifier)
      .limit(1)
      .get();
  if (userSnap.empty) {
    throw new HttpsError(
        "not-found",
        isPhone ? "Bu telefon raqam ro'yxatdan o'tmagan" :
        "Bu email ro'yxatdan o'tmagan",
    );
  }

  const userData = userSnap.docs[0].data();
  const otp = generateOtpCode();
  const sessionId = createOtpSessionId("otp_login");

  await db.collection("otp_sessions").doc(sessionId).set({
    sessionId,
    identifier: normalizedIdentifier,
    identifierType: isPhone ? "phone" : "email",
    otp,
    uid: userData.uid,
    verified: false,
    expiryTime: Date.now() + OTP_TTL_MS,
    createdAt: FieldValue.serverTimestamp(),
    attempts: 0,
    purpose: "login",
  });

  await dispatchOtp(normalizedIdentifier, isPhone ? "phone" : "email", otp, "login");
  return {success: true, sessionId};
});

/**
 * Complete registration after server-verified OTP session.
 */
exports.completeOTPRegistration = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {sessionId, email, phoneNumber} = request.data || {};
  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Session ID talab qilinadi.");
  }

  const otpRef = db.collection("otp_sessions").doc(sessionId);
  const otpSnap = await otpRef.get();
  if (!otpSnap.exists) {
    throw new HttpsError("not-found", "OTP sessiyasi topilmadi.");
  }

  const otpData = otpSnap.data();
  if (!otpData.verified) {
    throw new HttpsError("failed-precondition", "OTP tasdiqlanmagan.");
  }
  if (otpData.completed) {
    throw new HttpsError("already-exists", "Ro'yxatdan o'tish allaqachon yakunlangan.");
  }

  let resolvedEmail = email?.trim() || "";
  let resolvedPhone = phoneNumber?.trim() || "";
  if (otpData.identifierType === "phone") {
    resolvedPhone = otpData.identifier;
    if (!resolvedEmail) {
      resolvedEmail = `${otpData.identifier.replace(/\D/g, "")}@qulayish.local`;
    }
  } else {
    resolvedEmail = otpData.identifier;
  }

  const userRecord = await auth.createUser({
    email: resolvedEmail,
    password: crypto.randomBytes(24).toString("hex"),
    displayName: otpData.fullName,
  });

  await db.collection("profiles").doc(userRecord.uid).set({
    uid: userRecord.uid,
    fullName: otpData.fullName,
    email: resolvedEmail,
    phoneNumber: resolvedPhone,
    role: otpData.role,
    region: "Samarqand",
    district: "",
    neighborhood: "",
    bio: "",
    skills: [],
    isVerified: true,
    verificationStatus: "verified",
    status: "active",
    authMethod: "otp",
    twoFactorEnabled: false,
    totpEnabled: false,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastActive: FieldValue.serverTimestamp(),
  });

  await otpRef.update({
    completed: true,
    completedAt: FieldValue.serverTimestamp(),
    uid: userRecord.uid,
  });

  const customToken = await auth.createCustomToken(userRecord.uid);
  return {success: true, uid: userRecord.uid, customToken};
});

/**
 * OTP Login - Generate custom token for user authentication
 */
exports.createOTPLoginToken = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {sessionId} = request.data;

  if (!sessionId) {
    throw new Error("Session ID is required");
  }

  try {
    const otpRef = db.collection("otp_sessions").doc(sessionId);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      throw new HttpsError("not-found", "OTP session not found");
    }

    const otpData = otpSnap.data();

    // Check if verified
    if (!otpData.verified) {
      throw new Error("OTP not verified");
    }

    // Get user
    const uid = otpData.uid;
    const customToken = await auth.createCustomToken(uid);

    // Update last active
    await db.collection("profiles").doc(uid).update({
      lastActive: new Date(),
      updatedAt: new Date(),
    });

    // Mark session as completed
    await otpRef.update({
      completed: true,
      completedAt: new Date(),
    });

    logger.info(`OTP login token created for user ${uid}`);

    return {
      success: true,
      customToken,
      uid,
    };
  } catch (error) {
    logger.error("Error creating OTP login token:", error);
    throw error;
  }
});

/**
 * Send OTP via Email (Placeholder for production)
 * In production, integrate with Twilio SendGrid or similar service
 */
exports.sendOTPEmail = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {email, otp, purpose} = request.data;

  if (!email || !otp) {
    throw new Error("Email and OTP are required");
  }

  try {
    logger.info(`Sending OTP email to ${email}`, {otp: otp.substring(0, 3) + '***'});
    
    // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
    // For now, log to console in development
    // Example with SendGrid:
    // await sgMail.send({
    //   to: email,
    //   from: 'noreply@qulayish.uz',
    //   subject: 'Qulay Ish - OTP Verification Code',
    //   html: `
    //     <h2>Your verification code:</h2>
    //     <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
    //     <p>This code will expire in 10 minutes.</p>
    //   `,
    // });

    return {
      success: true,
      message: "OTP sent successfully",
    };
  } catch (error) {
    logger.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
});

/**
 * Send OTP via SMS (using Twilio)
 * Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables
 */
exports.sendOTPSMS = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {phoneNumber, otp, purpose} = request.data;

  if (!phoneNumber || !otp) {
    throw new Error("Phone number and OTP are required");
  }

  try {
    logger.info(`Sending OTP SMS to ${phoneNumber}`, {otp: otp.substring(0, 3) + '***'});

    // TODO: Integrate with Twilio for SMS sending
    // Example with Twilio:
    // const twilio = require('twilio');
    // const client = twilio(
    //   process.env.TWILIO_ACCOUNT_SID,
    //   process.env.TWILIO_AUTH_TOKEN
    // );
    // 
    // await client.messages.create({
    //   body: `Your Qulay Ish verification code is: ${otp}. This code will expire in 10 minutes.`,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber,
    // });

    return {
      success: true,
      message: "OTP SMS sent successfully",
    };
  } catch (error) {
    logger.error("Error sending OTP SMS:", error);
    throw new Error("Failed to send OTP SMS");
  }
});

/**
 * Verify OTP Session (Server-side verification for security)
 */
exports.verifyOTPSession = onCall({
  maxInstances: 10,
  cors: corsOptions,
}, async (request) => {
  const {sessionId, otp} = request.data;

  if (!sessionId || !otp) {
    throw new Error("Session ID and OTP are required");
  }

  try {
    const otpRef = db.collection("otp_sessions").doc(sessionId);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      throw new Error("OTP session not found");
    }

    const otpData = otpSnap.data();

    // Check expiry
    if (Date.now() > otpData.expiryTime) {
      throw new Error("OTP code has expired");
    }

    // Check attempts
    if (otpData.attempts >= 5) {
      throw new Error("Maximum attempts exceeded. Please request a new OTP.");
    }

    // Verify OTP
    if (otp !== otpData.otp) {
      await otpRef.update({attempts: otpData.attempts + 1});
      throw new Error("Invalid OTP code");
    }

    // Mark as verified
    await otpRef.update({
      verified: true,
      verifiedAt: new Date(),
    });

    return {
      success: true,
      message: "OTP verified successfully",
    };
  } catch (error) {
    logger.error("Error verifying OTP:", error);
    throw error;
  }
});

/**
 * Clean up expired OTP sessions (scheduled function)
 * Run this daily via Cloud Scheduler
 */
exports.cleanupExpiredOTP = onCall({
  maxInstances: 5,
  cors: corsOptions,
}, async (request) => {
  try {
    const now = Date.now();
    const query = db.collection("otp_sessions").where("expiryTime", "<", now);
    const snapshot = await query.get();

    logger.info(`Found ${snapshot.size} expired OTP sessions to clean up`);

    // Delete in batches
    const batch = db.batch();
    let count = 0;
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
      
      // Firestore has a 500 write limit per batch
      if (count === 500) {
        batch.commit();
        count = 0;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    logger.info(`Cleaned up ${snapshot.size} expired OTP sessions`);

    return {
      success: true,
      message: `Cleaned up ${snapshot.size} expired OTP sessions`,
    };
  } catch (error) {
    logger.error("Error cleaning up OTP sessions:", error);
    throw new Error("Failed to clean up OTP sessions");
  }
});
