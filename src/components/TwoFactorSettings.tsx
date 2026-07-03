import React, { useCallback, useState } from 'react';
import { AlertCircle, CheckCircle, Copy, Check, Loader, Shield } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { normalizeAuthCode } from '../lib/twoFactorUtils';
import { isTwoFactorEnabled } from '../lib/twoFactorStorage';

type SetupStep = 'idle' | 'qr' | 'backup';

export default function TwoFactorSettings() {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<SetupStep>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [manualEntryKey, setManualEntryKey] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  const enabled = isTwoFactorEnabled(profile);

  const handleStartEnrollment = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    const result = await authService.startTwoFactorEnrollment();
    setLoading(false);

    if (!result.success || !result.qrCodeDataUrl) {
      setError(result.error || '2FA sozlashda xatolik.');
      return;
    }

    setQrCodeDataUrl(result.qrCodeDataUrl);
    setManualEntryKey(result.manualEntryKey || '');
    setStep('qr');
  }, []);

  const handleConfirmEnrollment = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (code.length !== 6) {
        setError('6 xonali kodni kiriting.');
        return;
      }

      setLoading(true);
      setError('');
      const result = await authService.confirmTwoFactorEnrollment(code);
      setLoading(false);

      if (!result.success) {
        setError(result.error || 'Tasdiqlash muvaffaqiyatsiz.');
        return;
      }

      setBackupCodes(result.backupCodes || []);
      setStep('backup');
      setCode('');
      await refreshProfile();
    },
    [code, refreshProfile]
  );

  const handleDisable = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (disableCode.length !== 6) {
        setError("O'chirish uchun joriy 6 xonali kodni kiriting.");
        return;
      }

      setLoading(true);
      setError('');
      const result = await authService.disableTwoFactor(disableCode);
      setLoading(false);

      if (!result.success) {
        setError(result.error || "2FA o'chirishda xatolik.");
        return;
      }

      setSuccess("Ikki bosqichli autentifikatsiya o'chirildi.");
      setDisableCode('');
      setStep('idle');
      await refreshProfile();
    },
    [disableCode, refreshProfile]
  );

  const handleRegenerateBackupCodes = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (regenCode.length !== 6) {
        setError('Zaxira kodlarni yangilash uchun joriy kodni kiriting.');
        return;
      }

      setLoading(true);
      setError('');
      const result = await authService.regenerateTwoFactorBackupCodes(regenCode);
      setLoading(false);

      if (!result.success) {
        setError(result.error || 'Zaxira kodlarni yangilashda xatolik.');
        return;
      }

      setBackupCodes(result.backupCodes || []);
      setStep('backup');
      setRegenCode('');
      setSuccess('Yangi zaxira kodlar yaratildi.');
    },
    [regenCode]
  );

  const handleCopyBackupCodes = useCallback(async () => {
    if (backupCodes.length === 0) return;
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [backupCodes]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="text-blue-600" size={20} />
        <h2 className="text-lg font-semibold text-gray-900">Google Authenticator (2FA)</h2>
      </div>

      <p className="text-sm text-gray-600">
        Ixtiyoriy qo&apos;shimcha himoya. Yoqilganda har safar kirishda authenticator kodi so&apos;raladi.
      </p>

      {!enabled && step === 'idle' && (
        <button
          type="button"
          onClick={handleStartEnrollment}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium"
        >
          {loading ? 'Yuklanmoqda...' : '2FA ni yoqish'}
        </button>
      )}

      {!enabled && step === 'qr' && (
        <form onSubmit={handleConfirmEnrollment} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            {qrCodeDataUrl && (
              <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-[220px] h-[220px] border rounded-xl" />
            )}
            {manualEntryKey && (
              <p className="text-xs text-gray-500 text-center break-all font-mono">
                Qo&apos;lda kiritish: {manualEntryKey}
              </p>
            )}
            <p className="text-sm text-gray-600 text-center">
              Google Authenticator ilovasida QR kodni skanerlang
            </p>
          </div>

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
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size={18} className="animate-spin" /> Tekshirilmoqda...
              </span>
            ) : (
              'Tasdiqlash va yoqish'
            )}
          </button>
        </form>
      )}

      {!enabled && step === 'backup' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">Zaxira kodlar (bir marta)</p>
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
            onClick={() => {
              setStep('idle');
              setSuccess('Google Authenticator muvaffaqiyatli yoqildi.');
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
          >
            Tayyor
          </button>
        </div>
      )}

      {enabled && step !== 'backup' && (
        <div className="space-y-4">
          <p className="text-sm text-green-700 font-medium">2FA yoqilgan</p>

          <form onSubmit={handleDisable} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              value={disableCode}
              onChange={(e) => setDisableCode(normalizeAuthCode(e.target.value))}
              placeholder="O'chirish uchun kod"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-xl font-mono"
            />
            <button
              type="submit"
              disabled={loading || disableCode.length !== 6}
              className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-xl font-medium"
            >
              2FA ni o&apos;chirish
            </button>
          </form>

          <form onSubmit={handleRegenerateBackupCodes} className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">Zaxira kodlarni qayta generatsiya qilish</p>
            <input
              type="text"
              inputMode="numeric"
              value={regenCode}
              onChange={(e) => setRegenCode(normalizeAuthCode(e.target.value))}
              placeholder="Joriy kod"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-xl font-mono"
            />
            <button
              type="submit"
              disabled={loading || regenCode.length !== 6}
              className="px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl font-medium"
            >
              Zaxira kodlarni yangilash
            </button>
          </form>
        </div>
      )}

      {enabled && step === 'backup' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">Yangi zaxira kodlar</p>
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
            onClick={() => setStep('idle')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
          >
            Tayyor
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-sm text-red-800">
          <AlertCircle size={18} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2 text-sm text-green-800">
          <CheckCircle size={18} className="flex-shrink-0" />
          {success}
        </div>
      )}
    </div>
  );
}
