import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { PassportData, VerificationRequest } from '../types';
import { SecureImage } from '../components/verification/SecureMedia';
import { VerificationStatusCard } from '../components/verification/VerificationStatusCard';
import { PASSPORT_FILL_PROMPT, VERIFICATION_REQUIRED_MESSAGE } from '../lib/verificationGate';

type FormState = {
  idPhotoUrl: string;
  selfieUrl: string;
  addressProofUrl: string;
  additionalUrl: string;
  passport: PassportData;
  idChecks?: unknown;
  selfieChecks?: unknown;
};

const emptyPassport = (): PassportData => ({
  series: '',
  number: '',
  pinfl: '',
  fullName: '',
  issueDate: '',
  expiryDate: '',
});

export default function VerificationPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const gateMessage =
    (location.state as { message?: string; prompt?: string } | null)?.message ||
    (location.state as { prompt?: string } | null)?.prompt ||
    '';

  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [forceForm, setForceForm] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    idPhotoUrl: '',
    selfieUrl: '',
    addressProofUrl: '',
    additionalUrl: '',
    passport: emptyPassport(),
  });

  const canResubmit =
    !request ||
    request.status === 'rejected' ||
    request.status === 'need_reupload';

  useEffect(() => {
    void (async () => {
      if (!profile?.uid) return;
      try {
        const mine = await api.verificationRequests.mine();
        setRequest(mine);
        if (mine?.passportData) {
          setFormData((prev) => ({
            ...prev,
            passport: { ...emptyPassport(), ...mine.passportData },
          }));
        } else if (profile.fullName) {
          setFormData((prev) => ({
            ...prev,
            passport: { ...prev.passport, fullName: profile.fullName },
          }));
        }
      } catch {
        setRequest(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.uid, profile?.fullName]);

  const uploadField = async (
    file: File | undefined,
    field: 'idPhotoUrl' | 'selfieUrl' | 'addressProofUrl' | 'additionalUrl',
    kind: string,
  ) => {
    if (!file) return;
    setUploading(field);
    setError('');
    try {
      const res = await api.uploads.upload(file, kind as 'verification');
      setFormData((prev) => ({
        ...prev,
        [field]: res.url,
        ...(field === 'idPhotoUrl'
          ? { idChecks: (res as { documentChecks?: unknown }).documentChecks }
          : {}),
        ...(field === 'selfieUrl'
          ? { selfieChecks: (res as { documentChecks?: unknown }).documentChecks }
          : {}),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuklash xatosi');
    } finally {
      setUploading(null);
    }
  };

  const setPassport = (patch: Partial<PassportData>) => {
    setFormData((prev) => ({ ...prev, passport: { ...prev.passport, ...patch } }));
  };

  const validatePassportLocal = (): string | null => {
    const p = formData.passport;
    if (!/^[A-Za-z]{2}$/.test(p.series.trim())) return 'Pasport seriyasi 2 ta harf (masalan: AA)';
    if (!/^\d{7}$/.test(p.number.trim())) return 'Pasport raqami 7 ta raqam bo\'lishi kerak';
    if (!/^\d{14}$/.test(p.pinfl.trim())) return 'JSHSHIR (PINFL) 14 ta raqam bo\'lishi kerak';
    if (p.fullName.trim().length < 3) return PASSPORT_FILL_PROMPT;
    if (!p.issueDate || !p.expiryDate) return 'Pasport berilgan va amal qilish sanalari majburiy';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!formData.idPhotoUrl || !formData.selfieUrl) {
      setError('ID hujjat va selfi majburiy');
      return;
    }
    const passportError = validatePassportLocal();
    if (passportError) {
      setError(passportError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const passport: PassportData = {
        series: formData.passport.series.trim().toUpperCase(),
        number: formData.passport.number.trim(),
        pinfl: formData.passport.pinfl.trim(),
        fullName: formData.passport.fullName.trim(),
        issueDate: formData.passport.issueDate,
        expiryDate: formData.passport.expiryDate,
      };
      const payload = {
        idPhotoUrl: formData.idPhotoUrl,
        documentUrl: formData.idPhotoUrl,
        selfieUrl: formData.selfieUrl,
        addressProofUrl: formData.addressProofUrl || undefined,
        additionalFiles: formData.additionalUrl
          ? [{ url: formData.additionalUrl, title: 'Qo\'shimcha hujjat' }]
          : undefined,
        documentType: 'passport',
        passportData: passport,
        documentChecks: {
          id: formData.idChecks,
          selfie: formData.selfieChecks,
        },
      };

      let next: VerificationRequest;
      if (request && (request.status === 'rejected' || request.status === 'need_reupload')) {
        next = await api.verificationRequests.update(request.id, payload);
      } else {
        next = await api.verificationRequests.create(payload);
      }
      setRequest(next);
      setForceForm(false);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuborishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const showForm = !request || forceForm;
  const passportReady = !validatePassportLocal();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 font-bold shadow-sm"
        >
          <ArrowLeft size={18} />
          {t('common.back')}
        </button>

        <div className="flex items-center gap-4">
          <div className="rounded-3xl bg-primary/10 p-4 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('verification.title')}</h2>
            <p className="mt-1 text-muted-foreground">
              {profile?.role === 'employer'
                ? 'Kompaniya / ish beruvchi shaxsni tasdiqlash'
                : t('verification.subtitle')}
            </p>
          </div>
        </div>

        {gateMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <p className="font-bold">{PASSPORT_FILL_PROMPT}</p>
            <p className="mt-1">{gateMessage === PASSPORT_FILL_PROMPT ? VERIFICATION_REQUIRED_MESSAGE : gateMessage}</p>
          </div>
        )}

        {profile && <VerificationStatusCard profile={profile} showAction={false} />}

        {request && !showForm && (
          <div className="space-y-6 rounded-[2.5rem] border border-border bg-card p-8 text-center shadow-sm">
            {(request.status === 'pending' || request.status === 'under_review') && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Clock className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold">{t('verification.pending_title')}</h3>
                <p className="mx-auto max-w-md text-muted-foreground">{t('verification.pending_desc')}</p>
                <div className="mx-auto grid max-w-md grid-cols-2 gap-4 pt-4">
                  <StatusSlot label={t('verification.id_submitted')} ok={Boolean(request.idPhotoUrl)} />
                  <StatusSlot label={t('verification.selfie_submitted')} ok={Boolean(request.selfieUrl)} />
                  <StatusSlot label="Pasport ma'lumotlari" ok={Boolean(request.passportData?.pinfl)} />
                </div>
              </>
            )}
            {request.status === 'verified' && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <ShieldCheck className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold">{t('verification.approved_title')}</h3>
                <p className="text-muted-foreground">{t('verification.approved_desc')}</p>
              </>
            )}
            {(request.status === 'rejected' || request.status === 'need_reupload') && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold">
                  {request.status === 'need_reupload' ? 'Qayta yuklash kerak' : t('verification.rejected_title')}
                </h3>
                <p className="text-muted-foreground">
                  {request.rejectionReason || request.reviewNote || t('verification.rejected_desc')}
                </p>
                {canResubmit && (
                  <button
                    type="button"
                    onClick={() => {
                      setForceForm(true);
                      setFormData((prev) => ({
                        ...prev,
                        idPhotoUrl: '',
                        selfieUrl: '',
                        addressProofUrl: '',
                        additionalUrl: '',
                        passport: request.passportData
                          ? { ...emptyPassport(), ...request.passportData }
                          : emptyPassport(),
                      }));
                    }}
                    className="mt-4 rounded-2xl bg-primary px-8 py-3 font-bold text-primary-foreground"
                  >
                    {t('verification.try_again')}
                  </button>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Pasport, ID va selfi hujjatlari faqat Super Admin panelida ko&apos;rinadi.
            </p>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6 rounded-[2.5rem] border border-border bg-card p-8 shadow-sm">
              <div>
                <h3 className="text-xl font-bold">Pasport ma&apos;lumotlari (majburiy)</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {PASSPORT_FILL_PROMPT}. Bu ma&apos;lumotlar ish beruvchilarga ko&apos;rinmaydi.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Seriya *"
                  value={formData.passport.series}
                  onChange={(v) => setPassport({ series: v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })}
                  placeholder="AA"
                />
                <Field
                  label="Raqam *"
                  value={formData.passport.number}
                  onChange={(v) => setPassport({ number: v.replace(/\D/g, '').slice(0, 7) })}
                  placeholder="1234567"
                />
                <Field
                  label="JSHSHIR (PINFL) *"
                  value={formData.passport.pinfl}
                  onChange={(v) => setPassport({ pinfl: v.replace(/\D/g, '').slice(0, 14) })}
                  placeholder="14 ta raqam"
                  className="sm:col-span-2"
                />
                <Field
                  label="To'liq ism (pasportdagidek) *"
                  value={formData.passport.fullName}
                  onChange={(v) => setPassport({ fullName: v })}
                  placeholder="ISM FAMILIYA"
                  className="sm:col-span-2"
                />
                <Field
                  label="Berilgan sana *"
                  type="date"
                  value={formData.passport.issueDate}
                  onChange={(v) => setPassport({ issueDate: v })}
                />
                <Field
                  label="Amal qilish muddati *"
                  type="date"
                  value={formData.passport.expiryDate}
                  onChange={(v) => setPassport({ expiryDate: v })}
                />
              </div>
            </div>

            <div className="space-y-8 rounded-[2.5rem] border border-border bg-card p-8 shadow-sm">
              <UploadSlot
                title={`1. ${t('verification.id_document')} (majburiy)`}
                desc={t('verification.id_desc')}
                icon={<FileText className="h-8 w-8" />}
                url={formData.idPhotoUrl}
                loading={uploading === 'idPhotoUrl'}
                onFile={(f) => void uploadField(f, 'idPhotoUrl', 'verification_id')}
                onClear={() => setFormData((p) => ({ ...p, idPhotoUrl: '', idChecks: undefined }))}
              />
              <UploadSlot
                title={`2. ${t('verification.selfie_verification')} (majburiy)`}
                desc={t('verification.selfie_desc')}
                icon={<Camera className="h-8 w-8" />}
                url={formData.selfieUrl}
                loading={uploading === 'selfieUrl'}
                square
                onFile={(f) => void uploadField(f, 'selfieUrl', 'verification_selfie')}
                onClear={() => setFormData((p) => ({ ...p, selfieUrl: '', selfieChecks: undefined }))}
              />
              <UploadSlot
                title="Manzil tasdiqlovchi hujjat (ixtiyoriy)"
                desc="Kommunal to‘lov yoki manzilni tasdiqlovchi boshqa hujjat"
                icon={<Upload className="h-8 w-8" />}
                url={formData.addressProofUrl}
                loading={uploading === 'addressProofUrl'}
                onFile={(f) => void uploadField(f, 'addressProofUrl', 'verification_address')}
                onClear={() => setFormData((p) => ({ ...p, addressProofUrl: '' }))}
              />
              <UploadSlot
                title="Qo‘shimcha hujjat (ixtiyoriy)"
                desc="Litsenziya, guvohnoma yoki boshqa fayl"
                icon={<FileText className="h-8 w-8" />}
                url={formData.additionalUrl}
                loading={uploading === 'additionalUrl'}
                onFile={(f) => void uploadField(f, 'additionalUrl', 'verification_extra')}
                onClear={() => setFormData((p) => ({ ...p, additionalUrl: '' }))}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !formData.idPhotoUrl ||
                  !formData.selfieUrl ||
                  !passportReady ||
                  Boolean(uploading)
                }
                className="rounded-2xl bg-primary px-12 py-4 font-bold text-primary-foreground shadow-xl disabled:opacity-50"
              >
                {submitting ? t('verification.submitting') : t('verification.submit_btn')}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function StatusSlot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/50 p-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      {ok ? (
        <CheckCircle className="mx-auto mt-2 h-5 w-5 text-green-500" />
      ) : (
        <Clock className="mx-auto mt-2 h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

function UploadSlot({
  title,
  desc,
  icon,
  url,
  loading,
  square,
  onFile,
  onClear,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  url: string;
  loading?: boolean;
  square?: boolean;
  onFile: (file?: File) => void;
  onClear?: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-bold">{title}</h3>
        {url && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
          >
            O‘chirish
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="relative">
        <div
          className={`${square ? 'aspect-square max-w-sm' : 'aspect-[4/3]'} flex flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed border-border bg-secondary/50`}
        >
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : url ? (
            <SecureImage url={url} alt={title} className="h-full w-full object-cover" />
          ) : (
            <>
              <div className="rounded-2xl bg-primary/10 p-4 text-primary">{icon}</div>
              <p className="text-sm font-bold text-muted-foreground">Fayl tanlang</p>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.pdf"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>
    </section>
  );
}
