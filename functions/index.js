/**
 * Cloud Functions entry point for Qulay Ish.
 */

const {setGlobalOptions} = require("firebase-functions");

const {
  createOTPRegistrationSession,
  createOTPLoginSession,
  completeOTPRegistration,
  sendOTPEmail,
  sendOTPSMS,
  verifyOTPSession,
  cleanupExpiredOTP,
  createOTPLoginToken,
} = require("./otp");

const {
  generateSecret,
  verifyTOTP,
  verifyTwoFactor,
  generateBackupCodes,
  useBackupCode,
  disableTOTP,
  rotateSecret,
} = require("./totp");

setGlobalOptions({maxInstances: 10});

// Legacy OTP functions (kept for backward compatibility during migration)
exports.createOTPRegistrationSession = createOTPRegistrationSession;
exports.createOTPLoginSession = createOTPLoginSession;
exports.completeOTPRegistration = completeOTPRegistration;
exports.sendOTPEmail = sendOTPEmail;
exports.sendOTPSMS = sendOTPSMS;
exports.verifyOTPSession = verifyOTPSession;
exports.cleanupExpiredOTP = cleanupExpiredOTP;
exports.createOTPLoginToken = createOTPLoginToken;

// TOTP authentication functions
exports.generateSecret = generateSecret;
exports.verifyTOTP = verifyTOTP;
exports.verifyTwoFactor = verifyTwoFactor;
exports.generateBackupCodes = generateBackupCodes;
exports.useBackupCode = useBackupCode;
exports.disableTOTP = disableTOTP;
exports.rotateSecret = rotateSecret;
