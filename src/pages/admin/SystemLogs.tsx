import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { Activity, Clock, User, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface SystemLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: Timestamp;
  details: string;
  type: 'info' | 'warning' | 'error' | 'security';
}

export default function SystemLogs() {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setLogs([
        {
          id: '1',
          action: 'User Login',
          userId: 'demo_admin',
          userName: 'Demo Admin',
          timestamp: Timestamp.now(),
          details: 'Admin logged into the system',
          type: 'info'
        },
        {
          id: '2',
          action: 'Profile Verified',
          userId: 'worker_123',
          userName: 'Lola Karimova',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 3600000)),
          details: 'Worker profile was verified by admin',
          type: 'security'
        },
        {
          id: '3',
          action: 'Job Deleted',
          userId: 'employer_456',
          userName: 'Azizbek Toshmatov',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 7200000)),
          details: 'Job posting #JOB-789 was deleted',
          type: 'warning'
        }
      ]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      debugLogger.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemo]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'text-blue-500 bg-blue-50';
      case 'warning': return 'text-amber-500 bg-amber-50';
      case 'error': return 'text-rose-500 bg-rose-50';
      case 'security': return 'text-purple-500 bg-purple-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <DashboardLayout title={t('nav.sidebar.system_logs')}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">{t('nav.sidebar.system_logs')}</h2>
              <p className="text-sm text-gray-500 font-medium mt-1">{t('admin.logs.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold">
              <Activity size={14} className="animate-pulse" />
              {t('admin.logs.live_monitoring')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.logs.timestamp')}</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.logs.action')}</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.logs.user')}</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.logs.details')}</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.logs.type')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-8 py-6">
                        <div className="h-4 bg-gray-100 rounded-lg w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                          <Clock size={14} className="text-gray-400" />
                          {format(log.timestamp.toDate(), 'HH:mm:ss')}
                          <span className="text-gray-300 font-normal ml-1">
                            {format(log.timestamp.toDate(), 'dd.MM.yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className="text-sm font-black text-gray-900">{log.action}</span>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                            <User size={12} className="text-gray-400" />
                          </div>
                          <span className="text-xs font-bold text-gray-600">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs text-gray-500 font-medium max-w-xs truncate">{log.details}</p>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getTypeColor(log.type)}`}>
                          {log.type}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center">
                          <Shield size={32} className="text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-bold">{t('admin.logs.no_logs')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
