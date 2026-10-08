import React, { useEffect, useState } from 'react';
import { debugLogger } from '../../lib/debugLogger';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { contractService } from '../../services/contractService';
import { jobService } from '../../services/jobService';
import { Job } from '../../types';
import { Briefcase, CheckCircle, Clock, MapPin, TrendingUp, Users, Plus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { useTranslation } from 'react-i18next';
import { ru, enUS } from 'date-fns/locale';
import { getDistrictKey, toJsDate } from '../../lib/utils';

export default function EmployerDashboard() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({
    activeJobs: 0,
    activeContracts: 0,
    totalSpent: 0
  });
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const load = async () => {
      try {
        const [employerJobs, contracts] = await Promise.all([
          jobService.getByEmployer(profile.uid),
          contractService.getByEmployer(profile.uid),
        ]);

        setMyJobs(employerJobs.slice(0, 5));
        setStats(prev => ({
          ...prev,
          activeJobs: employerJobs.filter(j => j.status === 'open' || j.status === 'active').length,
          activeContracts: contracts.filter(c => c.status === 'active').length,
          totalSpent: contracts.filter(c => c.status === 'completed').reduce((acc, c) => acc + (c.amount || 0), 0),
        }));
        setLoading(false);
      } catch (error) {
        debugLogger.error('Employer dashboard error:', error);
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [profile]);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ru': return ru;
      case 'en': return enUS;
      default: return uz;
    }
  };

  const statCards = [
    { label: t('employer.dashboard.active_jobs'), value: stats.activeJobs, icon: Briefcase, color: 'bg-blue-600', shadow: 'shadow-blue-500/20' },
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {format(toJsDate(job.createdAt) || new Date(), 'd MMM', { locale: getDateLocale() })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-8 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                      <div className="text-right">
                        <p className="text-lg font-black text-blue-600 tracking-tight">{(job.price ?? 0).toLocaleString()} {t('common.uzs')}</p>
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mt-1 ${
                          (job.status === 'open' || job.status === 'active') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {(job.status === 'open' || job.status === 'active') ? t('employer.dashboard.active') : t('employer.dashboard.closed')}
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

          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-slate-900 rounded-[40px] p-8 border border-slate-800 shadow-2xl space-y-6">
              <h4 className="font-black text-white uppercase tracking-widest text-xs">{t('employer.dashboard.quick_actions')}</h4>
              <div className="space-y-3">
                <Link to="/directory" className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-blue-500 transition-all group">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">{t('employer.dashboard.worker_base')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </Link>
                <Link to="/employer/contracts" className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500 transition-all group">
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
