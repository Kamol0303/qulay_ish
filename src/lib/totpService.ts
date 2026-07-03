import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface TotpAuthResult {
  success: boolean;
  error?: string;
  sessionId?: string;
  otpauthUri?: string;
  qrCodeDataUrl?: string;
  backupCodes?: string[];
  uid?: string;
  verifiedAt?: number;
  remainingBackupCodes?: number;
}

interface CallableError {
  code?: string;
  message?: string;
}

function mapFunctionsError(error: unknown): string {
  const functionsError = error as CallableError;
  const code = functionsError?.code ?? '';
  const message = functionsError?.message ?? '';

  switch (code) {
    case 'functions/invalid-argument':
      return message || "Ma'lumotlar noto'g'ri.";
    case 'functions/not-found':
      return message || 'Maʼlumot topilmadi.';
    case 'functions/permission-denied':
      return message || 'Ruxsat rad etildi.';
    case 'functions/already-exists':
      return message || 'Bu amal allaqachon bajarilgan.';
    case 'functions/deadline-exceeded':
      return 'Sessiya muddati tugagan. Qayta urinib ko\'ring.';
    case 'functions/resource-exhausted':
      return 'Juda ko\'p xato urinish. Qayta urinib ko\'ring.';
    case 'functions/failed-precondition':
      return message || 'Amalni bajarib bo\'lmadi.';
    case 'functions/unauthenticated':
      return 'Avval tizimga kiring.';
    default:
      return message || 'Server xatosi. Qayta urinib ko\'ring.';
  }
}

async function callFunction(
  name: string,
  payload: Record<string, string | boolean | undefined> = {}
): Promise<TotpAuthResult> {
  if (!functions) {
    return {
      success: false,
      error: 'Cloud Functions mavjud emas. Keyinroq qayta urinib ko\'ring.',
    };
  }

  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    const data = result.data as TotpAuthResult;
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: mapFunctionsError(error) };
  }
}

export const totpService = {
  startEnrollment(): Promise<TotpAuthResult> {
    return callFunction('generateSecret');
  },

  confirmEnrollment(sessionId: string, code: string): Promise<TotpAuthResult> {
    return callFunction('verifyTOTP', { sessionId, code });
  },

  verifyChallenge(code: string): Promise<TotpAuthResult> {
    return callFunction('verifyTwoFactor', { code });
  },

  useBackupCode(backupCode: string): Promise<TotpAuthResult> {
    return callFunction('useBackupCode', { backupCode });
  },

  generateBackupCodes(): Promise<TotpAuthResult> {
    return callFunction('generateBackupCodes');
  },

  disable(code?: string, targetUid?: string, adminVerified?: boolean): Promise<TotpAuthResult> {
    return callFunction('disableTOTP', { code, targetUid, adminVerified });
  },

  rotateSecret(code: string): Promise<TotpAuthResult> {
    return callFunction('rotateSecret', { code });
  },
};
