import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Database, CheckCircle, Clock, Server, Wifi, HardDrive, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';

export default function SuperAdminSystem() {
  const { t } = useTranslation();

  const services = [
    { nameKey: 'superAdmin.system.database', icon: Database, status: 'operational', color: 'green' },
    { nameKey: 'superAdmin.system.authentication', icon: Shield, status: 'operational', color: 'green' },
    { nameKey: 'superAdmin.system.storage', icon: HardDrive, status: 'operational', color: 'green' },
    { nameKey: 'superAdmin.system.notifications', icon: Wifi, status: 'monitoring', color: 'amber' },
  ];

  const statusLabel = (status: string) =>
    status === 'operational' ? t('superAdmin.system.operational') : t('superAdmin.system.monitoring');

  const statusClasses = (color: string) =>
    color === 'green'
      ? { row: 'bg-green-50 border-green-100', icon: 'text-green-600', badge: 'text-green-600', dot: 'bg-green-500' }
      : { row: 'bg-amber-50 border-amber-100', icon: 'text-amber-600', badge: 'text-amber-600', dot: 'bg-amber-500' };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Server size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('superAdmin.systemStatus')}</h1>
            <p className="text-gray-500 text-sm font-medium">{t('superAdmin.stats.allSystemsOperational')}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-4">
          {services.map((svc, idx) => {
            const cls = statusClasses(svc.color);
            return (
              <motion.div
                key={svc.nameKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`flex items-center justify-between p-5 rounded-2xl border ${cls.row}`}
              >
                <div className="flex items-center gap-4">
                  <svc.icon size={22} className={cls.icon} />
                  <span className="font-bold text-gray-900">{t(svc.nameKey)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${cls.dot} animate-pulse`} />
                  <span className={`text-xs font-black uppercase tracking-wider ${cls.badge}`}>
                    {statusLabel(svc.status)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-lg font-black text-gray-900 mb-4">{t('superAdmin.stats.systemHealth')}</h2>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-black text-emerald-600">99.9%</div>
            <div>
              <p className="text-sm font-bold text-gray-600">{t('superAdmin.metrics.systemUptime')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('superAdmin.stats.allSystemsOperational')}</p>
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full" style={{ width: '99.9%' }} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
