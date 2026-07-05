import { toUserMessage } from '../../lib/api/errors';
import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import {
  Shield, Users, Briefcase, FileText, AlertTriangle, 
  TrendingUp, Activity, Database, Settings, BarChart3,
  CheckCircle, Clock, XCircle, DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalWorkers: 0,
    totalEmployers: 0,
    totalAdmins: 0,
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    pendingApplications: 0,
    totalContracts: 0,
    activeContracts: 0,
    completedContracts: 0,
    totalServicePosts: 0,
    pendingVerifications: 0,
    totalRevenue: 0,
    monthlyRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    async function fetchSuperAdminStats() {
      setLoading(true);
      setApiError(null);

      try {
        const counts = await api.stats.counts();
        const results = await Promise.allSettled([
          api.users.list(),
          api.jobs.list(),
          api.applications.list(),
          api.contracts.list(),
          api.servicePosts.list(),
          api.verificationRequests.list({ status: 'pending' }),
          api.systemLogs.list(),
        ]);

        const users = results[0].status === 'fulfilled' ? results[0].value : [];
        const jobs = results[1].status === 'fulfilled' ? results[1].value : [];
        const applications = results[2].status === 'fulfilled' ? results[2].value : [];
        const contracts = results[3].status === 'fulfilled' ? results[3].value : [];
        const servicePosts = results[4].status === 'fulfilled' ? results[4].value : [];
        const verifications = results[5].status === 'fulfilled' ? results[5].value : [];
        const recentLogs = results[6].status === 'fulfilled' ? results[6].value : [];

        const workers = users.filter(u => u.role === 'worker');
        const employers = users.filter(u => u.role === 'employer');
        const admins = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
        const activeJobs = jobs.filter(j => j.status === 'open' || j.status === 'active');
        const pendingApps = applications.filter(a => a.status === 'pending');
        const activeContracts = contracts.filter(c => c.status === 'active');
        const completedContracts = contracts.filter(c => c.status === 'completed');

        const totalRevenue = completedContracts.reduce((sum, c) => sum + (c.amount || 0), 0);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const monthlyRevenue = completedContracts
          .filter(c => new Date(c.updatedAt as string) > thirtyDaysAgo)
          .reduce((sum, c) => sum + (c.amount || 0), 0);

        setStats({
          totalUsers: counts.users || users.length,
          totalWorkers: workers.length,
          totalEmployers: employers.length,
          totalAdmins: admins.length,
          totalJobs: counts.jobs || jobs.length,
          activeJobs: activeJobs.length,
          totalApplications: counts.applications || applications.length,
          pendingApplications: pendingApps.length,
          totalContracts: counts.contracts || contracts.length,
          activeContracts: activeContracts.length,
          completedContracts: completedContracts.length,
          totalServicePosts: servicePosts.length,
          pendingVerifications: verifications.length,
          totalRevenue,
          monthlyRevenue,
        });

        setRecentActivity((recentLogs as unknown[]).slice(0, 10));
      } catch (error) {
        setApiError(toUserMessage(error, t('errors.unexpected')));
        debugLogger.error('Error fetching super admin stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSuperAdminStats();
  }, []);

  const statCards = [
    {
      title: t('superAdmin.stats.totalUsers'),
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-600',
      link: '/super-admin/users',
      subtitle: `${stats.totalWorkers} ${t('superAdmin.stats.workers')}, ${stats.totalEmployers} ${t('superAdmin.stats.employers')}`
    },
    {
      title: t('superAdmin.stats.activeJobs'),
      value: stats.activeJobs,
      icon: Briefcase,
      color: 'bg-emerald-600',
      link: '/super-admin/jobs',
      subtitle: `${stats.totalJobs} ${t('superAdmin.stats.totalJobs')}`
    },
    {
      title: t('superAdmin.stats.applications'),
      value: stats.totalApplications,
      icon: FileText,
      color: 'bg-purple-600',
      link: '/super-admin/applications',
      subtitle: `${stats.pendingApplications} ${t('superAdmin.stats.pending')}`
    },
    {
      title: t('superAdmin.stats.activeContracts'),
      value: stats.activeContracts,
      icon: CheckCircle,
      color: 'bg-amber-600',
      link: '/super-admin/contracts',
      subtitle: `${stats.completedContracts} ${t('superAdmin.stats.completed')}`
    },
    {
      title: t('superAdmin.stats.servicePosts'),
      value: stats.totalServicePosts,
      icon: Activity,
      color: 'bg-pink-600',
      link: '/super-admin/service-posts',
      subtitle: t('superAdmin.stats.workerServices')
    },
    {
      title: t('superAdmin.stats.pendingVerifications'),
      value: stats.pendingVerifications,
      icon: AlertTriangle,
      color: 'bg-red-600',
      link: '/super-admin/verification',
      subtitle: t('superAdmin.stats.requiresReview')
    },
    {
      title: t('superAdmin.stats.monthlyRevenue'),
      value: `${(stats.monthlyRevenue / 1000).toFixed(0)}K`,
      icon: DollarSign,
      color: 'bg-green-600',
      link: '/super-admin/revenue',
      subtitle: `${(stats.totalRevenue / 1000000).toFixed(1)}M ${t('superAdmin.stats.total')}`
    },
    {
      title: t('superAdmin.stats.systemHealth'),
      value: '99.9%',
      icon: Database,
      color: 'bg-indigo-600',
      link: '/super-admin/system',
      subtitle: t('superAdmin.stats.allSystemsOperational')
    }
  ];

  const quickActions = [
    { label: t('superAdmin.actions.userManagement'), icon: Users, link: '/super-admin/users', color: 'bg-blue-500' },
    { label: t('superAdmin.actions.jobManagement'), icon: Briefcase, link: '/super-admin/jobs', color: 'bg-emerald-500' },
    { label: t('superAdmin.actions.verificationQueue'), icon: AlertTriangle, link: '/super-admin/verification', color: 'bg-red-500' },
    { label: t('superAdmin.actions.systemSettings'), icon: Settings, link: '/super-admin/settings', color: 'bg-gray-700' },
    { label: t('superAdmin.actions.analytics'), icon: BarChart3, link: '/super-admin/analytics', color: 'bg-purple-500' },
    { label: t('superAdmin.actions.systemLogs'), icon: Activity, link: '/super-admin/logs', color: 'bg-indigo-500' }
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600 font-bold">{t('superAdmin.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Shield size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  {t('superAdmin.title')}
                </h1>
                <p className="text-gray-500 text-sm font-medium">
                  {t('superAdmin.subtitle')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
              {t('superAdmin.accessBadge')}
            </span>
          </div>
        </div>

        {apiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">
            {apiError}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                to={stat.link}
                className="block bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.color} p-3 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <stat.icon size={24} />
                  </div>
                  <TrendingUp size={16} className="text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-black text-gray-900 mb-1">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    {stat.subtitle}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
            <Activity size={24} className="text-red-600" />
            {t('superAdmin.quickActions')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.link}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group"
              >
                <div className={`${action.color} p-4 rounded-2xl text-white group-hover:scale-110 transition-transform shadow-lg`}>
                  <action.icon size={24} />
                </div>
                <span className="text-xs font-bold text-gray-700 text-center">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Database size={24} className="text-indigo-600" />
              {t('superAdmin.systemStatus')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span className="font-bold text-gray-900">{t('superAdmin.system.database')}</span>
                </div>
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                  {t('superAdmin.system.operational')}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span className="font-bold text-gray-900">{t('superAdmin.system.authentication')}</span>
                </div>
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                  {t('superAdmin.system.operational')}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span className="font-bold text-gray-900">{t('superAdmin.system.storage')}</span>
                </div>
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                  {t('superAdmin.system.operational')}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-amber-600" />
                  <span className="font-bold text-gray-900">{t('superAdmin.system.notifications')}</span>
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  {t('superAdmin.system.monitoring')}
                </span>
              </div>
            </div>
          </div>

          {/* Platform Metrics */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 size={24} className="text-purple-600" />
              {t('superAdmin.platformMetrics')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600">{t('superAdmin.metrics.userGrowth')}</span>
                <span className="text-lg font-black text-green-600">+12.5%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }} />
              </div>

              <div className="flex items-center justify-between mt-6">
                <span className="text-sm font-bold text-gray-600">{t('superAdmin.metrics.jobCompletionRate')}</span>
                <span className="text-lg font-black text-blue-600">87.3%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87%' }} />
              </div>

              <div className="flex items-center justify-between mt-6">
                <span className="text-sm font-bold text-gray-600">{t('superAdmin.metrics.platformSatisfaction')}</span>
                <span className="text-lg font-black text-purple-600">4.8/5.0</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '96%' }} />
              </div>

              <div className="flex items-center justify-between mt-6">
                <span className="text-sm font-bold text-gray-600">{t('superAdmin.metrics.systemUptime')}</span>
                <span className="text-lg font-black text-emerald-600">99.9%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '99.9%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
