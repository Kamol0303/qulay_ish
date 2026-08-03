import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { applicationService } from '../../services/applicationService';
import { jobService } from '../../services/jobService';
import { Application, Profile, Job } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, FileText, Clock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { toJsDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

export default function AdminApplications() {
  const { t } = useTranslation();
  const [applications, setApplications] = useState<(Application & { worker?: Profile; job?: Job; employer?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const apps = await api.applications.list();
        const combined = await Promise.all(apps.map(async (app) => {
          const [worker, job, employer] = await Promise.all([
            api.users.get(app.workerId).catch(() => undefined),
            jobService.getById(app.jobId).catch(() => undefined),
            api.users.get(app.employerId).catch(() => undefined),
          ]);
          return { ...app, worker, job, employer };
        }));
        if (!cancelled) setApplications(combined);
      } catch (err) {
        debugLogger.error('Admin applications load', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleReview = async (appId: string, action: 'accepted' | 'rejected') => {
    try {
      if (action === 'accepted') {
        await applicationService.approve(appId);
      } else {
        await applicationService.reject(appId);
      }
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status: action } : a)));
    } catch (err) {
      debugLogger.error('Review error', err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">{t('admin.applications.title', 'Arizalar')}</h2>
          <p className="text-muted-foreground">
            {t('admin.applications.subtitle', 'Barcha ish arizalari — Super Admin ko‘rinishi')}
          </p>
        </div>

        {loading ? (
          <div className="mt-6">{t('common.loading')}...</div>
        ) : applications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Hozircha arizalar yo‘q
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {applications.map((app) => {
                const created = toJsDate(app.createdAt);
                return (
                  <motion.div
                    key={app.id}
                    layout
                    className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-start md:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="text-sm font-bold text-primary">{app.job?.title || app.jobTitle || 'Ish'}</div>
                      <div className="flex items-center gap-2 text-lg font-bold">
                        <User size={18} className="text-muted-foreground" />
                        {app.worker?.fullName || app.workerName || 'Nomzod'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Ish beruvchi: {app.employer?.fullName || app.employer?.companyName || app.employerId}
                      </div>
                      <div className="rounded-xl bg-secondary/40 p-3 text-sm italic text-muted-foreground">
                        “{app.coverLetter || app.message || '—'}”
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          {created ? format(created, 'd MMM yyyy, HH:mm', { locale: uz }) : '—'}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold uppercase">{app.status}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      {app.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleReview(app.id, 'accepted')}
                            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-white"
                          >
                            <CheckCircle size={16} /> {t('common.approve')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReview(app.id, 'rejected')}
                            className="flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-red-700"
                          >
                            <XCircle size={16} /> {t('common.reject')}
                          </button>
                        </>
                      )}
                      <Link
                        to={`/resume/${app.workerId}`}
                        className="rounded-xl bg-blue-50 px-4 py-2 text-center text-sm font-bold text-blue-700"
                      >
                        Profil
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
