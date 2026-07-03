import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface TotpAuthResult {
  success: boolean;
  error?: string;
  sessionId?: string;
  otpauthUri?: string;
  backupCodes?: string[];
  customToken?: string;
  uid?: string;
  remainingBackupCodes?: number;
}

export interface GenerateSecretPayload {
  phoneNumber: string;
  password: string;
  fullName: string;
  role: 'worker' | 'employer';
  email?: string;
}

export interface InitiateLoginPayload {
  phoneNumber: string;
  password: string;
}

export interface VerifyTotpPayload {
  sessionId: string;
  code: string;
}

export interface UseBackupCodePayload {
  phoneNumber: string;
  password: string;
  backupCode: string;
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
      return message || 'Telefon yoki parol noto\'g\'ri.';
    case 'functions/already-exists':
      return message || 'Bu hisob allaqachon mavjud.';
    case 'functions/deadline-exceeded':
      return 'Tasdiqlash sessiyasi muddati tugagan. Qayta urinib ko\'ring.';
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

function failureResult(error: string): TotpAuthResult {
  return { success: false, error };
}

async function callFunction(
  name: string,
  payload: GenerateSecretPayload | InitiateLoginPayload | VerifyTotpPayload | UseBackupCodePayload | Record<string, string | boolean | undefined>
): Promise<TotpAuthResult> {
  if (!functions) {
    return failureResult('Cloud Functions mavjud emas. Keyinroq qayta urinib ko\'ring.');
  }

  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    const data = result.data as TotpAuthResult;
    return {
      success: true,
      sessionId: data.sessionId,
      otpauthUri: data.otpauthUri,
      backupCodes: data.backupCodes,
      customToken: data.customToken,
      uid: data.uid,
      remainingBackupCodes: data.remainingBackupCodes,
    };
  } catch (error) {
    return failureResult(mapFunctionsError(error));
  }
}

export const totpService = {
  generateSecret(payload: GenerateSecretPayload): Promise<TotpAuthResult> {
    return callFunction('generateSecret', payload);
  },

  verifyTOTP(payload: VerifyTotpPayload): Promise<TotpAuthResult> {
    return callFunction('verifyTOTP', payload);
  },

  initiateLogin(payload: InitiateLoginPayload): Promise<TotpAuthResult> {
    return callFunction('initiateTOTPLogin', payload);
  },

  completeLogin(payload: VerifyTotpPayload): Promise<TotpAuthResult> {
    return callFunction('completeTOTPLogin', payload);
  },

  useBackupCode(payload: UseBackupCodePayload): Promise<TotpAuthResult> {
    return callFunction('useBackupCode', payload);
  },

  generateBackupCodes(): Promise<TotpAuthResult> {
    return callFunction('generateBackupCodes', {});
  },

  disableTOTP(targetUid?: string, adminVerified?: boolean): Promise<TotpAuthResult> {
    return callFunction('disableTOTP', { targetUid, adminVerified });
  },

  rotateSecret(code: string): Promise<TotpAuthResult> {
    return callFunction('rotateSecret', { code });
  },
};
