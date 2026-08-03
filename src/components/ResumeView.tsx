import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Profile } from '../types';
import { downloadResumePdf, RESUME_TEMPLATES } from '../lib/resumePdf';
import { mediaUrl, avatarFallback } from '../lib/mediaUrl';
import Layout from './Layout';

export default function ResumeView() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const user = await api.users.get(userId);
        if (!cancelled) setProfile(user);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-10 text-center">
          <p className="font-medium">Rezyume topilmadi</p>
          <Link to="/workers" className="mt-3 inline-flex text-sm text-primary hover:underline">
            Ishchilar ro\'yxatiga
          </Link>
        </div>
      </Layout>
    );
  }

  const templateName =
    RESUME_TEMPLATES.find((t) => t.id === profile.resumeTemplate)?.name || 'Professional';

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link to={`/worker/${profile.uid}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Profilga qaytish
          </Link>
          <button
            type="button"
            onClick={() => void downloadResumePdf(profile)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Download className="h-4 w-4" /> PDF yuklash ({templateName})
          </button>
        </div>

        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-4 border-b border-border bg-slate-900 px-6 py-5 text-white">
            <img
              src={mediaUrl(profile.photoUrl) || avatarFallback(profile.fullName)}
              alt=""
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-xl font-bold">{profile.fullName}</h1>
              <p className="text-sm text-white/75">
                {[profile.experienceLevel, profile.region, profile.district].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {[profile.phoneNumber, profile.email, profile.telegram].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {(profile.professionalSummary || profile.bio) && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Summary</h2>
                <p className="text-sm leading-relaxed">{profile.professionalSummary || profile.bio}</p>
              </section>
            )}

            {(profile.skills?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills?.map((s) => (
                    <span key={s} className="rounded-full bg-muted px-3 py-1 text-sm">{s}</span>
                  ))}
                </div>
              </section>
            )}

            {(profile.experience?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Experience</h2>
                <div className="space-y-3">
                  {profile.experience?.map((e) => (
                    <div key={e.id || `${e.company}-${e.position}`}>
                      <p className="font-semibold">{e.position} — {e.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.startYear} — {e.current ? 'hozir' : e.endYear || ''}
                      </p>
                      {e.details && <p className="mt-1 text-sm">{e.details}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(profile.education?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Education</h2>
                <div className="space-y-3">
                  {profile.education?.map((ed) => (
                    <div key={ed.id || `${ed.institution}-${ed.degree}`}>
                      <p className="font-semibold">{ed.degree} — {ed.institution}</p>
                      <p className="text-xs text-muted-foreground">
                        {ed.startYear} — {ed.endYear}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(profile.certificates?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Certificates</h2>
                <ul className="space-y-1 text-sm">
                  {profile.certificates?.map((c) => (
                    <li key={c.id || c.title}>
                      {c.fileUrl ? (
                        <a href={mediaUrl(c.fileUrl)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-xs text-muted-foreground">
              QR / tekshiruv: {window.location.origin}/worker/{profile.uid}
            </p>
          </div>
        </article>
      </div>
    </Layout>
  );
}
