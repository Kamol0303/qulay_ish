import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { Application, Profile, Job } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Briefcase, MessageSquare, CheckCircle, XCircle, Clock, MapPin, Phone, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../../lib/utils';
import { applicationService } from '../../services/applicationService';

export default function EmployerApplications() {
  const { t, i18n } = useTranslation();
  const { profile, isDemo } = useAuth();
  const [applications, setApplications] = useState<(Application & { worker?: Profile; job?: Job })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
      where('employerId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const appsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));

      const combined = await Promise.all(appsData.map(async (app) => {
        const workerSnap = await getDocs(query(collection(db, 'profiles'), where('uid', '==', app.workerId)));
        const worker = workerSnap.docs[0]?.data() as Profile;

        const jobSnap = await getDocs(query(collection(db, 'jobs'), where('__name__', '==', app.jobId)));
        const job = jobSnap.docs[0]?.data() as Job;

        return { ...app, worker, job };
      }));

      setApplications(combined);
      setLoading(false);
    }, (error) => {
      debugLogger.error('Error fetching applications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, isDemo]);

  const handleStatusUpdate = async (appId: string, newStatus: string, workerId: string, jobTitle: string) => {
    try {
      const success = await applicationService.updateStatus(appId, newStatus as any, workerId, jobTitle);
      if (success) {
        setApplications(prev => prev.map(app => app.id === appId ? { ...app, status: newStatus as any } : app));
      }
    } catch (error) {
      debugLogger.error('Error updating application status:', error);
    }
  };

  const filteredApps = filterStatus === 'all' 
    ? applications 
    : applications.filter(app => app.status === filterStatus);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ru': return ru;
      case 'en': return enUS;
      default: return uz;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'all': return t('common.all');
      case 'pending': return t('employer.dashboard.pending');
      case 'accepted': return t('employer.dashboard.accept');
      case 'rejected': return t('employer.dashboard.rejected');
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('employer.dashboard.applications_management')}</h2>
            <p className="text-muted-foreground mt-2">{t('employer.dashboard.applications_management_desc')}</p>
          </div>
          
          <div className="flex bg-secondary/50 p-1 rounded-2xl border border-border">
            {['all', 'pending', 'accepted', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  filterStatus === status 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-secondary/50 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredApps.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredApps.map((app) => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="p-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Worker Info */}
                      <div className="flex items-start gap-4 min-w-[240px]">
                        <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden border border-border">
                          {app.worker?.photoUrl ? (
                            <img src={app.worker.photoUrl} alt={app.worker.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <User size={32} />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-foreground">{app.worker?.fullName || t('common.unknown_worker')}</h4>
                          <div className="flex items-center gap-1 text-amber-500 text-sm font-bold mt-1">
                            <Star size={14} fill="currentColor" />
                            <span>{app.worker?.rating || '0.0'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                              <Link 
                                to={`/resume/${app.workerId}`}
                                className="text-xs font-bold text-primary hover:underline"
                              >
                                {t('profile.view_profile')}
                              </Link>
                          </div>
                        </div>
                      </div>

                      {/* Application Content */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Briefcase size={14} />
                          <span>{t('jobs.job')}: {app.job?.title || t('jobs.deleted_job')}</span>
                        </div>
                        
                        <div className="bg-secondary/30 p-5 rounded-2xl border border-border/50 italic text-muted-foreground text-sm leading-relaxed">
                          "{app.message}"
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1.5">
                            <Clock size={14} />
                            {app.createdAt ? format(app.createdAt.toDate(), 'd-MMMM, HH:mm', { locale: getDateLocale() }) : t('common.recently')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin size={14} />
                            {app.worker?.district
                              ? `${t(`districts.${getDistrictKey(app.worker.district)}`, { defaultValue: app.worker.district })}, `
                              : ''}
                            {t('common.region_name', { defaultValue: app.worker?.region })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col justify-center gap-3 min-w-[200px]">
                        {app.status === 'pending' ? (
                          <div className="py-3 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl font-bold flex items-center justify-center gap-2">
                            <Clock size={18} />
                            {t('employer.dashboard.pending')}
                          </div>
                        ) : app.status === 'accepted' ? (
                          <Link
                            to={`/employer/create-contract?appId=${app.id}`}
                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                          >
                            <CheckCircle size={18} />
                            {t('employer.dashboard.create_contract')}
                          </Link>
                        ) : (
                          <div className="py-3 bg-red-50 text-red-700 border border-red-100 rounded-xl font-bold flex items-center justify-center gap-2">
                            <XCircle size={18} />
                            {t('employer.dashboard.rejected')}
                          </div>
                        )}
                        
                        <Link
                          to={app.status === 'accepted' ? `/chat?with=${app.workerId}&jobId=${app.jobId}` : '#'}
                          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${app.status === 'accepted' ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-gray-50 text-muted-foreground border border-border cursor-not-allowed'}`}
                        >
                          <MessageSquare size={18} />
                          {t('worker_profile.start_chat')}
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-secondary/20 rounded-[40px] p-20 text-center border-2 border-dashed border-border">
            <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground shadow-sm">
              <Briefcase size={40} />
            </div>
            <h3 className="text-xl font-bold text-foreground">{t('employer.dashboard.no_applications')}</h3>
            <p className="text-muted-foreground mt-2">{t('employer.dashboard.no_applications_desc')}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
