import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BadgeCheck,
  Download,
  Mail,
  MapPin,
  Phone,
  Save,
  Share2,
  Send,
} from 'lucide-react';
import type { Profile, ProfileTab, CertificateRecord, PortfolioItem } from '../../types';
import { getWorkerCompletion } from '../../lib/profileCompletion';
import { downloadResumePdf, RESUME_TEMPLATES } from '../../lib/resumePdf';
import { mediaUrl } from '../../lib/mediaUrl';
import { PremiumResume } from '../resume/PremiumResume';
import { Link } from 'react-router-dom';
import { REGIONS, DISTRICTS } from '../../constants/locations';
import { getDistrictKey } from '../../lib/utils';
import { ProfileTabs } from './ProfileTabs';
import { ProfileProgress } from './ProfileProgress';
import { ProfileCard, EmptyState } from './ProfileCard';
import { AvatarUploader, CoverUploader, FileUploadButton } from './MediaUploader';
import { SkillsSelector } from './SkillsSelector';
import { EducationEditor, ExperienceEditor } from './TimelineEditors';
import { VerificationStatusCard } from '../verification/VerificationStatusCard';

const WORKER_TABS = [
  { id: 'overview' as const, label: 'Umumiy' },
  { id: 'experience' as const, label: 'Tajriba' },
  { id: 'education' as const, label: 'Ta\'lim' },
  { id: 'skills' as const, label: 'Ko\'nikmalar' },
  { id: 'portfolio' as const, label: 'Portfolio' },
  { id: 'certificates' as const, label: 'Sertifikatlar' },
  { id: 'resume' as const, label: 'Rezyume' },
  { id: 'settings' as const, label: 'Sozlamalar' },
];

function newId() {
  return crypto.randomUUID?.() || `${Date.now()}`;
}

