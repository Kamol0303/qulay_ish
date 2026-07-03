const {setGlobalOptions} = require("firebase-functions");

const {
  verifyPasswordServerSide,
  storePasswordCredentials,
  setSuperAdminClaim,
} = require("./authSecurity");

const {
  initiate2FASetup,
  confirm2FASetup,
  verify2FALogin,
  disable2FA,
  regenerateBackupCodes,
} = require("./twoFactorAuth");

setGlobalOptions({maxInstances: 10});

exports.verifyPasswordServerSide = verifyPasswordServerSide;
exports.storePasswordCredentials = storePasswordCredentials;
exports.setSuperAdminClaim = setSuperAdminClaim;

exports.initiate2FASetup = initiate2FASetup;
exports.confirm2FASetup = confirm2FASetup;
exports.verify2FALogin = verify2FALogin;
exports.disable2FA = disable2FA;
exports.regenerateBackupCodes = regenerateBackupCodes;
