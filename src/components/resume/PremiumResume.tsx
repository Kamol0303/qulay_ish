import type { ReactNode } from 'react';
import {
  BadgeCheck,
  Download,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Mail,
  MapPin,
  Package,
  Phone,
  Send,
} from 'lucide-react';
import type { Profile, ResumeTemplateId } from '../../types';
import { buildResumeModel, fileIconLabel, type ResumeFileItem } from '../../lib/resumeModel';
import { mediaUrl } from '../../lib/mediaUrl';
import { cn } from '../../lib/utils';

const ACCENTS: Record<string, string> = {
  minimal: 'from-slate-800 to-slate-700',
  professional: 'from-blue-700 to-blue-600',
  corporate: 'from-slate-900 to-slate-800',
  government: 'from-emerald-800 to-emerald-700',
  modern: 'from-cyan-700 to-cyan-600',
  creative: 'from-amber-700 to-orange-600',
};

function FileKindIcon({ kind }: { kind: ResumeFileItem['kind'] }) {
  if (kind === 'image') return <ImageIcon className="h-4 w-4" />;
  if (kind === 'video') return <Film className="h-4 w-4" />;
  if (kind === 'archive') return <Package className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function PremiumResume({
  profile,
  className,
  compact = false,
}: {
  profile: Profile;
  className?: string;
  compact?: boolean;
}) {
  const model = buildResumeModel(profile);
  const accent = ACCENTS[model.templateId] || ACCENTS.professional;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(model.verifyUrl)}`;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-white text-slate-900 shadow-xl print:shadow-none',
        className,
      )}
      id="premium-resume"
    >
      <div className={cn('grid md:grid-cols-[32%_68%]', compact && 'text-[13px]')}>
        {/* LEFT SIDEBAR */}
        <aside className={cn('bg-gradient-to-b text-white', accent)}>
          <div className="flex flex-col items-center px-5 pb-6 pt-8 text-center">
            {model.photoUrl ? (
              <img
                src={model.photoUrl}
                alt={model.fullName}
                className="h-28 w-28 rounded-full border-4 border-white/30 object-cover shadow-lg md:h-32 md:w-32"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/30 bg-white/15 text-3xl font-bold shadow-lg md:h-32 md:w-32">
                {model.initials}
              </div>
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              {model.lookingForWork ? 'Ish qidiryapman' : model.availability || 'Mavjud'}
            </p>
          </div>

          <div className="space-y-6 px-5 pb-8">
            <SidebarSection title="Aloqa">
              <ul className="space-y-2 text-sm text-white/90">
                {model.phone && (
                  <li className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="break-all">{model.phone}</span>
                  </li>
                )}
                {model.email && (
                  <li className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="break-all">{model.email}</span>
                  </li>
                )}
                {model.telegram && (
                  <li className="flex items-start gap-2">
                    <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="break-all">{model.telegram}</span>
                  </li>
                )}
                {model.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span>{model.address}</span>
                  </li>
                )}
              </ul>
            </SidebarSection>

            {model.skills.length > 0 && (
              <SidebarSection title="Ko'nikmalar">
                <div className="flex flex-wrap gap-1.5">
                  {model.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </SidebarSection>
            )}

            {model.languages.length > 0 && (
              <SidebarSection title="Tillar">
                <div className="space-y-3">
                  {model.languages.map((lang) => (
                    <div key={lang.name}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{lang.name}</span>
                        <span className="text-white/70">{lang.level}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${lang.level}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SidebarSection>
            )}

            {model.softSkills.length > 0 && (
              <SidebarSection title="Yumshoq ko'nikmalar">
                <div className="flex flex-wrap gap-1.5">
                  {model.softSkills.map((skill) => (
                    <span key={skill} className="rounded-full border border-white/25 px-2.5 py-1 text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </SidebarSection>
            )}

            {(model.interests.length > 0 || model.availability) && (
              <SidebarSection title="Shaxsiy">
                <ul className="space-y-1 text-sm text-white/85">
                  {model.availability && <li>Holat: {model.availability}</li>}
                  {model.lookingForWork && <li>Ish qidiryapman</li>}
                  {model.interests.map((i) => (
                    <li key={i}>• {i}</li>
                  ))}
                </ul>
              </SidebarSection>
            )}

            <SidebarSection title="QR tasdiqlash">
              <div className="rounded-xl bg-white p-2">
                <img src={qrSrc} alt="QR tasdiqlash" className="mx-auto h-28 w-28" />
              </div>
              <p className="mt-2 break-all text-[10px] text-white/70">{model.verifyUrl}</p>
            </SidebarSection>
          </div>
        </aside>

        {/* RIGHT CONTENT */}
        <div className="bg-white px-5 py-7 md:px-8 md:py-8">
          <header className="mb-6 border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {model.fullName}
            </h1>
            <p className="mt-1 text-base font-medium text-blue-700">{model.title}</p>
            {model.isVerified && (
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Tasdiqlangan profil
              </span>
            )}
          </header>

          {model.summary && (
            <ContentSection title="Men haqimda">
              <p className="text-sm leading-relaxed text-slate-600">{model.summary}</p>
            </ContentSection>
          )}

          {model.experience.length > 0 && (
            <ContentSection title="Ish tajribasi">
              <ol className="relative space-y-4 border-l-2 border-blue-100 pl-5">
                {model.experience.map((exp, idx) => (
                  <li key={exp.id || idx} className="relative">
                    <span className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{exp.position || 'Lavozim'}</h3>
                      <span className="text-xs font-medium text-slate-500">
                        {exp.startYear || '—'} – {exp.current ? 'Hozirgacha' : exp.endYear || '—'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-blue-700">{exp.company}</p>
                    {exp.details && <p className="mt-1 text-sm text-slate-600">{exp.details}</p>}
                    {exp.achievements && (
                      <p className="mt-1 text-sm text-slate-500">★ {exp.achievements}</p>
                    )}
                  </li>
                ))}
              </ol>
            </ContentSection>
          )}

          {model.education.length > 0 && (
            <ContentSection title="Ta'lim">
              <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
                {model.education.map((edu, idx) => (
                  <li key={edu.id || idx} className="relative">
                    <span className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-500" />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{edu.degree || 'Mutaxassislik'}</h3>
                      <span className="text-xs text-slate-500">
                        {edu.startYear || '—'} – {edu.endYear || '—'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{edu.institution}</p>
                    {edu.notes && <p className="mt-1 text-sm text-slate-500">{edu.notes}</p>}
                  </li>
                ))}
              </ol>
            </ContentSection>
          )}

          {model.certificates.length > 0 && (
            <ContentSection title="Sertifikatlar">
              <div className="grid gap-3 sm:grid-cols-2">
                {model.certificates.map((cert) => {
                  const href = mediaUrl(cert.fileUrl);
                  const isImage = (cert.mimeType || '').startsWith('image') || /\.(png|jpe?g|webp|gif)$/i.test(cert.fileName || cert.fileUrl || '');
                  return (
                    <div
                      key={cert.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80"
                    >
                      {href && isImage ? (
                        <img src={href} alt={cert.title} className="h-28 w-full object-cover" />
                      ) : (
                        <div className="flex h-20 items-center justify-center gap-2 bg-slate-100 text-slate-500">
                          <FileText className="h-5 w-5" />
                          <span className="text-xs font-semibold uppercase">
                            {fileIconLabel(detectLocalKind(cert.mimeType, cert.fileName, cert.fileUrl))}
                          </span>
                        </div>
                      )}
                      <div className="space-y-1 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{cert.title}</p>
                          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        </div>
                        {cert.issuer && <p className="text-xs text-slate-500">{cert.issuer}</p>}
                        {cert.issuedAt && <p className="text-xs text-slate-400">{cert.issuedAt}</p>}
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" /> Yuklab olish
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ContentSection>
          )}

          {model.portfolio.length > 0 && (
            <ContentSection title="Portfolio">
              <div className="grid gap-3 sm:grid-cols-2">
                {model.portfolio.map((item) => {
                  const href = mediaUrl(item.fileUrl);
                  return (
                    <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
                      {item.kind === 'image' && href ? (
                        <img src={href} alt={item.title} className="h-32 w-full object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center bg-slate-100 text-slate-500">
                          <FileKindIcon kind={item.kind} />
                          <span className="ml-2 text-xs font-semibold uppercase">{item.kind}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          {item.description && (
                            <p className="truncate text-xs text-slate-500">{item.description}</p>
                          )}
                        </div>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs text-blue-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Ochish
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ContentSection>
          )}

          {model.uploadedFiles.length > 0 && (
            <ContentSection title="Yuklangan fayllar">
              <ul className="space-y-2">
                {model.uploadedFiles.map((file) => {
                  const href = mediaUrl(file.fileUrl);
                  return (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <FileKindIcon kind={file.kind} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.title}</p>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            {fileIconLabel(file.kind)}
                            {file.source ? ` · ${file.source}` : ''}
                            {file.date ? ` · ${String(file.date).slice(0, 10)}` : ''}
                          </p>
                        </div>
                      </div>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Yuklab olish
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ContentSection>
          )}

          <ContentSection title="Tasdiqlash">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                    <BadgeCheck className="h-4 w-4" />
                    {model.isVerified ? 'ishliayol.uzda tasdiqlangan' : 'ishliayol.uz profili'}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/80">Profil ID: {model.profileId}</p>
                  {model.verificationDate && (
                    <p className="text-xs text-emerald-700/80">Yangilangan: {model.verificationDate}</p>
                  )}
                  <a
                    href={model.verifyUrl}
                    className="mt-2 inline-flex text-xs font-medium text-emerald-800 underline"
                  >
                    {model.verifyUrl}
                  </a>
                </div>
                <img src={qrSrc} alt="" className="h-16 w-16 rounded-lg border border-emerald-200 bg-white p-1" />
              </div>
            </div>
          </ContentSection>
        </div>
      </div>
    </article>
  );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{title}</h2>
      {children}
    </section>
  );
}

function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function detectLocalKind(mimeType?: string, fileName?: string, url?: string): ResumeFileItem['kind'] {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || url || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm)$/.test(name)) return 'video';
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (/\.(zip|rar|7z)$/.test(name)) return 'archive';
  return 'document';
}

export type { ResumeTemplateId };
