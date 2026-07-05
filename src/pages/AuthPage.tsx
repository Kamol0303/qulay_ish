import { debugLogger } from '../lib/debugLogger';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Loader, Mail, User, ArrowLeft } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import { validatePhoneNumber, validateEmail, validateFullName, formatPhoneNumber } from '../lib/validation';

// Debug logger - only in development
const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

type AuthStep = 'phoneEmail' | 'otp' | 'registerDetails' | 'complete';

type AuthState = {
  // Step 1: Phone/Email
  phoneOrEmail: string;
  
  // Step 2: OTP
  otp: string;
  
  // Step 3: Registration details (register mode only)
  fullName: string;
  additionalEmail?: string;
  additionalPhone?: string;
  selectedRole: 'worker' | 'employer';
  
  // Shared
  loading: boolean;
  error: string;
  success: string;
  sessionId: string;
  useEmailFallback: boolean;
};

const initialState: AuthState = {
  phoneOrEmail: '',
  otp: '',
  fullName: '',
  additionalEmail: '',
  additionalPhone: '',
  selectedRole: 'worker',
  loading: false,
  error: '',
  success: '',
  sessionId: '',
  useEmailFallback: false,
};

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading, userRole, setAuthProfile } = useAuth();
  const { t } = useTranslation();

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('mode');
    return value === 'login' ? 'login' : 'register';
  }, [location.search]);

  const [state, setState] = useState<AuthState>(initialState);
  const [step, setStep] = useState<AuthStep>('phoneEmail');

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
    if (step === 'otp') {
      setStep('phoneEmail');
      setPartialState({ otp: '', sessionId: '' });
    } else if (step === 'registerDetails') {
      setStep('otp');
      setPartialState({ fullName: '', selectedRole: 'worker', additionalEmail: '', additionalPhone: '' });
    } else if (step === 'complete') {
      setStep('phoneEmail');
      setPartialState({ phoneOrEmail: '', otp: '', sessionId: '' });
    }
  }, [step, clearMessages, setPartialState]);

  // Step 1: Request OTP
  const handleRequestOTP = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      const phoneOrEmail = state.phoneOrEmail.trim();
      if (!phoneOrEmail) {
        setPartialState({
          error: state.useEmailFallback
            ? 'Iltimos, email manzilini kiriting.'
            : 'Iltimos, Telegram bilan bog\'langan telefon raqamini kiriting.',
        });
        return;
      }

      if (!state.useEmailFallback) {
        const phoneValidation = validatePhoneNumber(phoneOrEmail);
        if (!phoneValidation.isValid) {
          setPartialState({ error: phoneValidation.error || 'Telefon raqami noto\'g\'ri' });
          return;
        }
      } else {
        const emailValidation = validateEmail(phoneOrEmail);
        if (!emailValidation.isValid) {
          setPartialState({ error: emailValidation.error || 'Email noto\'g\'ri' });
          return;
        }
      }

      setPartialState({ loading: true });

      try {
        const channel = state.useEmailFallback ? ('email' as const) : ('telegram' as const);

        if (mode === 'register') {
          const fullNameValidation = validateFullName(state.fullName);
          if (!fullNameValidation.isValid) {
            setPartialState({ loading: false, error: fullNameValidation.error || '' });
            return;
          }

          const result = await authService.requestOTPForRegistration({
            phoneOrEmail,
            fullName: state.fullName.trim(),
            role: state.selectedRole,
            channel,
          });

          if (!result.success) {
            setPartialState({
              loading: false,
              error: result.error || t('auth.unexpected_error'),
            });
            return;
          }

          setPartialState({
            loading: false,
            success:
              result.message ||
              'OTP kodi Telegram orqali yuborildi, Telegram ilovangizni tekshiring.',
            sessionId: result.sessionId || '',
            useEmailFallback: false,
          });
          setStep('otp');
        } else {
          const result = await authService.requestOTPForLogin(phoneOrEmail, channel);

          if (!result.success) {
            setPartialState({
              loading: false,
              error: result.error || t('auth.unexpected_error'),
            });
            return;
          }

          setPartialState({
            loading: false,
            success:
              result.message ||
              'OTP kodi Telegram orqali yuborildi, Telegram ilovangizni tekshiring.',
            sessionId: result.sessionId || '',
            useEmailFallback: false,
          });
          setStep('otp');
        }
      } catch (err) {
        debugError('OTP Request Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.phoneOrEmail, state.fullName, state.selectedRole, state.useEmailFallback, mode, clearMessages, setPartialState, t],
  );

  // Step 2: Verify OTP
  const handleVerifyOTP = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      if (!state.otp || state.otp.length !== 6) {
        setPartialState({ error: 'OTP kodi 6 raqamli bo\'lishi kerak.' });
        return;
      }

      setPartialState({ loading: true });

      try {
        if (mode === 'register') {
          const result = await authService.verifyOTPForRegistration(state.sessionId, state.otp);

          if (!result.success) {
            setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
            return;
          }

          setPartialState({ loading: false, success: 'OTP tasdiqlandi!' });
          setStep('registerDetails');
        } else {
          // Login mode
          const result = await authService.verifyOTPForLogin(state.sessionId, state.otp);

          if (!result.success) {
            setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
            return;
          }

          // Complete login
          const loginResult = await authService.completeLoginWithOTP(state.sessionId);
          if (!loginResult.success) {
            setPartialState({ loading: false, error: loginResult.error || t('auth.unexpected_error') });
            return;
          }

          if (loginResult.user) {
            setAuthProfile(loginResult.user);
          }

          setPartialState({
            loading: false,
            success: 'Tizimga muvaffaqiyatli kirdingiz.',
          });
          setStep('complete');
        }
      } catch (err) {
        debugError('OTP Verify Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.otp, state.sessionId, mode, clearMessages, setPartialState, setAuthProfile, t]
  );

  // Step 3: Complete Registration
  const handleCompleteRegistration = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      const fullNameValidation = validateFullName(state.fullName);
      if (!fullNameValidation.isValid) {
        setPartialState({ error: fullNameValidation.error || '' });
        return;
      }

      setPartialState({ loading: true });

      try {
        const result = await authService.completeRegistrationWithOTP(state.sessionId, {
          email: state.additionalEmail,
          phoneNumber: state.additionalPhone,
        });

        if (!result.success) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }

        if (result.user) {
          setAuthProfile(result.user);
        }

        setPartialState({
          loading: false,
          success: 'Ro\'yxatdan o\'tish muvaffaqiyatli. Tizimga kirayapman...',
        });
        setStep('complete');
      } catch (err) {
        debugError('Registration Complete Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.fullName, state.additionalEmail, state.additionalPhone, state.sessionId, clearMessages, setPartialState, setAuthProfile, t]
  );

  const showDebugBanner = import.meta.env.VITE_SHOW_DEBUG_BANNER === 'true';

  return (
    <>
      {showDebugBanner && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center font-bold text-sm z-50">
          {t('auth.demo_mode_active', { defaultValue: '🚧 DEMO MODE ACTIVE 🚧' })}
        </div>
      )}
      <div className={`min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center px-4 py-8 ${showDebugBanner ? 'pt-16' : 'pt-8'}`}>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">
            {/* Back Button */}
            {step !== 'phoneEmail' && (
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
                {step === 'phoneEmail' && (mode === 'login' ? 'Telegram orqali kirish' : 'Telegram orqali roʻyxatdan oʻtish')}
                {step === 'otp' && 'Telegramdan kelgan OTP kodini kiriting'}
                {step === 'registerDetails' && 'Qo\'shimcha maʼlumotni kiriting'}
              </p>
            </div>

            {/* Step 1: Phone/Email */}
            {step === 'phoneEmail' && (
              <form onSubmit={handleRequestOTP} className="space-y-5">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {state.useEmailFallback ? 'Email manzili' : 'Telefon raqami (Telegram)'}
                  </label>
                  <input
                    type="text"
                    value={state.phoneOrEmail}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ phoneOrEmail: e.target.value });
                    }}
                    placeholder={state.useEmailFallback ? 'example@email.com' : '+998 90 123 45 67'}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                  />
                  {!state.useEmailFallback && (
                    <p className="text-xs text-gray-500 mt-2">
                      Raqam Telegram hisobingizga bog\'langan bo\'lishi kerak (+998...)
                    </p>
                  )}
                </div>

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
                      <Loader size={18} className="animate-spin" /> Yuborilmoqda...
                    </span>
                  ) : (
                    'Telegram orqali OTP olish'
                  )}
                </button>

                {state.error && state.error.includes('Telegram') && !state.useEmailFallback && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      Bu raqam Telegram orqali tasdiqlanmasa, boshqa usulni sinab ko\'ring:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearMessages();
                          setPartialState({ phoneOrEmail: '', useEmailFallback: false });
                        }}
                        className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-800 font-medium hover:bg-gray-50"
                      >
                        Boshqa telefon raqam bilan urinish
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearMessages();
                          setPartialState({ phoneOrEmail: '', useEmailFallback: true });
                        }}
                        className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 font-medium hover:bg-blue-50"
                      >
                        Email orqali davom etish
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OTP kodi (6 raqam)
                  </label>
                  <input
                    type="text"
                    value={state.otp}
                    onChange={(e) => {
                      clearMessages();
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPartialState({ otp: cleaned });
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900 text-center text-2xl tracking-widest font-mono"
                    disabled={state.loading}
                    maxLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Telegram orqali {state.phoneOrEmail} raqamiga yuborilgan 6 xonali kod
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={state.loading || state.otp.length !== 6}
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

            {/* Step 3: Register Details (registration only) */}
            {step === 'registerDetails' && mode === 'register' && (
              <form onSubmit={handleCompleteRegistration} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toʻliq ismingiz
                  </label>
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

                {!state.phoneOrEmail.includes('@') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (ixtiyoriy)
                    </label>
                    <input
                      type="email"
                      value={state.additionalEmail || ''}
                      onChange={(e) => {
                        clearMessages();
                        setPartialState({ additionalEmail: e.target.value });
                      }}
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                    />
                  </div>
                )}

                {state.phoneOrEmail.includes('@') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefon raqami (ixtiyoriy)
                    </label>
                    <input
                      type="tel"
                      value={state.additionalPhone || ''}
                      onChange={(e) => {
                        clearMessages();
                        setPartialState({ additionalPhone: formatPhoneNumber(e.target.value) });
                      }}
                      placeholder="+998 90 123 45 67"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" /> Tugallanmoqda...
                    </span>
                  ) : (
                    'Roʻyxatdan oʻtishni tugatish'
                  )}
                </button>
              </form>
            )}

            {/* Mode Switch */}
            {step === 'phoneEmail' && (
              <div className="text-center text-sm text-gray-500">
                {mode === 'login' ? (
                  <>
                    Akkauntingiz yo\'q?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phoneEmail');
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
                        setStep('phoneEmail');
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

            {/* Error Message */}
            {state.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{state.error}</p>
              </div>
            )}

            {/* Success Message */}
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
