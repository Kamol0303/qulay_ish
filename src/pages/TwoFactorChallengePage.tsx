import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader, Shield, ArrowLeft } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import { normalizeBackupCode, normalizeAuthCode } from '../lib/twoFactorUtils';
import { markTwoFactorVerified } from '../lib/twoFactorStorage';

type ChallengeMode = 'authenticator' | 'backup';

export default function TwoFactorChallengePage() {
  const navigate = useNavigate();
  const { user, profile, userRole, loading, isTwoFactorVerified, signOut } = useAuth();
  const [mode, setMode] = useState<ChallengeMode>('authenticator');
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      navigate('/auth?mode=login', { replace: true });
      return;
    }
    if (isTwoFactorVerified) {
      navigate(getRoleRedirectPath(userRole), { replace: true });
    }
  }, [loading, user, profile, isTwoFactorVerified, userRole, navigate]);

  const handleVerifyAuthenticator = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError('');
      setSuccess('');

      if (!user || code.length !== 6) {
        setError('6 xonali kodni kiriting.');
        return;
      }

      setLoadingAction(true);
      const result = await authService.verifyTwoFactorChallenge(code);
      setLoadingAction(false);

      if (!result.success) {
        setError(result.error || 'Tasdiqlash muvaffaqiyatsiz.');
        return;
      }

      markTwoFactorVerified(user.uid, result.verifiedAt);
      setSuccess("Tasdiqlandi. Yo'naltirilmoqda...");
      navigate(getRoleRedirectPath(userRole), { replace: true });
    },
    [code, user, userRole, navigate]
  );

  const handleVerifyBackup = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError('');
      setSuccess('');

      if (!user || backupCode.length < 9) {
        setError("Zaxira kodni to'liq kiriting.");
        return;
      }

      setLoadingAction(true);
      const result = await authService.verifyTwoFactorBackupCode(backupCode);
      setLoadingAction(false);

      if (!result.success) {
        setError(result.error || 'Zaxira kod noto\'g\'ri.');
        return;
      }

      markTwoFactorVerified(user.uid, result.verifiedAt);
      setSuccess('Kirish muvaffaqiyatli.');
      navigate(getRoleRedirectPath(userRole), { replace: true });
    },
    [backupCode, user, userRole, navigate]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft size={18} /> Chiqish
          </button>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-blue-700 font-semibold">
              <Shield size={22} />
              <span>Google Authenticator</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Ikkinchi bosqich tekshiruvi</h1>
            <p className="text-gray-600 text-sm">
              Hisobingizda 2FA yoqilgan. Davom etish uchun kodni kiriting.
            </p>
          </div>

          {mode === 'authenticator' ? (
            <form onSubmit={handleVerifyAuthenticator} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">6 xonali kod</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    setError('');
                    setCode(normalizeAuthCode(e.target.value));
                  }}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900 text-center text-2xl tracking-widest font-mono"
                  disabled={loadingAction}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
              <button
                type="submit"
                disabled={loadingAction || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition"
              >
                {loadingAction ? (
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
                  setMode('backup');
                  setError('');
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Zaxira koddan foydalanish
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyBackup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zaxira kod</label>
                <input
                  type="text"
                  value={backupCode}
                  onChange={(e) => {
                    setError('');
                    setBackupCode(normalizeBackupCode(e.target.value));
                  }}
                  placeholder="8DKA-21QW"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-900 text-center text-xl tracking-widest font-mono uppercase"
                  disabled={loadingAction}
                  maxLength={9}
                />
              </div>
              <button
                type="submit"
                disabled={loadingAction || backupCode.length < 9}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition"
              >
                {loadingAction ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
                  </span>
                ) : (
                  'Zaxira kod bilan kirish'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('authenticator');
                  setError('');
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Authenticator kodiga qaytish
              </button>
            </form>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
