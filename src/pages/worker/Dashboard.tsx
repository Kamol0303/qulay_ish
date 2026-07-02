import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { Job, Application, Contract } from '../../types';
import { Briefcase, CheckCircle, Clock, MapPin, TrendingUp, Star, Users, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { useTranslation } from 'react-i18next';
import { ru, enUS } from 'date-fns/locale';
import { getDistrictKey } from '../../lib/utils';
import { DEMO_JOBS } from '../../constants/demoData';
import { demoStore } from '../../lib/demoStore';

export default function WorkerDashboard() {
  const { profile, isDemo } = useAuth();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({
    activeApplications: 0,
    completedJobs: 0,
    activeContracts: 0,
    earnings: 0
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    if (isDemo) {
      // Demo mode - show DEMO_JOBS as recent jobs
      const allJobs = demoStore.mergeJobs(DEMO_JOBS);
      setStats({
        activeApplications: 0,
        completedJobs: 0,
        activeContracts: 0,
        earnings: 0
      });
      setRecentApplications([]);
      setRecentJobs(allJobs.filter((j: any) => j.status === 'open').slice(0, 5) as any);
      setLoading(false);
      return;
    }

    const appsQuery = query(collection(db, 'applications'), where('workerId', '==', profile.uid));
    const unsubscribeApps = onSnapshot(appsQuery, (snapshot) => {
      const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Application));
      setRecentApplications(apps.slice(0, 5));
      setStats(prev => ({
        ...prev,
        activeApplications: apps.filter(d => d.status === 'pending').length
      }));
    }, (error) => {
      debugLogger.error('Error fetching applications:', error);
    });

    const contractsQuery = query(collection(db, 'contracts'), where('workerId', '==', profile.uid));
    const unsubscribeContracts = onSnapshot(contractsQuery, (snapshot) => {
      const contracts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
      const completedContracts = contracts.filter(d => d.status === 'completed');
      const activeContracts = contracts.filter(d => d.status === 'active');
      const totalEarnings = completedContracts.reduce((acc, d) => acc + (d.amount || 0), 0);

      setStats(prev => ({
        ...prev,
        completedJobs: completedContracts.length,
        activeContracts: activeContracts.length,
        earnings: totalEarnings
      }));
    }, (error) => {
      debugLogger.error('Error fetching contracts:', error);
    });

    // Fetch recent jobs in Samarkand
    const jobsQuery = query(
      collection(db, 'jobs'),
      where('region', '==', 'Samarqand viloyati'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribeJobs = onSnapshot(jobsQuery, (snapshot) => {
      const firestoreJobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job));
      setRecentJobs(firestoreJobs);
      setLoading(false);
    }, (error) => {
      debugLogger.error('Error fetching jobs:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeApps();
      unsubscribeContracts();
      unsubscribeJobs();
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
    { label: t('worker.dashboard.active_applications'), value: stats.activeApplications, icon: Clock, color: 'bg-blue-600', shadow: 'shadow-blue-500/20' },
    { label: t('worker.dashboard.active_contracts'), value: stats.activeContracts, icon: CheckCircle, color: 'bg-emerald-600', shadow: 'shadow-emerald-600/20' },
    { label: t('worker.dashboard.completed_jobs'), value: stats.completedJobs, icon: Briefcase, color: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
    { label: t('worker.dashboard.total_earnings'), value: `${stats.earnings.toLocaleString()} ${t('common.uzs')}`, icon: TrendingUp, color: 'bg-amber-600', shadow: 'shadow-amber-600/20' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">{t('worker.dashboard.welcome', { name: profile?.fullName?.split(' ')[0] || '' })}</h2>
            <p className="text-slate-500 mt-2 font-medium">{t('worker.dashboard.subtitle')}</p>
          </div>
          <Link
            to="/jobs?near=true"
            className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-blue-500/30 hover:scale-105 transition-all duration-300 group"
          >
            <MapPin className="w-5 h-5 group-hover:animate-bounce" />
            {t('worker.dashboard.nearby_jobs')}
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
          {/* Recent Jobs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <div className="w-2 h-8 bg-blue-500 rounded-full" />
                {t('worker.dashboard.jobs_in_region')}
              </h3>
              <Link to="/jobs" className="text-xs font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors">{t('worker.dashboard.view_all')}</Link>
            </div>

            <div className="space-y-4">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-36 bg-white rounded-[40px] animate-pulse border border-slate-100 shadow-sm"></div>
                ))
              ) : recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    to={`/jobs`}
                    className="block bg-white p-8 rounded-[40px] border border-slate-100 hover:border-blue-500/30 hover:shadow-2xl transition-all duration-300 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                      <div className="flex gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:bg-blue-50 transition-colors">
                          {job.images?.[0] ? (
                            <img src={job.images[0]} alt={job.title} className="w-full h-full object-cover" />
                          ) : (
                            <Briefcase className="w-10 h-10 text-slate-300 group-hover:text-blue-600 transition-colors" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-black text-xl text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">{job.title}</h4>
                          <div className="flex items-center gap-5 mt-3 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-400" /> {t(`districts.${getDistrictKey(job.district)}`)}</span>
                            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {format(job.createdAt?.toDate?.() || new Date(), 'd MMM', { locale: getDateLocale() })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                        <p className="text-2xl font-black text-blue-600 tracking-tight">{(job.price ?? 0).toLocaleString()} {t('common.uzs')}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{job.workType === 'one-time' ? t('worker.dashboard.one_time') : t('worker.dashboard.permanent')}</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="bg-white rounded-[40px] p-16 text-center border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                    <Briefcase size={40} />
                  </div>
                  <p className="text-slate-500 font-bold text-lg tracking-tight">{t('worker.dashboard.no_jobs_in_region')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Applications */}
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
              <div className="w-2 h-8 bg-amber-500 rounded-full" />
              {t('worker.dashboard.recent_applications')}
            </h3>

            <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center animate-pulse text-slate-400 font-bold">{t('worker.dashboard.loading')}</div>
              ) : recentApplications.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {recentApplications.map((app) => (
                    <div key={app.id} className="p-6 hover:bg-slate-50 transition-all group">
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                          app.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          app.status === 'accepted' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {app.status === 'pending' ? t('worker.dashboard.pending') : app.status === 'accepted' ? t('worker.dashboard.accepted') : t('worker.dashboard.rejected')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {format(app.createdAt?.toDate?.() || new Date(), 'd MMM', { locale: getDateLocale() })}
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">ID: {app.jobId.slice(-8)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-16 text-center">
                  <p className="text-sm text-slate-400 font-bold">{t('worker.dashboard.no_applications')}</p>
                </div>
              )}
              <div className="p-6 bg-slate-50/50 border-t border-slate-50">
                <Link to="/worker/applications" className="text-xs font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 block text-center">
                  {t('worker.dashboard.view_all_applications')}
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900 rounded-[40px] p-8 border border-slate-800 shadow-2xl space-y-6">
              <h4 className="font-black text-white uppercase tracking-widest text-xs">{t('worker.dashboard.quick_actions')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <Link to="/my-profile" className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center hover:border-blue-500 transition-all group">
                  <User className="w-6 h-6 mx-auto mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{t('worker.dashboard.profile')}</span>
                </Link>
                <Link to="/chat" className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center hover:border-emerald-500 transition-all group">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{t('worker.dashboard.messages')}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
