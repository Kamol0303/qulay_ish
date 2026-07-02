import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { Application, Job, Profile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Clock, MapPin, CheckCircle, XCircle, MessageSquare, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../../lib/utils';

export default function WorkerApplications() {
  const { t, i18n } = useTranslation();
  const { profile, isDemo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<(Application & { job?: Job; employer?: Profile })[]>([]);
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ru': return ru;
      case 'en': return enUS;
      default: return uz;
    }
  };

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    if (isDemo) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'applications'),
      where('workerId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const appsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));

      const combined = await Promise.all(appsData.map(async (app) => {
        const jobSnap = await getDocs(query(collection(db, 'jobs'), where('__name__', '==', app.jobId)));
        const job = jobSnap.docs[0]?.data() as Job;

        const employerSnap = await getDocs(query(collection(db, 'profiles'), where('uid', '==', app.employerId)));
        const employer = employerSnap.docs[0]?.data() as Profile;

        return { ...app, job, employer };
      }));

      setApplications(combined);
      setLoading(false);
    }, (error) => {
      debugLogger.error('Error fetching my applications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, isDemo]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('worker.dashboard.my_applications')}</h2>
          <p className="text-muted-foreground mt-2">{t('worker.dashboard.my_applications_desc')}</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-secondary/50 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : applications.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {applications.map((app) => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden hover:shadow-md transition-all group"
                >
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Briefcase size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                              {app.job?.title || t('jobs.deleted_job')}
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin size={14} />
                                {app.job?.district
                                  ? `${t(`districts.${getDistrictKey(app.job.district)}`, { defaultValue: app.job.district })}, `
                                  : ''}
                                {t('common.region_name', { defaultValue: app.job?.region })}
                              </span>
                              <span className="flex items-center gap-1"><Clock size={14} /> {app.createdAt ? format(app.createdAt.toDate(), 'd MMM, HH:mm', { locale: getDateLocale() }) : t('common.recently')}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-secondary/20 p-4 rounded-2xl border border-border/50 text-sm text-muted-foreground line-clamp-2">
                          "{app.message}"
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-4 min-w-[180px]">
                        <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                          app.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          app.status === 'accepted' ? 'bg-green-50 text-green-600 border border-green-100' :
                          'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {app.status === 'pending' ? <Clock size={14} /> : 
                           app.status === 'accepted' ? <CheckCircle size={14} /> : 
                           <XCircle size={14} />}
                          {app.status === 'pending' ? t('worker.dashboard.pending') : 
                           app.status === 'accepted' ? t('worker.dashboard.accepted') : 
                           t('worker.dashboard.rejected')}
                        </div>

                        <div className="flex gap-2 w-full">
                          <Link
                            to={app.status === 'accepted' ? `/chat?with=${app.employerId}` : '#'}
                            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                              app.status === 'accepted'
                                ? 'bg-secondary text-foreground hover:bg-accent'
                                : 'bg-gray-50 text-muted-foreground border border-border cursor-not-allowed'
                            }`}
                          >
                            <MessageSquare size={18} />
                            {app.status === 'accepted' ? t('nav.chat') : t('worker.dashboard.pending')}
                          </Link>
                          <Link
                            to={`/jobs`}
                            className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
                          >
                            <ChevronRight size={18} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-secondary/20 rounded-[40px] p-20 text-center border-2 border-dashed border-border">
            <Briefcase size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground">{t('worker.dashboard.no_applications')}</h3>
            <p className="text-muted-foreground mt-2">{t('worker.dashboard.no_applications_desc')}</p>
            <Link
              to="/jobs"
              className="mt-6 inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              {t('worker.dashboard.start_searching')}
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
