import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface TwoFactorResult {
  success: boolean;
  error?: string;
  qrCodeDataUrl?: string;
  manualEntryKey?: string;
  backupCodes?: string[];
  verifiedAt?: number;
}

interface CallableError {
  code?: string;
  message?: string;
}

function mapFunctionsError(error: unknown): string {
  const err = error as CallableError;
  const message = err?.message ?? '';
  switch (err?.code) {
    case 'functions/invalid-argument':
      return message || "Ma'lumotlar noto'g'ri.";
    case 'functions/not-found':
      return message || 'Maʼlumot topilmadi.';
    case 'functions/permission-denied':
      return message || 'Ruxsat rad etildi.';
    case 'functions/already-exists':
      return message || 'Bu amal allaqachon bajarilgan.';
    case 'functions/resource-exhausted':
      return message || 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.';
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
  payload: Record<string, string | undefined> = {}
): Promise<TwoFactorResult> {
  if (!functions) {
    return { success: false, error: 'Cloud Functions mavjud emas.' };
  }
  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    return { success: true, ...(result.data as TwoFactorResult) };
  } catch (error) {
    return { success: false, error: mapFunctionsError(error) };
  }
}

export const twoFactorService = {
  initiateSetup(): Promise<TwoFactorResult> {
    return callFunction('initiate2FASetup');
  },

  confirmSetup(code: string): Promise<TwoFactorResult> {
    return callFunction('confirm2FASetup', { code });
  },

  verifyLogin(code?: string, backupCode?: string): Promise<TwoFactorResult> {
    return callFunction('verify2FALogin', { code, backupCode });
  },

  disable(code?: string, password?: string): Promise<TwoFactorResult> {
    return callFunction('disable2FA', { code, password });
  },

  regenerateBackupCodes(code: string): Promise<TwoFactorResult> {
    return callFunction('regenerateBackupCodes', { code });
  },
};
