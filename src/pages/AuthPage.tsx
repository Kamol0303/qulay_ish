import { debugLogger } from '../lib/debugLogger';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Loader, Mail, User, ArrowLeft } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import { validatePhoneNumber, validateFullName, formatPhoneNumber } from '../lib/validation';

const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

type AuthStep = 'phone' | 'otp' | 'complete';

type AuthState = {
  phone: string;
  otp: string;
  fullName: string;
  selectedRole: 'worker' | 'employer';
  loading: boolean;
  error: string;
  success: string;
  resendSeconds: number;
};

const initialState: AuthState = {
  phone: '',
  otp: '',
  fullName: '',
  selectedRole: 'worker',
  loading: false,
  error: '',
  success: '',
  resendSeconds: 0,
};

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading, userRole, establishApiSession } = useAuth();
  const { t } = useTranslation();

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('mode');
    return value === 'login' ? 'login' : 'register';
  }, [location.search]);

  const [state, setState] = useState<AuthState>(initialState);
  const [step, setStep] = useState<AuthStep>('phone');

  const setPartialState = useCallback((patch: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile || !profile.role) return;
    const redirectPath = getRoleRedirectPath(userRole);
    navigate(redirectPath, { replace: true });
  }, [authLoading, user, profile, userRole, navigate]);

  useEffect(() => {
    if (state.resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setState((prev) => ({
        ...prev,
        resendSeconds: prev.resendSeconds > 0 ? prev.resendSeconds - 1 : 0,
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.resendSeconds]);

  const clearMessages = useCallback(() => {
    setPartialState({ error: '', success: '' });
  }, [setPartialState]);

  const handleGoBack = useCallback(() => {
    clearMessages();
    if (step === 'otp') {
      setStep('phone');
      setPartialState({ otp: '', resendSeconds: 0 });
    } else if (step === 'complete') {
      setStep('phone');
      setPartialState({ phone: '', otp: '', resendSeconds: 0 });
    }
  }, [step, clearMessages, setPartialState]);

  const requestOtp = useCallback(async () => {
    const phoneValidation = validatePhoneNumber(state.phone);
    if (!phoneValidation.isValid) {
      setPartialState({ error: phoneValidation.error || 'Telefon raqami noto\'g\'ri.' });
      return false;
    }

    if (mode === 'register') {
      const fullNameValidation = validateFullName(state.fullName);
      if (!fullNameValidation.isValid) {
        setPartialState({ error: fullNameValidation.error || '' });
        return false;
      }
    }

    setPartialState({ loading: true, error: '', success: '' });

    try {
      const result =
        mode === 'register'
          ? await authService.sendOtp({
              phone: state.phone,
              purpose: 'register',
              fullName: state.fullName.trim(),
              role: state.selectedRole,
            })
          : await authService.sendOtp({
              phone: state.phone,
              purpose: 'login',
            });

      if (!result.success) {
        setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
        return false;
      }

      setPartialState({
        loading: false,
        success: 'OTP kodi SMS orqali yuborildi.',
        resendSeconds: 60,
      });
      setStep('otp');
      return true;
    } catch (err) {
      debugError('OTP Request Error]', err);
      setPartialState({ loading: false, error: t('auth.unexpected_error') });
      return false;
    }
  }, [state.phone, state.fullName, state.selectedRole, mode, setPartialState, t]);

  const handleRequestOTP = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();
      await requestOtp();
    },
    [clearMessages, requestOtp]
  );

  const handleResendOTP = useCallback(async () => {
    if (state.resendSeconds > 0 || state.loading) return;
    clearMessages();
    await requestOtp();
  }, [state.resendSeconds, state.loading, clearMessages, requestOtp]);

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
        const result = await authService.verifyOtp(state.phone, state.otp);

        if (!result.success || !result.accessToken || !result.profile) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }

        establishApiSession(result.accessToken, result.profile);

        setPartialState({
          loading: false,
          success: mode === 'login' ? 'Tizimga muvaffaqiyatli kirdingiz.' : 'Ro\'yxatdan o\'tish muvaffaqiyatli.',
        });
        setStep('complete');
      } catch (err) {
        debugError('OTP Verify Error]', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.otp, state.phone, mode, clearMessages, setPartialState, t, establishApiSession]
  );

  const showDebugBanner = import.meta.env.VITE_SHOW_DEBUG_BANNER === 'true';
  const formattedPhone = authService.normalizePhoneNumber(state.phone);

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
            {step !== 'phone' && (
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
                {step === 'phone' && (mode === 'login' ? 'Telefon raqamingiz orqali kirish' : 'Telefon raqamingiz orqali roʻyxatdan oʻtish')}
                {step === 'otp' && 'SMS orqali kelgan OTP kodini kiriting'}
                {step === 'complete' && 'Tayyor!'}
              </p>
            </div>

            {step === 'phone' && (
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
                    Telefon raqami
                  </label>
                  <input
                    type="tel"
                    value={state.phone}
                    onChange={(e) => {
                      clearMessages();
                      setPartialState({ phone: formatPhoneNumber(e.target.value) });
                    }}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                  />
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
                    'OTP kodini olish'
                  )}
                </button>
              </form>
            )}

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
                    {formattedPhone} raqamiga yuborilgan kod
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

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={state.loading || state.resendSeconds > 0}
                  className="w-full text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium py-2"
                >
                  {state.resendSeconds > 0
                    ? `Qayta yuborish (${state.resendSeconds}s)`
                    : 'OTP kodini qayta yuborish'}
                </button>
              </form>
            )}

            {step === 'phone' && (
              <div className="text-center text-sm text-gray-500">
                {mode === 'login' ? (
                  <>
                    Akkauntingiz yo&apos;q?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone');
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
                        setStep('phone');
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
