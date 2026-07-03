import { debugLogger } from '../lib/debugLogger';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle,
  Loader,
  Mail,
  User,
  ArrowLeft,
  Lock,
  Phone,
} from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import {
  validatePhoneNumber,
  validateEmail,
  validateFullName,
  formatPhoneNumber,
} from '../lib/validation';
import RoleSelectionModal from '../components/RoleSelectionModal';
import { normalizeAuthCode } from '../lib/twoFactorUtils';

const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

type LoginMethod = 'password' | 'google' | 'magic';
type RegisterStep = 'form' | 'twoFactorOffer' | 'twoFactorSetup' | 'backupCodes';
type LoginStep = 'form';

type AuthState = {
  phoneNumber: string;
  email: string;
  password: string;
  passwordConfirm: string;
  fullName: string;
  selectedRole: 'worker' | 'employer';
  loading: boolean;
  error: string;
  success: string;
  magicLinkSent: boolean;
  qrCodeDataUrl: string;
  manualEntryKey: string;
  twoFactorCode: string;
  backupCodes: string[];
};

const initialState: AuthState = {
  phoneNumber: '',
  email: '',
  password: '',
  passwordConfirm: '',
  fullName: '',
  selectedRole: 'worker',
  loading: false,
  error: '',
  success: '',
  magicLinkSent: false,
  qrCodeDataUrl: '',
  manualEntryKey: '',
  twoFactorCode: '',
  backupCodes: [],
};

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    profile,
    loading: authLoading,
    userRole,
    requiresTwoFactor,
    isTwoFactorVerified,
    refreshProfile,
  } = useAuth();
  const { t } = useTranslation();

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('mode') === 'login' ? 'login' : 'register';
  }, [location.search]);

  const [state, setState] = useState<AuthState>(initialState);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  const setPartialState = useCallback((patch: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearMessages = useCallback(() => {
    setPartialState({ error: '', success: '' });
  }, [setPartialState]);

  // Complete magic link sign-in when user returns via email link
  useEffect(() => {
    const completeMagicLink = async () => {
      const result = await authService.completeEmailLinkSignIn(window.location.href);
      if (!result.success) return;
      if (result.needsRoleSelection) {
        setShowRoleSelection(true);
        return;
      }
      await refreshProfile();
    };
    void completeMagicLink();
  }, [refreshProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile || !profile.role) return;
    if (requiresTwoFactor && !isTwoFactorVerified) {
      navigate('/auth/2fa', { replace: true });
      return;
    }
    navigate(getRoleRedirectPath(userRole), { replace: true });
  }, [authLoading, user, profile, userRole, requiresTwoFactor, isTwoFactorVerified, navigate]);

  const handlePasswordLogin = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      clearMessages();

      const phoneValidation = validatePhoneNumber(state.phoneNumber);
      if (!phoneValidation.isValid) {
        setPartialState({ error: phoneValidation.error || t('auth.error_phone_format') });
        return;
      }

      if (!state.password) {
        setPartialState({ error: t('auth.password') + ' talab qilinadi.' });
        return;
      }

      setPartialState({ loading: true });
      const result = await authService.loginWithPassword({
        phoneNumber: formatPhoneNumber(state.phoneNumber),
        password: state.password,
      });
      setPartialState({ loading: false });

      if (!result.success) {
        setPartialState({ error: result.error || t('auth.unexpected_error') });
        return;
      }

      await refreshProfile();
    },
    [state.phoneNumber, state.password, clearMessages, setPartialState, refreshProfile, t]
  );

  const handleGoogleLogin = useCallback(async () => {
    clearMessages();
    setPartialState({ loading: true });
    const result = await authService.signInWithGoogle();
    setPartialState({ loading: false });

    if (!result.success) {
      setPartialState({ error: result.error || t('auth.error_google') });
      return;
    }

    if (result.needsRoleSelection) {
      setShowRoleSelection(true);
      return;
    }

    await refreshProfile();
  }, [clearMessages, setPartialState, refreshProfile, t]);

  const handleMagicLink = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      clearMessages();

      const emailValidation = validateEmail(state.email);
      if (!emailValidation.isValid) {
        setPartialState({ error: emailValidation.error || "Email noto'g'ri." });
        return;
      }

      setPartialState({ loading: true });
      const result = await authService.sendEmailLink(state.email, state.fullName || state.email);
      setPartialState({ loading: false });

      if (!result.success) {
        setPartialState({ error: result.error || t('auth.unexpected_error') });
        return;
      }

      setPartialState({
        success: 'Kirish havolasi emailingizga yuborildi. Xatdagi linkni oching.',
        magicLinkSent: true,
      });
    },
    [state.email, state.fullName, clearMessages, setPartialState, t]
  );

  const handleRegister = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      clearMessages();

      const phoneValidation = validatePhoneNumber(state.phoneNumber);
      if (!phoneValidation.isValid) {
        setPartialState({ error: phoneValidation.error || t('auth.error_phone_format') });
        return;
      }

      const emailValidation = validateEmail(state.email);
      if (!emailValidation.isValid) {
        setPartialState({ error: emailValidation.error || "Email noto'g'ri." });
        return;
      }

      const nameValidation = validateFullName(state.fullName);
      if (!nameValidation.isValid) {
        setPartialState({ error: nameValidation.error || "Ism noto'g'ri." });
        return;
      }

      if (state.password !== state.passwordConfirm) {
        setPartialState({ error: 'Parollar mos kelmaydi.' });
        return;
      }

      setPartialState({ loading: true });
      const result = await authService.registerWithPassword({
        phoneNumber: formatPhoneNumber(state.phoneNumber),
        email: state.email.trim(),
        fullName: state.fullName.trim(),
        password: state.password,
        role: state.selectedRole,
      });
      setPartialState({ loading: false });

      if (!result.success) {
        setPartialState({ error: result.error || t('auth.demo_register_error') });
        return;
      }

      await refreshProfile();
      setRegisterStep('twoFactorOffer');
    },
    [state, clearMessages, setPartialState, refreshProfile, t]
  );

  const handleStartTwoFactorSetup = useCallback(async () => {
    setPartialState({ loading: true, error: '' });
    const result = await authService.startTwoFactorEnrollment();
    setPartialState({ loading: false });

    if (!result.success || !result.qrCodeDataUrl) {
      setPartialState({ error: result.error || '2FA sozlashda xatolik.' });
      return;
    }

    setPartialState({
      qrCodeDataUrl: result.qrCodeDataUrl,
      manualEntryKey: result.manualEntryKey || '',
    });
    setRegisterStep('twoFactorSetup');
  }, [setPartialState]);

  const handleConfirmTwoFactor = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (state.twoFactorCode.length !== 6) {
        setPartialState({ error: '6 xonali kodni kiriting.' });
        return;
      }

      setPartialState({ loading: true, error: '' });
      const result = await authService.confirmTwoFactorEnrollment(state.twoFactorCode);
      setPartialState({ loading: false });

      if (!result.success) {
        setPartialState({ error: result.error || 'Tasdiqlash muvaffaqiyatsiz.' });
        return;
      }

      setPartialState({ backupCodes: result.backupCodes || [], success: '2FA muvaffaqiyatli yoqildi.' });
      setRegisterStep('backupCodes');
      await refreshProfile();
    },
    [state.twoFactorCode, setPartialState, refreshProfile]
  );

  const handleSkipTwoFactor = useCallback(() => {
    navigate(getRoleRedirectPath(state.selectedRole), { replace: true });
  }, [navigate, state.selectedRole]);

  const handleFinishRegistration = useCallback(() => {
    navigate(getRoleRedirectPath(state.selectedRole), { replace: true });
  }, [navigate, state.selectedRole]);

  const switchMode = (next: 'login' | 'register') => {
    navigate(`/auth?mode=${next}`, { replace: true });
    setState(initialState);
    setRegisterStep('form');
    setLoginMethod('password');
    clearMessages();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center px-4 py-8">
      {showRoleSelection && <RoleSelectionModal onComplete={() => setShowRoleSelection(false)} />}

      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
            </h1>
            <p className="text-gray-600 text-sm">
              {mode === 'login' ? t('auth.login_subtitle') : t('auth.register_subtitle')}
            </p>
          </div>

          <div className="flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-blue-700 shadow' : 'text-gray-600'
              }`}
            >
              {t('auth.login_btn')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'register' ? 'bg-white text-blue-700 shadow' : 'text-gray-600'
              }`}
            >
              {t('auth.register_btn')}
            </button>
          </div>

          {mode === 'login' && (
            <>
              <div className="flex gap-2">
                {(['password', 'google', 'magic'] as LoginMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setLoginMethod(method);
                      clearMessages();
                    }}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${
                      loginMethod === method
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {method === 'password' && t('auth.login_password')}
                    {method === 'google' && 'Google'}
                    {method === 'magic' && 'Magic link'}
                  </button>
                ))}
              </div>

              {loginMethod === 'password' && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('auth.phone')}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="tel"
                        value={state.phoneNumber}
                        onChange={(e) => setPartialState({ phoneNumber: e.target.value })}
                        placeholder={t('auth.phone_placeholder')}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                        disabled={state.loading}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('auth.password')}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        value={state.password}
                        onChange={(e) => setPartialState({ password: e.target.value })}
                        placeholder={t('auth.password_placeholder')}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                        disabled={state.loading}
                        autoComplete="current-password"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={state.loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition"
                  >
                    {state.loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader size={18} className="animate-spin" /> {t('auth.verifying')}
                      </span>
                    ) : (
                      t('auth.login_button')
                    )}
                  </button>
                </form>
              )}

              {loginMethod === 'google' && (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={state.loading}
                  className="w-full border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {state.loading ? <Loader size={18} className="animate-spin" /> : null}
                  {t('auth.google_login')}
                </button>
              )}

              {loginMethod === 'magic' && (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('auth.email')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        value={state.email}
                        onChange={(e) => setPartialState({ email: e.target.value })}
                        placeholder={t('auth.email_placeholder')}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                        disabled={state.loading || state.magicLinkSent}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={state.loading || state.magicLinkSent}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition"
                  >
                    {state.loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader size={18} className="animate-spin" /> {t('auth.sending')}
                      </span>
                    ) : (
                      'Kirish havolasini yuborish'
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {mode === 'register' && registerStep === 'form' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.full_name')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={state.fullName}
                    onChange={(e) => setPartialState({ fullName: e.target.value })}
                    placeholder={t('auth.name_placeholder')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    disabled={state.loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.phone')}</label>
                <input
                  type="tel"
                  value={state.phoneNumber}
                  onChange={(e) => setPartialState({ phoneNumber: e.target.value })}
                  placeholder={t('auth.phone_placeholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                  disabled={state.loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                <input
                  type="email"
                  value={state.email}
                  onChange={(e) => setPartialState({ email: e.target.value })}
                  placeholder={t('auth.email_placeholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                  disabled={state.loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                <input
                  type="password"
                  value={state.password}
                  onChange={(e) => setPartialState({ password: e.target.value })}
                  placeholder={t('auth.password_placeholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                  disabled={state.loading}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password_confirm')}</label>
                <input
                  type="password"
                  value={state.passwordConfirm}
                  onChange={(e) => setPartialState({ passwordConfirm: e.target.value })}
                  placeholder={t('auth.password_placeholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                  disabled={state.loading}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.role')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['worker', 'employer'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setPartialState({ selectedRole: role })}
                      className={`py-3 rounded-xl border font-medium text-sm transition ${
                        state.selectedRole === role
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {role === 'worker' ? t('auth.worker') : t('auth.employer')}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={state.loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition"
              >
                {state.loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size={18} className="animate-spin" /> {t('auth.saving')}
                  </span>
                ) : (
                  t('auth.register_button')
                )}
              </button>
            </form>
          )}

          {mode === 'register' && registerStep === 'twoFactorOffer' && (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Google Authenticator bilan qo&apos;shimcha himoya
              </h2>
              <p className="text-sm text-gray-600">
                Hisobingizni ixtiyoriy ravishda ikki bosqichli tasdiqlash bilan himoyalashingiz mumkin.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleStartTwoFactorSetup}
                  disabled={state.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
                >
                  Hozir sozlash
                </button>
                <button
                  type="button"
                  onClick={handleSkipTwoFactor}
                  className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl font-medium"
                >
                  Keyinroq
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && registerStep === 'twoFactorSetup' && (
            <form onSubmit={handleConfirmTwoFactor} className="space-y-4">
              <button
                type="button"
                onClick={() => setRegisterStep('twoFactorOffer')}
                className="flex items-center gap-2 text-blue-600 text-sm font-medium"
              >
                <ArrowLeft size={16} /> Orqaga
              </button>
              {state.qrCodeDataUrl && (
                <img
                  src={state.qrCodeDataUrl}
                  alt="2FA QR Code"
                  className="w-[220px] h-[220px] mx-auto border rounded-xl"
                />
              )}
              {state.manualEntryKey && (
                <p className="text-xs text-gray-500 text-center break-all font-mono">
                  Qo&apos;lda kiritish: {state.manualEntryKey}
                </p>
              )}
              <input
                type="text"
                inputMode="numeric"
                value={state.twoFactorCode}
                onChange={(e) => setPartialState({ twoFactorCode: normalizeAuthCode(e.target.value) })}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl font-mono tracking-widest"
              />
              <button
                type="submit"
                disabled={state.loading || state.twoFactorCode.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold"
              >
                {state.loading ? t('auth.verifying') : t('auth.verify')}
              </button>
            </form>
          )}

          {mode === 'register' && registerStep === 'backupCodes' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-900 mb-2">Zaxira kodlarni saqlab qo&apos;ying</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {state.backupCodes.map((code) => (
                    <span key={code}>{code}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleFinishRegistration}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
              >
                Davom etish
              </button>
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

          <p className="text-xs text-gray-500 text-center">{t('auth.terms')}</p>

          <div className="text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <>
                {t('auth.no_account')}{' '}
                <button type="button" onClick={() => switchMode('register')} className="text-blue-600 font-medium">
                  {t('auth.create_account')}
                </button>
              </>
            ) : registerStep === 'form' ? (
              <>
                {t('auth.have_account')}{' '}
                <button type="button" onClick={() => switchMode('login')} className="text-blue-600 font-medium">
                  {t('auth.login_button')}
                </button>
              </>
            ) : null}
          </div>

          <div className="text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Bosh sahifaga
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
