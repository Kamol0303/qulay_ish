import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Copy, Check, Loader, Shield, ArrowLeft } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { getRoleRedirectPath } from '../lib/roleRedirect';
import { normalizeAuthCode } from '../lib/twoFactorUtils';
import { requiresMandatoryTwoFactorSetup } from '../lib/twoFactorStorage';

type SetupStep = 'intro' | 'qr' | 'backup';

export default function TwoFactorSetupPage() {
  const navigate = useNavigate();
  const { user, profile, userRole, loading, signOut, refreshProfile } = useAuth();
  const mandatory = requiresMandatoryTwoFactorSetup(profile);

  const [step, setStep] = useState<SetupStep>(mandatory ? 'intro' : 'intro');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [manualEntryKey, setManualEntryKey] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      navigate('/auth?mode=login', { replace: true });
      return;
    }
    if (profile.twoFactorEnabled) {
      navigate(getRoleRedirectPath(userRole), { replace: true });
    }
  }, [loading, user, profile, userRole, navigate]);

  const handleStart = useCallback(async () => {
    setLoadingAction(true);
    setError('');
    const result = await authService.startTwoFactorEnrollment();
    setLoadingAction(false);

    if (!result.success || !result.qrCodeDataUrl) {
      setError(result.error || '2FA sozlashda xatolik.');
      return;
    }

    setQrCodeDataUrl(result.qrCodeDataUrl);
    setManualEntryKey(result.manualEntryKey || '');
    setStep('qr');
  }, []);

  const handleConfirm = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (code.length !== 6) {
        setError('6 xonali kodni kiriting.');
        return;
      }

      setLoadingAction(true);
      setError('');
      const result = await authService.confirmTwoFactorEnrollment(code);
      setLoadingAction(false);

      if (!result.success) {
        setError(result.error || 'Tasdiqlash muvaffaqiyatsiz.');
        return;
      }

      setBackupCodes(result.backupCodes || []);
      setStep('backup');
      await refreshProfile();
    },
    [code, refreshProfile]
  );

  const handleCopyBackupCodes = useCallback(async () => {
    if (backupCodes.length === 0) return;
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [backupCodes]);

  const handleFinish = useCallback(() => {
    navigate(getRoleRedirectPath(userRole), { replace: true });
  }, [navigate, userRole]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        {!mandatory && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Orqaga
          </button>
        )}

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-blue-700 font-semibold">
            <Shield size={22} />
            <span>Ikki bosqichli tasdiqlash</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mandatory ? 'Super Admin uchun majburiy' : 'Google Authenticator sozlash'}
          </h1>
          {mandatory && (
            <p className="text-sm text-red-600 font-medium">
              Super Admin hisobi uchun 2FA majburiy. Davom etish uchun sozlang.
            </p>
          )}
        </div>

        {step === 'intro' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Google Authenticator ilovasini o&apos;rnating va hisobingizni qo&apos;shimcha himoyalang.
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={loadingAction}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
            >
              {loadingAction ? 'Yuklanmoqda...' : 'Sozlashni boshlash'}
            </button>
            {mandatory && (
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Chiqish
              </button>
            )}
          </div>
        )}

        {step === 'qr' && (
          <form onSubmit={handleConfirm} className="space-y-4">
            {qrCodeDataUrl && (
              <img
                src={qrCodeDataUrl}
                alt="2FA QR Code"
                className="w-[220px] h-[220px] mx-auto border rounded-xl"
              />
            )}
            {manualEntryKey && (
              <p className="text-xs text-gray-500 text-center break-all font-mono">
                Qo&apos;lda kiritish: {manualEntryKey}
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(normalizeAuthCode(e.target.value))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl font-mono tracking-widest"
            />
            <button
              type="submit"
              disabled={loadingAction || code.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold"
            >
              {loadingAction ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
                </span>
              ) : (
                'Tasdiqlash'
              )}
            </button>
          </form>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">Zaxira kodlarni saqlab qo&apos;ying</p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleCopyBackupCodes}
                className="flex items-center gap-2 text-sm text-amber-800 font-medium"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Nusxa olindi' : 'Nusxalash'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
            >
              Davom etish
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-sm text-red-800">
            <AlertCircle size={18} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {step === 'backup' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2 text-sm text-green-800">
            <CheckCircle size={18} className="flex-shrink-0" />
            2FA muvaffaqiyatli yoqildi.
          </div>
        )}
      </div>
    </div>
  );
}
