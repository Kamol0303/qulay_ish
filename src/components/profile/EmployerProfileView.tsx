import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BadgeCheck,
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  Users,
} from 'lucide-react';
import type { Profile, ProfileTab, PortfolioItem, RecruiterContact } from '../../types';
import { getEmployerCompletion } from '../../lib/profileCompletion';
import { mediaUrl } from '../../lib/mediaUrl';
import { REGIONS, DISTRICTS } from '../../constants/locations';
import { getDistrictKey } from '../../lib/utils';
import { ProfileTabs } from './ProfileTabs';
import { ProfileProgress } from './ProfileProgress';
import { ProfileCard, EmptyState } from './ProfileCard';
import { AvatarUploader, CoverUploader, FileUploadButton } from './MediaUploader';
import { VerificationStatusCard } from '../verification/VerificationStatusCard';
import { Link } from 'react-router-dom';

const EMPLOYER_TABS = [
  { id: 'overview' as const, label: 'Kompaniya' },
  { id: 'company' as const, label: 'Yuridik' },
  { id: 'portfolio' as const, label: 'Galereya' },
  { id: 'certificates' as const, label: 'Hujjatlar' },
  { id: 'settings' as const, label: 'Sozlamalar' },
];

function newId() {
  return crypto.randomUUID?.() || `${Date.now()}`;
}

