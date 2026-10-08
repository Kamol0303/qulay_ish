import { useCallback, useEffect, useState } from 'react';
import { Briefcase, CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobileUi } from '../../hooks/useIsMobileUi';
import { api } from '../../lib/api';
import type { Application, Job } from '../../types';

type Assignment = Application & { job?: Job };

function MyWorkContent() {
  const { t, i18n } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const applications = await api.applications.list({ workerId: profile.uid });
      const active = applications.filter(
        (application) => application.status === 'accepted' || application.status === 'completed',
      );
      const combined = await Promise.all(
        active.map(async (application) => ({
          ...application,
          job: await api.jobs.get(application.jobId).catch(() => undefined),
        })),
      );
      setRows(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('my_work.load_error'));
    } finally {
      setLoading(false);
    }
  }, [profile?.uid, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = async (assignment: Assignment) => {
    if (!window.confirm(t('my_work.complete_confirm'))) return;
    setError('');
    setCompleting(assignment.id);
    try {
      await api.applications.complete(assignment.id);
      setRows((current) =>
        current.map((row) =>
          row.id === assignment.id
            ? { ...row, status: 'completed', completedAt: new Date().toISOString() }
            : row,
        ),
      );
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('my_work.complete_error'));
    } finally {
      setCompleting(null);
    }
  };

  const formatSchedule = (value?: string | Date) => {
    if (!value) return t('my_work.agreed_time');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('my_work.agreed_time');
    return new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-1 py-2 sm:px-4 sm:py-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">{t('my_work.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('my_work.subtitle')}</p>
      </div>

      {error && (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
          {t('my_work.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Briefcase size={22} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-black text-foreground">
                      {row.job?.title || row.jobTitle || t('my_work.job')}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarClock size={15} />
                      {formatSchedule(row.job?.scheduledAt)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                    row.status === 'accepted'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {row.status === 'accepted' ? t('my_work.in_progress') : t('my_work.completed')}
                </span>
              </div>

              {row.status === 'accepted' && (
                <button
                  type="button"
                  onClick={() => void complete(row)}
                  disabled={completing === row.id}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
                >
                  {completing === row.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  {completing === row.id ? t('my_work.completing') : t('my_work.complete_button')}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyWorkPage() {
  const mobile = useIsMobileUi();
  if (mobile) return <MyWorkContent />;
  return (
    <DashboardLayout>
      <MyWorkContent />
    </DashboardLayout>
  );
}
