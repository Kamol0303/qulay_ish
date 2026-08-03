import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { api } from '../lib/api';
import type { Profile } from '../types';
import { downloadResumePdf, RESUME_TEMPLATES } from '../lib/resumePdf';
import { PremiumResume } from './resume/PremiumResume';
import Layout from './Layout';

export default function ResumeView() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Yuklanmoqda" />
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
            Ishchilar ro&apos;yxatiga
          </Link>
        </div>
      </Layout>
    );
  }

  const templateName =
    RESUME_TEMPLATES.find((t) => t.id === profile.resumeTemplate)?.name || 'Professional';

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 md:px-6 md:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            to={`/worker/${profile.uid}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Profilga qaytish
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadResumePdf(profile);
                } finally {
                  setExporting(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF yuklash ({templateName})
            </button>
          </div>
        </div>

        <PremiumResume profile={profile} />
      </div>
    </Layout>
  );
}