export function EmployerProfileView({
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
  const completion = useMemo(() => getEmployerCompletion(draft), [draft]);
  const districts = DISTRICTS[getDistrictKey(draft.region)] || [];
  const companyTitle = draft.companyName || draft.fullName;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CoverUploader
        coverUrl={draft.coverUrl}
        editable={editable}
        onChange={(coverUrl) => patch({ coverUrl })}
      >
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end">
          <AvatarUploader
            name={companyTitle}
            photoUrl={draft.photoUrl}
            editable={editable}
            onChange={(photoUrl) => patch({ photoUrl })}
          />
          <div className="min-w-0 flex-1 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold md:text-3xl">{companyTitle}</h1>
              {draft.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-xs font-semibold">
                  <BadgeCheck className="h-3.5 w-3.5" /> Tasdiqlangan
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/85">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {draft.businessType || draft.industry || 'Kompaniya'}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {draft.officeAddress || [draft.region, draft.district].filter(Boolean).join(', ') || 'Manzil'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {draft.employeeCount || '—'} xodim
              </span>
            </p>
          </div>
        </div>
      </CoverUploader>

      <VerificationStatusCard profile={draft} showAction={editable} />

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

      {(error || success) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error || success}
        </div>
      )}

      <ProfileTabs tabs={EMPLOYER_TABS} active={tab} onChange={setTab} />

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {tab === 'overview' && (
          <>
            <ProfileProgress percent={completion.percent} items={completion.items} />
            <ProfileCard title="Kompaniya haqida">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Kompaniya nomi" value={draft.companyName} editable={editable} onChange={(companyName) => patch({ companyName })} />
                <Input label="Biznes turi" value={draft.businessType} editable={editable} onChange={(businessType) => patch({ businessType })} />
                <Input label="Soha" value={draft.industry} editable={editable} onChange={(industry) => patch({ industry })} />
                <Input label="Tashkil etilgan yil" value={draft.foundedYear} editable={editable} onChange={(foundedYear) => patch({ foundedYear })} />
                <Input label="Xodimlar soni" value={draft.employeeCount} editable={editable} onChange={(employeeCount) => patch({ employeeCount })} />
                <Input label="Veb-sayt" value={draft.website} editable={editable} onChange={(website) => patch({ website })} />
              </div>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-muted-foreground">Tavsif</span>
                <textarea
                  disabled={!editable}
                  value={draft.bio || draft.professionalSummary || ''}
                  onChange={(e) => patch({ bio: e.target.value, professionalSummary: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
            </ProfileCard>
            <ProfileCard title="Aloqa">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input icon={<Phone className="h-4 w-4" />} label="Telefon" value={draft.phoneNumber} editable={editable} onChange={(phoneNumber) => patch({ phoneNumber })} />
                <Input icon={<Mail className="h-4 w-4" />} label="Email" value={draft.email} editable={editable} onChange={(email) => patch({ email })} />
                <Input icon={<Send className="h-4 w-4" />} label="Telegram" value={draft.telegram} editable={editable} onChange={(telegram) => patch({ telegram })} />
                <Input icon={<Globe className="h-4 w-4" />} label="Sayt" value={draft.website} editable={editable} onChange={(website) => patch({ website })} />
                <Input label="Ofis manzili" value={draft.officeAddress} editable={editable} onChange={(officeAddress) => patch({ officeAddress })} className="sm:col-span-2" />
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Viloyat</span>
                  <select
                    disabled={!editable}
                    value={draft.region}
                    onChange={(e) => patch({ region: e.target.value, district: '' })}
                    className="w-full rounded-xl border border-border px-3 py-2"
                  >
                    <option value="">Tanlang</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
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
                    {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>
            </ProfileCard>
            <ProfileCard
              title="Rekruter kontaktlari"
              action={
                editable ? (
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    onClick={() =>
                      patch({
                        recruiterContacts: [
                          ...(draft.recruiterContacts || []),
                          { id: newId(), name: '', role: 'HR', phone: '', email: '' } as RecruiterContact,
                        ],
                      })
                    }
                  >
                    Qo\'shish
                  </button>
                ) : undefined
              }
            >
              {(draft.recruiterContacts || []).length === 0 ? (
                <EmptyState title="Kontakt yo'q" />
              ) : (
                <div className="space-y-3">
                  {(draft.recruiterContacts || []).map((c) => (
                    <div key={c.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                      <input disabled={!editable} value={c.name} placeholder="Ism" className="rounded-lg border px-3 py-2 text-sm" onChange={(e) => patch({ recruiterContacts: (draft.recruiterContacts || []).map((x) => x.id === c.id ? { ...x, name: e.target.value } : x) })} />
                      <input disabled={!editable} value={c.role || ''} placeholder="Lavozim" className="rounded-lg border px-3 py-2 text-sm" onChange={(e) => patch({ recruiterContacts: (draft.recruiterContacts || []).map((x) => x.id === c.id ? { ...x, role: e.target.value } : x) })} />
                      <input disabled={!editable} value={c.phone || ''} placeholder="Telefon" className="rounded-lg border px-3 py-2 text-sm" onChange={(e) => patch({ recruiterContacts: (draft.recruiterContacts || []).map((x) => x.id === c.id ? { ...x, phone: e.target.value } : x) })} />
                      <input disabled={!editable} value={c.email || ''} placeholder="Email" className="rounded-lg border px-3 py-2 text-sm" onChange={(e) => patch({ recruiterContacts: (draft.recruiterContacts || []).map((x) => x.id === c.id ? { ...x, email: e.target.value } : x) })} />
                    </div>
                  ))}
                </div>
              )}
            </ProfileCard>
          </>
        )}

        {tab === 'company' && (
          <ProfileCard title="Yuridik ma'lumotlar">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="INN / TIN" value={draft.tin} editable={editable} onChange={(tin) => patch({ tin })} />
              <Input label="Ro'yxat raqami" value={draft.registrationNumber} editable={editable} onChange={(registrationNumber) => patch({ registrationNumber })} />
              <Input label="Mas'ul shaxs" value={draft.fullName} editable={editable} onChange={(fullName) => patch({ fullName })} className="sm:col-span-2" />
            </div>
          </ProfileCard>
        )}

        {tab === 'portfolio' && (
          <ProfileCard
            title="Kompaniya galereyasi"
            action={
              editable ? (
                <FileUploadButton
                  label="Rasm / video"
                  accept="image/*,video/*"
                  kind="portfolio"
                  onUploaded={(file) => {
                    const item: PortfolioItem = {
                      id: newId(),
                      title: file.fileName,
                      fileUrl: file.url,
                      fileName: file.fileName,
                      mimeType: file.mimeType,
                      kind: file.mimeType.startsWith('video') ? 'video' : 'image',
                    };
                    patch({ companyGallery: [...(draft.companyGallery || []), item] });
                  }}
                />
              ) : undefined
            }
          >
            {(draft.companyGallery || []).length === 0 ? (
              <EmptyState title="Galereya bo'sh" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {(draft.companyGallery || []).map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border">
                    <img src={mediaUrl(item.fileUrl)} alt={item.title} className="h-36 w-full object-cover" />
                    {editable && (
                      <button
                        type="button"
                        className="w-full py-2 text-xs text-destructive"
                        onClick={() => patch({ companyGallery: (draft.companyGallery || []).filter((g) => g.id !== item.id) })}
                      >
                        O\'chirish
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ProfileCard>
        )}

        {tab === 'certificates' && (
          editable ? (
            <ProfileCard
              title="Ichki kompaniya fayllari"
              action={
                <FileUploadButton
                  label="Hujjat yuklash"
                  accept=".pdf,image/*"
                  kind="document"
                  onUploaded={(file) => {
                    patch({
                      companyDocuments: [
                        ...(draft.companyDocuments || []),
                        { id: newId(), title: file.fileName, fileUrl: file.url, fileName: file.fileName, mimeType: file.mimeType },
                      ],
                    });
                  }}
                />
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                Pasport, litsenziya va soliq hujjatlari ommaga ko‘rinmaydi. Shaxsni tasdiqlash — «Shaxsni tasdiqlash» bo‘limida.
              </p>
              {(draft.companyDocuments || []).length === 0 ? (
                <EmptyState title="Hujjat yo'q" />
              ) : (
                <ul className="space-y-2">
                  {(draft.companyDocuments || []).map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                      <a href={mediaUrl(doc.fileUrl)} target="_blank" rel="noreferrer" className="truncate hover:underline">{doc.title}</a>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() => patch({ companyDocuments: (draft.companyDocuments || []).filter((d) => d.id !== doc.id) })}
                      >
                        O\'chirish
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ProfileCard>
          ) : (
            <ProfileCard title="Tasdiqlash holati">
              <VerificationStatusCard profile={draft} showAction={false} />
              <p className="mt-3 text-xs text-muted-foreground">
                Ro‘yxatdan o‘tish, pasport va soliq hujjatlari faqat Super Admin panelida ko‘rinadi.
              </p>
            </ProfileCard>
          )
        )}

        {tab === 'settings' && (
          <ProfileCard title="Kompaniya sozlamalari">
            <p className="text-sm text-muted-foreground">
              Bildirishnomalar va maxfiylik sozlamalari platforma sozlamalaridan boshqariladi.
            </p>
            <Link to="/verification" className="mt-3 inline-flex text-sm text-primary hover:underline">
              Shaxsni tasdiqlash →
            </Link>
          </ProfileCard>
        )}
      </motion.div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  editable,
  icon,
  className,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  editable?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <label className={`text-sm ${className || ''}`}>
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

