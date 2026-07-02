import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { Job, Application, Profile } from '../../types';
import { Briefcase, CheckCircle, Clock, MapPin, TrendingUp, Star, Users, MessageSquare, Plus, ChevronRight, User } from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { useTranslation } from 'react-i18next';
import { ru, enUS } from 'date-fns/locale';
import { getDistrictKey } from '../../lib/utils';

export default function EmployerDashboard() {
  const { profile, isDemo } = useAuth();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalApplicants: 0,
    activeContracts: 0,
    totalSpent: 0
  });
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [recentApplicants, setRecentApplicants] = useState<(Application & { worker?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    // FIXED: Check if demo user by UID pattern, not isDemo flag
    const isDemoUser = profile.uid.match(/^demo_(worker|employer)_/);

    if (isDemoUser) {
      // Demo mode - show empty state
      setMyJobs([]);
      setStats({
        activeJobs: 0,
        totalApplicants: 0,
        activeContracts: 0,
        totalSpent: 0
      });
      setRecentApplicants([]);
      setLoading(false);
      return;
    }

    const jobsQuery = query(collection(db, 'jobs'), where('employerId', '==', profile.uid));
    const unsubscribeJobs = onSnapshot(jobsQuery, (snapshot) => {
      const firestoreJobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job));
      
      setMyJobs(firestoreJobs.slice(0, 5));

      const totalActiveJobs = firestoreJobs.filter(j => j.status === 'open').length;
      setStats(prev => ({
        ...prev,
        activeJobs: totalActiveJobs
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
    });

    const appsQuery = query(collection(db, 'applications'), where('employerId', '==', profile.uid));
    const unsubscribeApps = onSnapshot(appsQuery, (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalApplicants: snapshot.docs.length
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
    });

    const contractsQuery = query(collection(db, 'contracts'), where('employerId', '==', profile.uid));
    const unsubscribeContracts = onSnapshot(contractsQuery, (snapshot) => {
      const activeContracts = snapshot.docs.filter(d => d.data().status === 'active');
      const totalSpent = snapshot.docs.filter(d => d.data().status === 'completed').reduce((acc, d) => acc + (d.data().amount || 0), 0);
      
      setStats(prev => ({
        ...prev,
        activeContracts: activeContracts.length,
        totalSpent: totalSpent
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contracts');
    });

    const recentAppsQuery = query(
      collection(db, 'applications'),
      where('employerId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribeRecentApps = onSnapshot(recentAppsQuery, async (snapshot) => {
      const appsData = await Promise.all(snapshot.docs.map(async (d) => {
        const app = { id: d.id, ...d.data() } as Application;
        const workerSnap = await getDocs(query(collection(db, 'profiles'), where('uid', '==', app.workerId)));
        const worker = workerSnap.docs[0]?.data() as Profile;
        return { ...app, worker };
      }));
      setRecentApplicants(appsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recent_applications');
      setLoading(false);
    });

    return () => {
      unsubscribeJobs();
      unsubscribeApps();
      unsubscribeContracts();
      unsubscribeRecentApps();
    };
  }, [profile, isDemo]);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ru': return ru;
      case 'en': return enUS;
      default: return uz;
    }
  };

  const statCards = [
    { label: t('employer.dashboard.active_jobs'), value: stats.activeJobs, icon: Briefcase, color: 'bg-blue-600', shadow: 'shadow-blue-500/20' },
    { label: t('employer.dashboard.total_applicants'), value: stats.totalApplicants, icon: Users, color: 'bg-emerald-600', shadow: 'shadow-emerald-600/20' },
    { label: t('employer.dashboard.active_contracts'), value: stats.activeContracts, icon: CheckCircle, color: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
    { label: t('employer.dashboard.total_spent'), value: `${stats.totalSpent.toLocaleString()} ${t('common.uzs')}`, icon: TrendingUp, color: 'bg-amber-600', shadow: 'shadow-amber-600/20' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">{t('employer.dashboard.welcome', { name: profile?.fullName?.split(' ')[0] || '' })}</h2>
            <p className="text-slate-500 mt-2 font-medium">{t('employer.dashboard.subtitle')}</p>
          </div>
          <Link
            to="/employer/create-job"
            className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-blue-500/30 hover:scale-105 transition-all duration-300 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            {t('employer.dashboard.post_job')}
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-5">
                <div className={`${stat.color} p-4 rounded-2xl text-white shadow-xl ${stat.shadow} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* My Jobs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <div className="w-2 h-8 bg-blue-500 rounded-full" />
                {t('employer.dashboard.my_jobs')}
              </h3>
              <Link to="/employer/dashboard" className="text-xs font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors">{t('employer.dashboard.view_all')}</Link>
            </div>

            <div className="space-y-4">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-28 bg-white rounded-[32px] animate-pulse border border-slate-100 shadow-sm"></div>
                ))
              ) : myJobs.length > 0 ? (
                myJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white p-6 rounded-[32px] border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between hover:border-blue-500/30 hover:shadow-xl transition-all duration-300 group"
                  >
                    <div className="flex gap-5 items-center mb-4 sm:mb-0">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                        <Briefcase className="w-7 h-7 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-lg">{job.title}</h4>
                        <div className="flex items-center gap-4 mt-1.5 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-400" /> {t(`districts.${getDistrictKey(job.district)}`)}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {format(job.createdAt?.toDate?.() || new Date(), 'd MMM', { locale: getDateLocale() })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-8 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                      <div className="text-right">
                        <p className="text-lg font-black text-blue-600 tracking-tight">{(job.price ?? 0).toLocaleString()} {t('common.uzs')}</p>
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mt-1 ${
                          job.status === 'open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {job.status === 'open' ? t('employer.dashboard.active') : t('employer.dashboard.closed')}
                        </span>
                      </div>
                      <Link to={`/employer/jobs/${job.id}`} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                        <ChevronRight className="w-6 h-6" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-[40px] p-16 text-center border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                    <Briefcase size={40} />
                  </div>
                  <p className="text-slate-500 font-bold text-lg mb-8 tracking-tight">{t('employer.dashboard.no_jobs')}</p>
                  <Link to="/employer/create-job" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20">
                    {t('employer.dashboard.post_first')}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Applicants */}
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
              <div className="w-2 h-8 bg-emerald-500 rounded-full" />
              {t('employer.dashboard.new_applicants')}
            </h3>

            <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center animate-pulse text-slate-400 font-bold">{t('employer.dashboard.loading')}</div>
              ) : recentApplicants.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {recentApplicants.map((app) => (
                    <div key={app.id} className="p-6 hover:bg-slate-50 transition-all flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 group-hover:border-emerald-500/30 transition-colors">
                        {app.worker?.photoUrl ? (
                          <img src={app.worker.photoUrl} alt={app.worker.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors">{app.worker?.fullName || t('common.unknown')}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-wider mt-0.5">{t('employer.dashboard.on_job_id', { id: app.jobId.slice(-6) })}</p>
                      </div>
                      <Link to={`/chat?with=${app.workerId}&jobId=${app.jobId}`} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                        <MessageSquare className="w-5 h-5" />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-16 text-center">
                  <p className="text-sm text-slate-400 font-bold">{t('employer.dashboard.no_applicants')}</p>
                </div>
              )}
              <div className="p-6 bg-slate-50/50 border-t border-slate-50">
                <Link to="/employer/applicants" className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 block text-center">
                  {t('employer.dashboard.view_all_applicants')}
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900 rounded-[40px] p-8 border border-slate-800 shadow-2xl space-y-6">
              <h4 className="font-black text-white uppercase tracking-widest text-xs">{t('employer.dashboard.quick_actions')}</h4>
              <div className="space-y-3">
                <Link to="/workers" className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-blue-500 transition-all group">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">{t('employer.dashboard.worker_base')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </Link>
                <Link to="/employer/applicants" className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500 transition-all group">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">{t('employer.dashboard.contracts')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
