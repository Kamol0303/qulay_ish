/**
 * Demo / local-only data is permanently disabled.
 * Web and APK must share the NestJS API + PostgreSQL only.
 */
export const DEMO_ENABLED = false;

export function clearLegacyDemoStorage(): void {
  try {
    localStorage.removeItem('qulay_ish_demo_session');
    localStorage.removeItem('qulayish_demo_users');
    localStorage.removeItem('qulayish_demo_jobs');
    localStorage.removeItem('qulayish_demo_contracts');
    localStorage.removeItem('qulay_ish_otp_login_uid');
    localStorage.removeItem('qulay_ish_otp_login_profile');
  } catch {
    /* ignore */
  }
}
