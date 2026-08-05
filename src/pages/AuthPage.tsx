import { debugLogger } from '../lib/debugLogger';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Loader, Mail, User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import {
  validatePhoneNumber,
  validateFullName,
  formatPhoneNumber,
  validatePassword,
  validatePasswordConfirm,
} from '../lib/validation';

const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

type AuthMode = 'login' | 'register' | 'forgot';
type AuthStep = 'form' | 'otp' | 'newPassword' | 'complete';

type AuthState = {
  phone: string;
  otp: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  selectedRole: 'worker' | 'employer';
  loading: boolean;
  error: string;
  success: string;
  resendSeconds: number;
  fieldErrors: {
    fullName?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    otp?: string;
  };
};

const initialState: AuthState = {
  phone: '',
  otp: '',
  fullName: '',
  password: '',
  confirmPassword: '',
  selectedRole: 'worker',
  loading: false,
  error: '',
  success: '',
  resendSeconds: 0,
  fieldErrors: {},
};

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading, userRole, setAuthProfile } = useAuth();
  const { t } = useTranslation();

  const mode = useMemo<AuthMode>(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('mode');
    if (value === 'login') return 'login';
    if (value === 'forgot') return 'forgot';
    return 'register';
  }, [location.search]);

  const [state, setState] = useState<AuthState>(initialState);
  const [step, setStep] = useState<AuthStep>('form');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const setPartialState = useCallback((patch: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // Persisted JWT session → skip auth form and go to dashboard
  useEffect(() => {
    if (authLoading) return;
    if (mode === 'forgot') return;
    if (!user || !profile || !profile.role) return;
    const redirectPath = getRoleRedirectPath(userRole);
    navigate(redirectPath, { replace: true });
  }, [authLoading, user, profile, userRole, navigate, mode]);

  // Reset form when switching modes via URL
  useEffect(() => {
    setState(initialState);
    setStep('form');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

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
      setStep('form');
      // Keep register password fields so user can resend OTP without retyping
      setPartialState({
        otp: '',
        resendSeconds: 0,
        ...(mode === 'forgot' ? { password: '', confirmPassword: '' } : {}),
      });
      return;
    }
    if (step === 'newPassword') {
      setStep('form');
      setPartialState({ otp: '', password: '', confirmPassword: '', resendSeconds: 0 });
      return;
    }
    if (mode === 'forgot') {
      navigate('/auth?mode=login');
    }
  }, [step, mode, clearMessages, setPartialState, navigate]);

  const handleLogin = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      const fieldErrors: AuthState['fieldErrors'] = {};
      const phoneValidation = validatePhoneNumber(state.phone);
      if (!phoneValidation.isValid) {
        fieldErrors.phone = phoneValidation.error || 'Telefon raqami noto\'g\'ri.';
      }
      const passwordValidation = validatePassword(state.password);
      if (!passwordValidation.isValid) {
        fieldErrors.password = passwordValidation.error || '';
      }
      if (Object.keys(fieldErrors).length > 0) {
        setPartialState({
          fieldErrors,
          error: Object.values(fieldErrors)[0] || 'Formani to\'ldiring',
        });
        return;
      }

      setPartialState({ loading: true, error: '', success: '', fieldErrors: {} });
      try {
        const result = await authService.loginWithPassword(state.phone, state.password);
        if (!result.success || !result.profile) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }
        setAuthProfile(result.profile);
        setPartialState({
          loading: false,
          success: 'Tizimga muvaffaqiyatli kirdingiz.',
        });
        setStep('complete');
      } catch (err) {
        debugError('Login Error', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.phone, state.password, clearMessages, setPartialState, t, setAuthProfile],
  );

  /** Register step 1: send SMS OTP (user is NOT created until OTP is verified) */
  const requestRegisterOtp = useCallback(async () => {
    const fieldErrors: AuthState['fieldErrors'] = {};
    const phoneValidation = validatePhoneNumber(state.phone);
    if (!phoneValidation.isValid) {
      fieldErrors.phone = phoneValidation.error || 'Telefon raqami noto\'g\'ri.';
    }
    const fullNameValidation = validateFullName(state.fullName);
    if (!fullNameValidation.isValid) {
      fieldErrors.fullName = fullNameValidation.error || '';
    }
    const passwordValidation = validatePassword(state.password);
    if (!passwordValidation.isValid) {
      fieldErrors.password = passwordValidation.error || '';
    }
    const confirmValidation = validatePasswordConfirm(state.password, state.confirmPassword);
    if (!confirmValidation.isValid) {
      fieldErrors.confirmPassword = confirmValidation.error || '';
    }
    if (Object.keys(fieldErrors).length > 0) {
      setPartialState({
        fieldErrors,
        error: Object.values(fieldErrors)[0] || 'Formani to\'ldiring',
      });
      return false;
    }

    setPartialState({ loading: true, error: '', success: '', fieldErrors: {} });
    try {
      const result = await authService.sendOtp({
        phone: state.phone,
        purpose: 'register',
        fullName: state.fullName.trim(),
        role: state.selectedRole,
        password: state.password,
      });
      if (!result.success) {
        setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
        return false;
      }
      setPartialState({
        loading: false,
        success: 'OTP kodi SMS orqali yuborildi. Telefonni tasdiqlang.',
        resendSeconds: 60,
      });
      setStep('otp');
      return true;
    } catch (err) {
      debugError('Register OTP Error', err);
      setPartialState({ loading: false, error: t('auth.unexpected_error') });
      return false;
    }
  }, [
    state.phone,
    state.password,
    state.confirmPassword,
    state.fullName,
    state.selectedRole,
    setPartialState,
    t,
  ]);

  const handleRegister = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();
      await requestRegisterOtp();
    },
    [clearMessages, requestRegisterOtp],
  );

  /** Register step 2: verify OTP → create user in DB + login */
  const handleVerifyRegisterOtp = useCallback(
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
        if (!result.success || !result.profile) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }
        setAuthProfile(result.profile);
        setPartialState({
          loading: false,
          success: 'Telefon tasdiqlandi. Ro\'yxatdan o\'tish muvaffaqiyatli.',
        });
        setStep('complete');
      } catch (err) {
        debugError('Register OTP Verify Error', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.otp, state.phone, clearMessages, setPartialState, t, setAuthProfile],
  );

  const requestResetOtp = useCallback(async () => {
    const phoneValidation = validatePhoneNumber(state.phone);
    if (!phoneValidation.isValid) {
      setPartialState({
        fieldErrors: { phone: phoneValidation.error || 'Telefon raqami noto\'g\'ri.' },
        error: phoneValidation.error || 'Telefon raqami noto\'g\'ri.',
      });
      return false;
    }

    setPartialState({ loading: true, error: '', success: '', fieldErrors: {} });
    try {
      const result = await authService.sendOtp({
        phone: state.phone,
        purpose: 'reset',
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
      debugError('Reset OTP Error', err);
      setPartialState({ loading: false, error: t('auth.unexpected_error') });
      return false;
    }
  }, [state.phone, setPartialState, t]);

  const handleForgotPhone = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();
      await requestResetOtp();
    },
    [clearMessages, requestResetOtp],
  );

  const handleResendOTP = useCallback(async () => {
    if (state.resendSeconds > 0 || state.loading) return;
    clearMessages();
    if (mode === 'register') {
      await requestRegisterOtp();
      return;
    }
    await requestResetOtp();
  }, [state.resendSeconds, state.loading, clearMessages, mode, requestRegisterOtp, requestResetOtp]);

  const handleVerifyResetOtp = useCallback(
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
        if (!result.success || !result.resetAllowed) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }
        setPartialState({
          loading: false,
          success: 'Telefon tasdiqlandi. Yangi parol kiriting.',
          password: '',
          confirmPassword: '',
        });
        setStep('newPassword');
      } catch (err) {
        debugError('Reset OTP Verify Error', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.otp, state.phone, clearMessages, setPartialState, t],
  );

  const handleResetPassword = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearMessages();

      const fieldErrors: AuthState['fieldErrors'] = {};
      const passwordValidation = validatePassword(state.password);
      if (!passwordValidation.isValid) {
        fieldErrors.password = passwordValidation.error || '';
      }
      const confirmValidation = validatePasswordConfirm(state.password, state.confirmPassword);
      if (!confirmValidation.isValid) {
        fieldErrors.confirmPassword = confirmValidation.error || '';
      }
      if (Object.keys(fieldErrors).length > 0) {
        setPartialState({
          fieldErrors,
          error: Object.values(fieldErrors)[0] || 'Formani to\'ldiring',
        });
        return;
      }

      setPartialState({ loading: true, error: '', success: '', fieldErrors: {} });
      try {
        const result = await authService.resetPassword(state.phone, state.password);
        if (!result.success) {
          setPartialState({ loading: false, error: result.error || t('auth.unexpected_error') });
          return;
        }
        setPartialState({ loading: false });
        navigate('/auth?mode=login', {
          replace: true,
          state: { success: 'Parol yangilandi. Endi yangi parol bilan kiring.' },
        });
      } catch (err) {
        debugError('Reset Password Error', err);
        setPartialState({ loading: false, error: t('auth.unexpected_error') });
      }
    },
    [state.phone, state.password, state.confirmPassword, clearMessages, setPartialState, t, navigate],
  );

  // Show one-shot success flash from forgot-password redirect
  useEffect(() => {
    const flash = (location.state as { success?: string } | null)?.success;
    if (!flash) return;
    setPartialState({ success: flash });
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate, setPartialState]);

  const showDebugBanner = import.meta.env.VITE_SHOW_DEBUG_BANNER === 'true';
  const formattedPhone = authService.normalizePhoneNumber(state.phone);

  const title =
    mode === 'login' ? 'Kirish' : mode === 'forgot' ? 'Parolni tiklash' : 'Roʻyxatdan oʻtish';

  const subtitle = (() => {
    if (step === 'otp') return 'SMS orqali kelgan OTP kodini kiriting';
    if (step === 'newPassword') return 'Yangi parol yarating';
    if (step === 'complete') return 'Tayyor!';
    if (mode === 'login') return 'Telefon raqam va parol orqali kirish';
    if (mode === 'forgot') return 'Telefon raqamingizni kiriting — OTP faqat tiklash uchun';
    return 'Maʼlumotlarni toʻldiring — SMS orqali OTP tasdiqlash majburiy';
  })();

  const showBack = step !== 'form' || mode === 'forgot';

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
            {showBack && (
              <button
                type="button"
                onClick={handleGoBack}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-2"
              >
                <ArrowLeft size={18} /> Ortga
              </button>
            )}

            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-600">{subtitle}</p>
            </div>

            {/* LOGIN */}
            {mode === 'login' && step === 'form' && (
              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="auth-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon raqami
                  </label>
                  <input
                    id="auth-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={state.phone}
                    onChange={(e) => {
                      clearMessages();
                      const phone = formatPhoneNumber(e.target.value);
                      const v = validatePhoneNumber(phone);
                      setPartialState({
                        phone,
                        fieldErrors: {
                          ...state.fieldErrors,
                          phone: phone ? (v.isValid ? undefined : v.error) : undefined,
                        },
                      });
                    }}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                    aria-invalid={Boolean(state.fieldErrors.phone)}
                    required
                  />
                  {state.fieldErrors.phone && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Parol
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={state.password}
                      onChange={(e) => {
                        clearMessages();
                        const password = e.target.value;
                        const v = validatePassword(password);
                        setPartialState({
                          password,
                          fieldErrors: {
                            ...state.fieldErrors,
                            password: password ? (v.isValid ? undefined : v.error) : undefined,
                          },
                        });
                      }}
                      placeholder="Parolingizni kiriting"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                      minLength={8}
                      maxLength={128}
                      aria-invalid={Boolean(state.fieldErrors.password)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {state.fieldErrors.password && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.password}</p>
                  )}
                </div>

                <div className="flex justify-end -mt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/auth?mode=forgot')}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Parolni unutdingizmi?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={state.loading || state.password.length < 8}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" aria-hidden /> Kirilmoqda...
                    </span>
                  ) : (
                    'Kirish'
                  )}
                </button>
              </form>
            )}

            {/* REGISTER */}
            {mode === 'register' && step === 'form' && (
              <form onSubmit={handleRegister} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="auth-fullName" className="block text-sm font-medium text-gray-700 mb-1">
                    Toʻliq ismingiz
                  </label>
                  <input
                    id="auth-fullName"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    value={state.fullName}
                    onChange={(e) => {
                      clearMessages();
                      const fullName = e.target.value;
                      const v = validateFullName(fullName);
                      setPartialState({
                        fullName,
                        fieldErrors: {
                          ...state.fieldErrors,
                          fullName: fullName ? (v.isValid ? undefined : v.error) : undefined,
                        },
                      });
                    }}
                    placeholder="Ism Familiya"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                    aria-invalid={Boolean(state.fieldErrors.fullName)}
                    required
                  />
                  {state.fieldErrors.fullName && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-reg-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon raqami
                  </label>
                  <input
                    id="auth-reg-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={state.phone}
                    onChange={(e) => {
                      clearMessages();
                      const phone = formatPhoneNumber(e.target.value);
                      const v = validatePhoneNumber(phone);
                      setPartialState({
                        phone,
                        fieldErrors: {
                          ...state.fieldErrors,
                          phone: phone ? (v.isValid ? undefined : v.error) : undefined,
                        },
                      });
                    }}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                    aria-invalid={Boolean(state.fieldErrors.phone)}
                    required
                  />
                  {state.fieldErrors.phone && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Parol
                  </label>
                  <div className="relative">
                    <input
                      id="auth-reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={state.password}
                      onChange={(e) => {
                        clearMessages();
                        const password = e.target.value;
                        const v = validatePassword(password);
                        const c = validatePasswordConfirm(password, state.confirmPassword);
                        setPartialState({
                          password,
                          fieldErrors: {
                            ...state.fieldErrors,
                            password: password ? (v.isValid ? undefined : v.error) : undefined,
                            confirmPassword: state.confirmPassword
                              ? (c.isValid ? undefined : c.error)
                              : state.fieldErrors.confirmPassword,
                          },
                        });
                      }}
                      placeholder="Kamida 8 ta belgi"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                      minLength={8}
                      maxLength={128}
                      aria-invalid={Boolean(state.fieldErrors.password)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {state.fieldErrors.password ? (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.password}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Kamida 8 ta belgi</p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Parolni tasdiqlang
                  </label>
                  <div className="relative">
                    <input
                      id="auth-confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={state.confirmPassword}
                      onChange={(e) => {
                        clearMessages();
                        const confirmPassword = e.target.value;
                        const c = validatePasswordConfirm(state.password, confirmPassword);
                        setPartialState({
                          confirmPassword,
                          fieldErrors: {
                            ...state.fieldErrors,
                            confirmPassword: confirmPassword
                              ? (c.isValid ? undefined : c.error)
                              : undefined,
                          },
                        });
                      }}
                      placeholder="Parolni qayta kiriting"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                      minLength={8}
                      maxLength={128}
                      aria-invalid={Boolean(state.fieldErrors.confirmPassword)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      aria-label={showConfirmPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {state.fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.confirmPassword}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rolni tanlang</label>
                  <div className="grid grid-cols-2 gap-3" role="group" aria-label="Rolni tanlang">
                    <button
                      type="button"
                      onClick={() => setPartialState({ selectedRole: 'worker' })}
                      aria-pressed={state.selectedRole === 'worker'}
                      className={`p-4 rounded-xl font-semibold transition flex flex-col items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
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
                      aria-pressed={state.selectedRole === 'employer'}
                      className={`p-4 rounded-xl font-semibold transition flex flex-col items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        state.selectedRole === 'employer'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      <Mail size={18} /> Ish beruvchi
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    state.loading ||
                    state.password.length < 8 ||
                    state.password !== state.confirmPassword
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" aria-hidden /> Yuborilmoqda...
                    </span>
                  ) : (
                    'OTP kodini olish'
                  )}
                </button>
              </form>
            )}

            {/* FORGOT — phone */}
            {mode === 'forgot' && step === 'form' && (
              <form onSubmit={handleForgotPhone} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="auth-forgot-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon raqami
                  </label>
                  <input
                    id="auth-forgot-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={state.phone}
                    onChange={(e) => {
                      clearMessages();
                      const phone = formatPhoneNumber(e.target.value);
                      const v = validatePhoneNumber(phone);
                      setPartialState({
                        phone,
                        fieldErrors: {
                          ...state.fieldErrors,
                          phone: phone ? (v.isValid ? undefined : v.error) : undefined,
                        },
                      });
                    }}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                    disabled={state.loading}
                    aria-invalid={Boolean(state.fieldErrors.phone)}
                    required
                  />
                  {state.fieldErrors.phone && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.phone}</p>
                  )}
                </div>

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

            {/* REGISTER / FORGOT — OTP */}
            {(mode === 'register' || mode === 'forgot') && step === 'otp' && (
              <form
                onSubmit={mode === 'register' ? handleVerifyRegisterOtp : handleVerifyResetOtp}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OTP kodi (6 raqam)
                  </label>
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
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
                    aria-label="OTP kodi"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {formattedPhone} raqamiga yuborilgan kod
                    {mode === 'register'
                      ? '. Tasdiqlangandan keyin akkaunt bazaga saqlanadi.'
                      : ''}
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
                  ) : mode === 'register' ? (
                    'Tasdiqlash va roʻyxatdan oʻtish'
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

            {/* FORGOT — new password */}
            {mode === 'forgot' && step === 'newPassword' && (
              <form onSubmit={handleResetPassword} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="auth-new-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Yangi parol
                  </label>
                  <div className="relative">
                    <input
                      id="auth-new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={state.password}
                      onChange={(e) => {
                        clearMessages();
                        const password = e.target.value;
                        const v = validatePassword(password);
                        const c = validatePasswordConfirm(password, state.confirmPassword);
                        setPartialState({
                          password,
                          fieldErrors: {
                            ...state.fieldErrors,
                            password: password ? (v.isValid ? undefined : v.error) : undefined,
                            confirmPassword: state.confirmPassword
                              ? (c.isValid ? undefined : c.error)
                              : state.fieldErrors.confirmPassword,
                          },
                        });
                      }}
                      placeholder="Kamida 8 ta belgi"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-1 rounded-lg"
                      aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {state.fieldErrors.password ? (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.password}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Kamida 8 ta belgi</p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-new-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                    Parolni tasdiqlang
                  </label>
                  <div className="relative">
                    <input
                      id="auth-new-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={state.confirmPassword}
                      onChange={(e) => {
                        clearMessages();
                        const confirmPassword = e.target.value;
                        const c = validatePasswordConfirm(state.password, confirmPassword);
                        setPartialState({
                          confirmPassword,
                          fieldErrors: {
                            ...state.fieldErrors,
                            confirmPassword: confirmPassword
                              ? (c.isValid ? undefined : c.error)
                              : undefined,
                          },
                        });
                      }}
                      placeholder="Parolni qayta kiriting"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900"
                      disabled={state.loading}
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-1 rounded-lg"
                      aria-label={showConfirmPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {state.fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{state.fieldErrors.confirmPassword}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    state.loading ||
                    state.password.length < 8 ||
                    state.password !== state.confirmPassword
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" /> Saqlanmoqda...
                    </span>
                  ) : (
                    'Parolni saqlash'
                  )}
                </button>
              </form>
            )}

            {step === 'form' && (
              <div className="text-center text-sm text-gray-500">
                {mode === 'login' ? (
                  <>
                    Akkauntingiz yo&apos;q?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/auth?mode=register')}
                      className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Roʻyxatdan oʻtish
                    </button>
                  </>
                ) : mode === 'register' ? (
                  <>
                    Allaqachon akkauntingiz bor?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/auth?mode=login')}
                      className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Kirish
                    </button>
                  </>
                ) : (
                  <>
                    Parolni eslaysizmi?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/auth?mode=login')}
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
