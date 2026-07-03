import { debugLogger } from '../lib/debugLogger';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Loader, Mail, User, ArrowLeft, Shield, Copy, Check } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import { validatePhoneNumber, validateFullName } from '../lib/validation';
import { passwordService } from '../lib/passwordService';
import { generateTotpQrDataUrl, normalizeBackupCode, normalizeTotpCode } from '../lib/totpUtils';

const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

type AuthStep = 'credentials' | 'totpSetup' | 'totpVerify' | 'backupCode' | 'complete';

type AuthState = {
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  totpCode: string;
  backupCode: string;
  fullName: string;
  selectedRole: 'worker' | 'employer';
  loading: boolean;
  error: string;
  success: string;
  sessionId: string;
  otpauthUri: string;
  qrDataUrl: string;
  backupCodes: string[];
  copiedBackupCodes: boolean;
};

const initialState: AuthState = {
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  totpCode: '',
  backupCode: '',
  fullName: '',
  selectedRole: 'worker',
  loading: false,
  error: '',
  success: '',
  sessionId: '',
  otpauthUri: '',
  qrDataUrl: '',
  backupCodes: [],
  copiedBackupCodes: false,
};

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading, userRole } = useAuth();
  const { t } = useTranslation();

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('mode');
    return value === 'login' ? 'login' : 'register';
  }, [location.search]);

  const [state, setState] = useState<AuthState>(initialState);
  const [step, setStep] = useState<AuthStep>('credentials');

  const setPartialState = useCallback((patch: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile || !profile.role) return;
    const redirectPath = getRoleRedirectPath(userRole);
    navigate(redirectPath, { replace: true });
  }, [authLoading, user, profile, userRole, navigate]);

  const clearMessages = useCallback(() => {
    setPartialState({ error: '', success: '' });
  }, [setPartialState]);

  const handleGoBack = useCallback(() => {
    clearMessages();
    if (step === 'totpSetup' || step === 'totpVerify') {
      setStep('credentials');
      setPartialState({
        totpCode: '',
        sessionId: '',
        otpauthUri: '',
        qrDataUrl: '',
        backupCodes: [],
      });
    } else if (step === 'backupCode') {
      setStep('totpVerify');
      setPartialState({ backupCode: '' });
    } else if (step === 'complete') {
      setStep('credentials');
      setState(initialState);
    }
  }, [step, clearMessages, setPartialState]);

  const handleCredentialsSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      const phoneValidation = validatePhoneNumber(state.phoneNumber);
      if (!phoneValidation.isValid) {
        setPartialState({ error: phoneValidation.error || '' });
        return;
      }

      const passwordValidation = passwordService.validatePassword(state.password);
      if (!passwordValidation.isValid) {
        setPartialState({ error: passwordValidation.error || '' });
        return;
      }

      if (mode === 'register' && state.password !== state.confirmPassword) {
        setPartialState({ error: 'Parollar mos kelmaydi.' });
        return;
      }

      setPartialState({ loading: true });

      try {
        if (mode === 'register') {
          const fullNameValidation = validateFullName(state.fullName);
          if (!fullNameValidation.isValid) {
            setPartialState({ loading: false, error: fullNameValidation.error || '' });
            return;
          }

          const result = await authService.requestTOTPForRegistration({
            phoneNumber: state.phoneNumber,
            password: state.password,
            fullName: state.fullName.trim(),
            role: state.selectedRole,
          });

          if (!result.success || !result.otpauthUri || !result.sessionId) {
            setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
            return;
          }

          const qrDataUrl = await generateTotpQrDataUrl(result.otpauthUri);

          setPartialState({
            loading: false,
            success: 'Google Authenticator uchun QR kod tayyor.',
            sessionId: result.sessionId,
            otpauthUri: result.otpauthUri,
            qrDataUrl,
            backupCodes: result.backupCodes || [],
          });
          setStep('totpSetup');
        } else {
          const result = await authService.initiateTOTPLogin({
            phoneNumber: state.phoneNumber,
            password: state.password,
          });

          if (!result.success || !result.sessionId) {
            setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
            return;
          }

          setPartialState({
            loading: false,
            success: 'Google Authenticator kodini kiriting.',
            sessionId: result.sessionId,
          });
          setStep('totpVerify');
        }
      } catch (err) {
        debugError('Credentials Submit Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [
      state.phoneNumber,
      state.password,
      state.confirmPassword,
      state.fullName,
      state.selectedRole,
      mode,
      clearMessages,
      setPartialState,
      t,
    ]
  );

  const handleVerifyTotp = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      if (!state.totpCode || state.totpCode.length !== 6) {
        setPartialState({ error: 'Tasdiqlash kodi 6 raqamli bo\'lishi kerak.' });
        return;
      }

      setPartialState({ loading: true });

      try {
        if (mode === 'register') {
          const result = await authService.verifyTOTPForRegistration(
            state.sessionId,
            state.totpCode
          );

          if (!result.success) {
            setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
            return;
          }

          setPartialState({
            loading: false,
            success: 'Ro\'yxatdan o\'tish muvaffaqiyatli. Tizimga kirayapman...',
          });
          setStep('complete');

          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          const result = await authService.completeTOTPLogin(state.sessionId, state.totpCode);

          if (!result.success) {
            setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
            return;
          }

          setPartialState({
            loading: false,
            success: 'Tizimga muvaffaqiyatli kirdingiz.',
          });
          setStep('complete');

          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        debugError('TOTP Verify Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.totpCode, state.sessionId, mode, clearMessages, setPartialState, t]
  );

  const handleBackupCodeSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      if (!state.backupCode || state.backupCode.length < 9) {
        setPartialState({ error: 'Zaxira kodni to\'liq kiriting (masalan: 8DKA-21QW).' });
        return;
      }

      setPartialState({ loading: true });

      try {
        const result = await authService.loginWithBackupCode({
          phoneNumber: state.phoneNumber,
          password: state.password,
          backupCode: state.backupCode,
        });

        if (!result.success) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }

        const remaining = result.remainingBackupCodes ?? 0;
        setPartialState({
          loading: false,
          success:
            remaining > 0
              ? `Tizimga kirdingiz. Qolgan zaxira kodlar: ${remaining}`
              : 'Tizimga kirdingiz. Zaxira kodlar tugagan — yangi kodlar yarating.',
        });
        setStep('complete');

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err) {
        debugError('Backup Code Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.backupCode, state.phoneNumber, state.password, clearMessages, setPartialState, t]
  );

  const handleCopyBackupCodes = useCallback(async () => {
    if (state.backupCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(state.backupCodes.join('\n'));
      setPartialState({ copiedBackupCodes: true });
      setTimeout(() => setPartialState({ copiedBackupCodes: false }), 2000);
    } catch {
      setPartialState({ error: 'Nusxa olishda xatolik yuz berdi.' });
    }
  }, [state.backupCodes, setPartialState]);

  const showDebugBanner = import.meta.env.VITE_SHOW_DEBUG_BANNER === 'true';

  return (
    <>
      {showDebugBanner && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center font-bold text-sm z-50">
          {t('auth.demo_mode_active', { defaultValue: '🚧 DEMO MODE ACTIVE 🚧' })}
        </div>
      )}
      <div
        className={`min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center px-4 py-8 ${showDebugBanner ? 'pt-16' : 'pt-8'}`}
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">
            {step !== 'credentials' && (
              <button
                type="button"
                onClick={handleGoBack}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-2"
              >
                <ArrowLeft size={18} /> Ortga
              </button>
            )}

            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {mode === 'login' ? 'Kirish' : 'Roʻyxatdan oʻtish'}
              </h1>
              <p className="text-gray-600">
                {step === 'credentials' &&
                  (mode === 'login'
                    ? 'Telefon va parol orqali kirish'
                    : 'Telefon va parol bilan roʻyxatdan oʻtish')}
                {(step === 'totpSetup' || step === 'totpVerify') && 'Google Authenticator'}
                {step === 'backupCode' && 'Zaxira kod orqali tiklash'}
              </p>
            </div>

            {step === 'credentials' && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Toʻliq ismingiz</label>
                    <input
                      type="text"
                      value={state.fullName}
                      onChange={(e) => {
                        clearMessages();
                        setPartialState({ fullName: e.target.value });
                      }}
                      placeholder="Ism Familiya"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon raqami</label>
                  <input
                    type="tel"
                    value={state.phoneNumber}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ phoneNumber: e.target.value });
                    }}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parol</label>
                  <input
                    type="password"
                    value={state.password}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ password: e.target.value });
                    }}
                    placeholder="Kamida 8 ta belgi"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parolni tasdiqlang</label>
                    <input
                      type="password"
                      value={state.confirmPassword}
                      onChange={(e) => {
                        clearMessages();
                        setPartialState({ confirmPassword: e.target.value });
                      }}
                      placeholder="Parolni qayta kiriting"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                    />
                  </div>
                )}

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rolni tanlang</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPartialState({ selectedRole: 'worker' })}
                        className={`p-4 rounded-xl font-semibold transition ${
                          state.selectedRole === 'worker'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        <User size={18} /> Ishchi
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialState({ selectedRole: 'employer' })}
                        className={`p-4 rounded-xl font-semibold transition ${
                          state.selectedRole === 'employer'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        <Mail size={18} /> Ish beruvchi
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
                    </span>
                  ) : mode === 'login' ? (
                    'Davom etish'
                  ) : (
                    'Google Authenticator sozlash'
                  )}
                </button>
              </form>
            )}

            {step === 'totpSetup' && (
              <form onSubmit={handleVerifyTotp} className="space-y-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold">
                    <Shield size={20} />
                    <span>Google Authenticator</span>
                  </div>

                  {state.qrDataUrl && (
                    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                      <img
                        src={state.qrDataUrl}
                        alt="Google Authenticator QR Code"
                        className="w-[220px] h-[220px]"
                      />
                    </div>
                  )}

                  <p className="text-sm text-gray-600 text-center">
                    Google Authenticator ilovasida QR kodni skanerlang
                  </p>
                </div>

                {state.backupCodes.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-amber-900">
                      Zaxira kodlar (bir marta ko&apos;rsatiladi)
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm text-amber-950">
                      {state.backupCodes.map((code) => (
                        <span key={code}>{code}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyBackupCodes}
                      className="flex items-center gap-2 text-sm text-amber-800 hover:text-amber-900 font-medium"
                    >
                      {state.copiedBackupCodes ? <Check size={16} /> : <Copy size={16} />}
                      {state.copiedBackupCodes ? 'Nusxa olindi' : 'Barcha kodlarni nusxalash'}
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    6 xonali kodni kiriting
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={state.totpCode}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ totpCode: normalizeTotpCode(e.target.value) });
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900 text-center text-2xl tracking-widest font-mono"
                    disabled={state.loading}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>

                <button
                  type="submit"
                  disabled={state.loading || state.totpCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
                    </span>
                  ) : (
                    'Tasdiqlash'
                  )}
                </button>
              </form>
            )}

            {step === 'totpVerify' && (
              <form onSubmit={handleVerifyTotp} className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold">
                    <Shield size={20} />
                    <span>Google Authenticator</span>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    Google Authenticator ilovasidagi 6 xonali kodni kiriting
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    6 xonali kod
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={state.totpCode}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ totpCode: normalizeTotpCode(e.target.value) });
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900 text-center text-2xl tracking-widest font-mono"
                    disabled={state.loading}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>

                <button
                  type="submit"
                  disabled={state.loading || state.totpCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
                    </span>
                  ) : (
                    'Tasdiqlash'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setStep('backupCode');
                  }}
                  className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Telefon yo&apos;qoldimi? Zaxira koddan foydalanish
                </button>
              </form>
            )}

            {step === 'backupCode' && (
              <form onSubmit={handleBackupCodeSubmit} className="space-y-5">
                <p className="text-sm text-gray-600 text-center">
                  Ro&apos;yxatdan o&apos;tishda saqlagan zaxira kodingizni kiriting.
                  Barcha kodlar ishlatilganda administrator tasdiqlashi kerak.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zaxira kod
                  </label>
                  <input
                    type="text"
                    value={state.backupCode}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ backupCode: normalizeBackupCode(e.target.value) });
                    }}
                    placeholder="8DKA-21QW"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900 text-center text-xl tracking-widest font-mono uppercase"
                    disabled={state.loading}
                    maxLength={9}
                  />
                </div>

                <button
                  type="submit"
                  disabled={state.loading || state.backupCode.length < 9}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
                    </span>
                  ) : (
                    'Zaxira kod bilan kirish'
                  )}
                </button>
              </form>
            )}

            {step === 'credentials' && (
              <div className="text-center text-sm text-gray-500">
                {mode === 'login' ? (
                  <>
                    Akkauntingiz yo&apos;q?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setState(initialState);
                        navigate('/auth?mode=register');
                      }}
                      className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Roʻyxatdan oʻtish
                    </button>
                  </>
                ) : (
                  <>
                    Allaqachon akkauntingiz bor?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setState(initialState);
                        navigate('/auth?mode=login');
                      }}
                      className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Kirish
                    </button>
                  </>
                )}
              </div>
            )}

            {state.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{state.error}</p>
              </div>
            )}

            {state.success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                <p className="text-green-800 text-sm">{state.success}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
