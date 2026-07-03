/**
 * Cloud Functions entry point for Qulay Ish.
 */

const {setGlobalOptions} = require("firebase-functions");

const {
  sendOTPEmail,
  sendOTPSMS,
  verifyOTPSession,
  cleanupExpiredOTP,
  createOTPLoginToken,
} = require("./otp");

const {
  generateSecret,
  verifyTOTP,
  initiateTOTPLogin,
  completeTOTPLogin,
  generateBackupCodes,
  useBackupCode,
  disableTOTP,
  rotateSecret,
} = require("./totp");

setGlobalOptions({maxInstances: 10});

// Legacy OTP functions (kept for backward compatibility during migration)
exports.sendOTPEmail = sendOTPEmail;
exports.sendOTPSMS = sendOTPSMS;
exports.verifyOTPSession = verifyOTPSession;
exports.cleanupExpiredOTP = cleanupExpiredOTP;
exports.createOTPLoginToken = createOTPLoginToken;

// TOTP authentication functions
exports.generateSecret = generateSecret;
exports.verifyTOTP = verifyTOTP;
exports.initiateTOTPLogin = initiateTOTPLogin;
exports.completeTOTPLogin = completeTOTPLogin;
exports.generateBackupCodes = generateBackupCodes;
exports.useBackupCode = useBackupCode;
exports.disableTOTP = disableTOTP;
exports.rotateSecret = rotateSecret;
