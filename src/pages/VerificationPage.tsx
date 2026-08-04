import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { VerificationRequest } from '../types';
import { SecureImage } from '../components/verification/SecureMedia';
import { VerificationStatusCard } from '../components/verification/VerificationStatusCard';

type FormState = {
  idPhotoUrl: string;
  selfieUrl: string;
  addressProofUrl: string;
  additionalUrl: string;
};

export default function VerificationPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
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
      } catch {
        setRequest(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.uid]);

  const uploadField = async (file: File | undefined, field: keyof FormState, kind: string) => {
    if (!file) return;
    setUploading(field);
    setError('');
    try {
      const res = await api.uploads.upload(file, kind as 'verification');
      setFormData((prev) => ({ ...prev, [field]: res.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuklash xatosi');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!formData.idPhotoUrl || !formData.selfieUrl) {
      setError('ID hujjat va selfi majburiy');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        idPhotoUrl: formData.idPhotoUrl,
        documentUrl: formData.idPhotoUrl,
        selfieUrl: formData.selfieUrl,
        addressProofUrl: formData.addressProofUrl || undefined,
        additionalFiles: formData.additionalUrl
          ? [{ url: formData.additionalUrl, title: 'Qo\'shimcha hujjat' }]
          : undefined,
        documentType: 'id_card',
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
                      setFormData({
                        idPhotoUrl: '',
                        selfieUrl: '',
                        addressProofUrl: '',
                        additionalUrl: '',
                      });
                    }}
                    className="mt-4 rounded-2xl bg-primary px-8 py-3 font-bold text-primary-foreground"
                  >
                    {t('verification.try_again')}
                  </button>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Yuklangan pasport/ID/selfi faqat Super Adminga ko‘rinadi.
            </p>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-8 rounded-[2.5rem] border border-border bg-card p-8 shadow-sm">
              <UploadSlot
                title={`${t('verification.id_document')} (majburiy)`}
                desc={t('verification.id_desc')}
                icon={<FileText className="h-8 w-8" />}
                url={formData.idPhotoUrl}
                loading={uploading === 'idPhotoUrl'}
                onFile={(f) => void uploadField(f, 'idPhotoUrl', 'verification_id')}
                onClear={() => setFormData((p) => ({ ...p, idPhotoUrl: '' }))}
              />
              <UploadSlot
                title={`${t('verification.selfie_verification')} (majburiy)`}
                desc={t('verification.selfie_desc')}
                icon={<Camera className="h-8 w-8" />}
                url={formData.selfieUrl}
                loading={uploading === 'selfieUrl'}
                square
                onFile={(f) => void uploadField(f, 'selfieUrl', 'verification_selfie')}
                onClear={() => setFormData((p) => ({ ...p, selfieUrl: '' }))}
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
                disabled={submitting || !formData.idPhotoUrl || !formData.selfieUrl || Boolean(uploading)}
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
            accept="image/*,.pdf"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>
    </section>
  );
}
