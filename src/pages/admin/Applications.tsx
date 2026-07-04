import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { applicationService } from '../../services/applicationService';
import { jobService } from '../../services/jobService';
import { Application, Profile, Job } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, FileText, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationService } from '../../services/notificationService';

export default function AdminApplications() {
  const { t } = useTranslation();
  const [applications, setApplications] = useState<(Application & { worker?: Profile; job?: Job })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const apps = await api.applications.list();
        const combined = await Promise.all(apps.map(async (app) => {
          const worker = await api.users.get(app.workerId).catch(() => undefined);
          const job = await jobService.getById(app.jobId).catch(() => undefined);
          return { ...app, worker, job };
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

  const handleReview = async (appId: string, action: 'accepted' | 'rejected', _reason?: string) => {
    try {
      const app = applications.find(a => a.id === appId);
      if (!app) return;
      if (action === 'accepted') {
        await applicationService.approve(appId);
      } else {
        await applicationService.reject(appId);
      }
    } catch (err) {
      debugLogger.error('Review error', err);
    }
  };

  return (
    <DashboardLayout>
      <div>
        <h2 className="text-3xl font-bold">{t('admin.applications.title', 'Applications')}</h2>
        <p className="text-muted-foreground">{t('admin.applications.subtitle', 'Review and moderate incoming job applications')}</p>

        {loading ? <div className="mt-6">{t('common.loading')}...</div> : (
          <div className="grid gap-4 mt-6">
            <AnimatePresence>
              {applications.map(app => (
                <motion.div key={app.id} layout className="bg-card p-6 rounded-2xl border border-border flex items-start justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{app.job?.title}</div>
                    <div className="text-lg font-bold mt-1">{app.worker?.fullName || app.workerName}</div>
                    <div className="mt-2 text-sm text-gray-600 italic">{app.coverLetter || app.message}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleReview(app.id, 'accepted')} className="py-2 px-4 bg-green-600 text-white rounded-xl flex items-center gap-2"><CheckCircle /> {t('common.approve')}</button>
                    <button onClick={() => {
                      const reason = prompt('Reject reason (optional)') || '';
                      handleReview(app.id, 'rejected', reason);
                    }} className="py-2 px-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2"><XCircle /> {t('common.reject')}</button>
                    <a href={`/chat?with=${app.workerId}`} className="py-2 px-4 bg-blue-50 text-blue-700 rounded-xl">{t('nav.chat')}</a>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
