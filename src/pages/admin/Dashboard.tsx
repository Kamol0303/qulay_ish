import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { performanceUtils } from '../../lib/performance';
import { Job, Profile, Contract, VerificationRequest } from '../../types';
import {
  Users,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  FileText,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalJobs: 0,
    totalContracts: 0,
    pendingVerifications: 0,
    activeDisputes: 0
  });
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdminData() {
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        setError(t('errors.no_permission'));
        return;
      }

      try {
        const counts = await performanceUtils.getStatsCounts();
        const [verifications, disputes, users, jobs, verificationsList] = await Promise.all([
          api.verificationRequests.list({ status: 'pending' }),
          api.disputes.list(),
          api.users.list(),
          api.jobs.list(),
          api.verificationRequests.list({ status: 'pending' }),
        ]);

        setStats({
          totalUsers: counts.users,
          totalJobs: counts.jobs,
          totalContracts: counts.contracts,
          pendingVerifications: verifications.length,
          activeDisputes: disputes.filter(d => d.status === 'pending').length,
        });

        setRecentUsers(performanceUtils.sortByCreatedAtDesc(users).slice(0, 5));
        setRecentJobs(performanceUtils.sortByCreatedAtDesc(jobs).slice(0, 5));
        setPendingVerifications(verificationsList.slice(0, 5));

        setLoading(false);
      } catch (err) {
        debugLogger.error('Error fetching admin data:', err);
        setError(t('errors.unexpected'));
        setLoading(false);
      }
    }

    fetchAdminData();
  }, [profile?.role, t]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-600">{t('common.loading')}...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    { icon: Users, label: t('admin.dashboard.total_users'), value: stats.totalUsers, color: 'blue' },
    { icon: Briefcase, label: t('admin.dashboard.total_jobs'), value: stats.totalJobs, color: 'green' },
    { icon: CheckCircle, label: t('admin.dashboard.total_contracts'), value: stats.totalContracts, color: 'purple' },
    { icon: FileText, label: t('admin.dashboard.pending_verifications'), value: stats.pendingVerifications, color: 'orange' },
    { icon: AlertTriangle, label: t('admin.dashboard.active_disputes'), value: stats.activeDisputes, color: 'red' },
  ];

  const getLocale = () => {
    if (i18n.language === 'uz') return uz;
    if (i18n.language === 'ru') return ru;
    return enUS;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const colorClasses: Record<string, string> = {
              blue: 'bg-blue-50 text-blue-600 border-blue-100',
              green: 'bg-green-50 text-green-600 border-green-100',
              purple: 'bg-purple-50 text-purple-600 border-purple-100',
              orange: 'bg-orange-50 text-orange-600 border-orange-100',
              red: 'bg-red-50 text-red-600 border-red-100',
            };

            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-2xl border ${colorClasses[stat.color as keyof typeof colorClasses]}`}
              >
                <Icon size={24} className="mb-3" />
                <p className="text-xs font-bold uppercase tracking-wider opacity-75">{stat.label}</p>
                <p className="text-3xl font-black tracking-tight mt-2">{stat.value.toLocaleString()}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200 p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={20} />
              {t('admin.dashboard.recent_users')}
            </h3>
            <div className="space-y-3">
              {recentUsers.length > 0 ? (
                recentUsers.map(user => (
                  <Link
                    key={user.uid}
                    to={`/admin/users`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{user.fullName}</p>
                      <p className="text-xs text-gray-500">{user.role}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-sm">{t('common.no_data')}</p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200 p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase size={20} />
              {t('admin.dashboard.recent_jobs')}
            </h3>
            <div className="space-y-3">
              {recentJobs.length > 0 ? (
                recentJobs.map(job => (
                  <Link
                    key={job.id}
                    to={`/admin/jobs`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-500">{job.status}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-sm">{t('common.no_data')}</p>
              )}
            </div>
          </motion.div>
        </div>

        {pendingVerifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6"
          >
            <h3 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
              <UserCheck size={20} />
              {t('admin.dashboard.pending_verifications')} ({pendingVerifications.length})
            </h3>
            <Link
              to="/admin/verification"
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-xl font-semibold hover:bg-yellow-700 transition-colors"
            >
              {t('admin.dashboard.verify')}
              <ChevronRight size={16} />
            </Link>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