export function WorkerProfileView({
  draft,
  patch,
  save,
  saving,
  error,
  success,
  editable = true,
}: {
  draft: Profile;
  patch: (p: Partial<Profile>) => void;
  save: () => Promise<void>;
  saving: boolean;
  error: string;
  success: string;
  editable?: boolean;
}) {
  const [tab, setTab] = useState<ProfileTab>('overview');
  const completion = useMemo(() => getWorkerCompletion(draft), [draft]);
  const districts = DISTRICTS[getDistrictKey(draft.region)] || [];

  const share = async () => {
    const url = `${window.location.origin}/worker/${draft.uid}`;
    if (navigator.share) {
      await navigator.share({ title: draft.fullName, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CoverUploader
        coverUrl={draft.coverUrl}
        editable={editable}
        onChange={(coverUrl) => patch({ coverUrl })}
      >
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end">
          <AvatarUploader
            name={draft.fullName}
            photoUrl={draft.photoUrl}
            editable={editable}
            onChange={(photoUrl) => patch({ photoUrl })}
          />
          <div className="min-w-0 flex-1 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{draft.fullName}</h1>
              {draft.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-xs font-semibold">
                  <BadgeCheck className="h-3.5 w-3.5" /> Tasdiqlangan
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[draft.region, draft.district].filter(Boolean).join(', ') || 'Manzil kiritilmagan'}
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                {draft.lookingForWork ? 'Ish qidiryapman' : 'Hozircha ochiq emas'}
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs capitalize">
                {draft.availability || 'available'}
              </span>
            </p>
          </div>
        </div>
      </CoverUploader>

      <VerificationStatusCard profile={draft} showAction={editable} />

      <div className="flex flex-wrap gap-2">
        {editable && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void downloadResumePdf(draft)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium"
        >
          <Download className="h-4 w-4" /> Rezyume
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium"
        >
          <Share2 className="h-4 w-4" /> Ulashish
        </button>
      </div>

      {(error || success) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {error || success}
        </div>
      )}

      <ProfileTabs tabs={WORKER_TABS} active={tab} onChange={setTab} />

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5"
      >
        {tab === 'overview' && (
          <>
            <ProfileProgress percent={completion.percent} items={completion.items} />
            <ProfileCard title="Professional summary">
              {editable ? (
                <textarea
                  value={draft.professionalSummary || ''}
                  onChange={(e) => patch({ professionalSummary: e.target.value })}
                  rows={4}
                  placeholder="Qisqa professional tavsif..."
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{draft.professionalSummary || '—'}</p>
              )}
            </ProfileCard>
            <ProfileCard title="Biografiya">
              {editable ? (
                <textarea
                  value={draft.bio || ''}
                  onChange={(e) => patch({ bio: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{draft.bio || '—'}</p>
              )}
            </ProfileCard>
            <ProfileCard title="Aloqa">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field icon={<Phone className="h-4 w-4" />} label="Telefon" value={draft.phoneNumber} editable={editable} onChange={(phoneNumber) => patch({ phoneNumber })} />
                <Field icon={<Mail className="h-4 w-4" />} label="Email" value={draft.email} editable={editable} onChange={(email) => patch({ email })} />
                <Field icon={<Send className="h-4 w-4" />} label="Telegram" value={draft.telegram} editable={editable} onChange={(telegram) => patch({ telegram })} />
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Afzal aloqa</span>
                  <select
                    disabled={!editable}
                    value={draft.preferredContact || 'phone'}
                    onChange={(e) => patch({ preferredContact: e.target.value })}
                    className="w-full rounded-xl border border-border px-3 py-2"
                  >
                    <option value="phone">Telefon</option>
                    <option value="email">Email</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </label>
              </div>
            </ProfileCard>
            <ProfileCard title="Shaxsiy ma'lumot">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">To\'liq ism</span>
                  <input
                    disabled={!editable}
                    value={draft.fullName}
                    onChange={(e) => patch({ fullName: e.target.value })}
                    className="w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Viloyat</span>
                  <select
                    disabled={!editable}
                    value={draft.region}
                    onChange={(e) => patch({ region: e.target.value, district: '' })}
                    className="w-full rounded-xl border border-border px-3 py-2"
                  >
                    <option value="">Tanlang</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Tuman</span>
                  <select
                    disabled={!editable}
                    value={draft.district || ''}
                    onChange={(e) => patch({ district: e.target.value })}
                    className="w-full rounded-xl border border-border px-3 py-2"
                  >
                    <option value="">Tanlang</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Tillar (vergul bilan)</span>
                  <input
                    disabled={!editable}
                    value={(draft.languages || []).join(', ')}
                    onChange={(e) =>
                      patch({
                        languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Holat</span>
                  <select
                    disabled={!editable}
                    value={draft.availability || 'available'}
                    onChange={(e) => patch({ availability: e.target.value })}
                    className="w-full rounded-xl border border-border px-3 py-2"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>
                {editable && (
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={draft.lookingForWork !== false}
                      onChange={(e) => patch({ lookingForWork: e.target.checked })}
                    />
                    Ish qidiryapman
                  </label>
                )}
              </div>
            </ProfileCard>
          </>
        )}

        {tab === 'experience' && (
          <ExperienceEditor
            value={draft.experience || []}
            editable={editable}
            onChange={(experience) => patch({ experience })}
          />
        )}
        {tab === 'education' && (
          <EducationEditor
            value={draft.education || []}
            editable={editable}
            onChange={(education) => patch({ education })}
          />
        )}
        {tab === 'skills' && (
          <ProfileCard title="Ko'nikmalar" description="Qidiruv, tavsiyalar va multi-select">
            <SkillsSelector
              value={draft.skills || []}
              editable={editable}
              onChange={(skills) => patch({ skills })}
            />
          </ProfileCard>
        )}
        {tab === 'portfolio' && (
          <ProfileCard
            title="Portfolio"
            action={
              editable ? (
                <FileUploadButton
                  label="Yuklash"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  kind="portfolio"
                  onUploaded={(file) => {
                    const kind = file.mimeType.startsWith('video')
                      ? 'video'
                      : file.mimeType.startsWith('image')
                        ? 'image'
                        : 'document';
                    const item: PortfolioItem = {
                      id: newId(),
                      title: file.fileName,
                      fileUrl: file.url,
                      fileName: file.fileName,
                      mimeType: file.mimeType,
                      kind,
                      createdAt: new Date().toISOString(),
                    };
                    patch({ portfolio: [...(draft.portfolio || []), item] });
                  }}
                />
              ) : undefined
            }
          >
            {(draft.portfolio || []).length === 0 ? (
              <EmptyState title="Portfolio bo'sh" description="Ish namunalarini yuklang" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {(draft.portfolio || []).map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-border">
                    {item.kind === 'image' ? (
                      <img src={mediaUrl(item.fileUrl)} alt={item.title} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-muted text-sm text-muted-foreground">
                        {item.kind.toUpperCase()}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 p-3">
                      <a href={mediaUrl(item.fileUrl)} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:underline">
                        {item.title}
                      </a>
                      {editable && (
                        <button
                          type="button"
                          className="text-xs text-destructive"
                          onClick={() => patch({ portfolio: (draft.portfolio || []).filter((p) => p.id !== item.id) })}
                        >
                          O\'chirish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ProfileCard>
        )}
        {tab === 'certificates' && (
          <ProfileCard
            title="Sertifikatlar"
            action={
              editable ? (
                <FileUploadButton
                  label="PDF / rasm"
                  accept="image/*,.pdf"
                  kind="certificate"
                  onUploaded={(file) => {
                    const cert: CertificateRecord = {
                      id: newId(),
                      title: file.fileName,
                      fileUrl: file.url,
                      fileName: file.fileName,
                      mimeType: file.mimeType,
                      issuedAt: new Date().toISOString().slice(0, 10),
                    };
                    patch({ certificates: [...(draft.certificates || []), cert] });
                  }}
                />
              ) : undefined
            }
          >
            {(draft.certificates || []).length === 0 ? (
              <EmptyState title="Sertifikat yo'q" />
            ) : (
              <ul className="space-y-2">
                {(draft.certificates || []).map((cert) => (
                  <li key={cert.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{cert.title}</p>
                      <p className="text-xs text-muted-foreground">{cert.issuedAt || ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={mediaUrl(cert.fileUrl)} target="_blank" rel="noreferrer" className="text-sm text-primary">
                        Ochish
                      </a>
                      {editable && (
                        <button
                          type="button"
                          className="text-sm text-destructive"
                          onClick={() =>
                            patch({ certificates: (draft.certificates || []).filter((c) => c.id !== cert.id) })
                          }
                        >
                          O\'chirish
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ProfileCard>
        )}
        {tab === 'resume' && (
          <div className="space-y-5">
            <ProfileCard title="Rezyume shabloni" description="Profil ma'lumotlari + yuklangan fayllar avtomatik chiqadi">
              <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {RESUME_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={!editable}
                    onClick={() => patch({ resumeTemplate: tpl.id })}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      draft.resumeTemplate === tpl.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className="font-semibold">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground">A4 · ATS-friendly · 2-column</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadResumePdf(draft)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  <Download className="h-4 w-4" /> PDF yuklab olish
                </button>
                <Link
                  to={`/resume/${draft.uid}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
                >
                  To\'liq sahifa
                </Link>
              </div>
            </ProfileCard>
            <PremiumResume profile={draft} />
          </div>
        )}
        {tab === 'settings' && (
          <ProfileCard title="Profil sozlamalari">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Til, bildirishnomalar va maxfiylik keyingi bosqichda kengaytiriladi.</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.lookingForWork !== false}
                  disabled={!editable}
                  onChange={(e) => patch({ lookingForWork: e.target.checked })}
                />
                Profil ochiq — ish beruvchilar ko\'rishi mumkin
              </label>
              <Link to="/verification" className="inline-flex text-primary hover:underline">
                Shaxsni tasdiqlash →
              </Link>
            </div>
          </ProfileCard>
        )}
      </motion.div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  editable,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  editable?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <input
        disabled={!editable}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border px-3 py-2"
      />
    </label>
  );
}
