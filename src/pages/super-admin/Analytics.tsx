import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { BarChart3, TrendingUp, Users, Briefcase, CheckCircle, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';

const metrics = [
  { labelKey: 'superAdmin.metrics.userGrowth', value: '+12.5%', color: 'text-green-600', bg: 'bg-green-50', icon: Users, bar: 75, barColor: 'bg-green-500' },
  { labelKey: 'superAdmin.metrics.jobCompletionRate', value: '87.3%', color: 'text-blue-600', bg: 'bg-blue-50', icon: Briefcase, bar: 87, barColor: 'bg-blue-500' },
  { labelKey: 'superAdmin.metrics.platformSatisfaction', value: '4.8/5.0', color: 'text-purple-600', bg: 'bg-purple-50', icon: CheckCircle, bar: 96, barColor: 'bg-purple-500' },
  { labelKey: 'superAdmin.metrics.systemUptime', value: '99.9%', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: TrendingUp, bar: 99, barColor: 'bg-emerald-500' },
];

export default function SuperAdminAnalytics() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <BarChart3 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('superAdmin.actions.analytics')}</h1>
            <p className="text-gray-500 text-sm font-medium">{t('superAdmin.platformMetrics')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {metrics.map((m, idx) => (
            <motion.div
              key={m.labelKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${m.bg} p-3 rounded-2xl`}>
                  <m.icon size={22} className={m.color} />
                </div>
                <span className={`text-2xl font-black ${m.color}`}>{m.value}</span>
              </div>
              <p className="text-sm font-bold text-gray-600 mb-3">{t(m.labelKey)}</p>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`${m.barColor} h-2 rounded-full transition-all duration-700`} style={{ width: `${m.bar}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
