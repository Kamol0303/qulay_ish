import { debugLogger } from '../../lib/debugLogger';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import systemLogService, { SystemLog } from '../../services/systemLogService';
import { Activity, AlertCircle, AlertTriangle, Info, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';

const actionLabels: Record<string, string> = {
  'LOGIN': 'Tizimga kirish',
  'LOGOUT': 'Tizimdan chiqish',
  'VIEW_JOB': 'Ishni ko\'rish',
  'APPLY_JOB': 'Ishga ishtiromi',
  'POST_JOB': 'Ish e\'loni',
  'CREATE_CONTRACT': 'Shartnoma yaratish',
  'UPDATE_PROFILE': 'Profilni yangilash',
  'UPDATE_GLOBAL_SETTINGS': 'Tizim sozlamalarini o\'zgartirilish',
  'RATE_LIMIT_EXCEEDED_JOB': 'Ish limitiga yetildi',
  'RATE_LIMIT_EXCEEDED_SERVICE': 'Xizmat limitiga yetildi',
  'RATE_LIMIT_EXCEEDED_APPLICATION': 'Ishtiromi limitiga yetildi',
  'APPROVE_APPLICATION': 'Ishtiromi tasdiqlash',
  'REJECT_APPLICATION': 'Ishtiromi rad etish',
  'APPROVE_CONTRACT': 'Shartnomani tasdiqlash',
  'REJECT_CONTRACT': 'Shartnomani rad etish'
};

export default function SuperAdminLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'info' | 'warning' | 'error'>('all');

  useEffect(() => {
    // Subscribe to real-time logs
    const unsubscribe = systemLogService.subscribeLogs(
      100, // Get last 100 logs
      (newLogs) => {
        setLogs(newLogs);
        setLoading(false);
      },
      (error) => {
        debugLogger.error('Error loading logs:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredLogs = filterType === 'all'
    ? logs
    : logs.filter(log => log.type === filterType);

  const getTypeIcon = (type: 'info' | 'warning' | 'error') => {
    switch (type) {
      case 'error':
        return <AlertCircle size={16} />;
      case 'warning':
        return <AlertTriangle size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getTypeColor = (type: 'info' | 'warning' | 'error') => {
    switch (type) {
      case 'error':
        return { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500', text: 'text-red-700', label: 'text-red-600' };
      case 'warning':
        return { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', label: 'text-amber-600' };
      default:
        return { bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-500', text: 'text-blue-700', label: 'text-blue-600' };
    }
  };

  const formatTimestamp = (timestamp: any) => {
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp);
      return new Intl.DateTimeFormat('uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tashkent'
      }).format(date);
    } catch {
      return 'N/A';
    }
  };

  const handleExportLogs = () => {
    const csvContent = [
      ['VAQT', 'HARAKAT', 'FOYDALANUVCHI', 'TURI'],
      ...filteredLogs.map(log => [
        formatTimestamp(log.timestamp),
        actionLabels[log.action] || log.action,
        log.userEmail || log.userId || 'Noma\'lum',
        log.type.toUpperCase()
      ])
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `system_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Tizim jurnallari</h1>
              <p className="text-gray-500 text-sm font-medium">Real-vaqtda tizim faoliyati va voqealar</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-all"
          >
            <Download size={16} />
            Yuklash
          </motion.button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-2 border border-gray-100 w-fit">
          {(['all', 'info', 'warning', 'error'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                filterType === type
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {type === 'all' ? 'Barchasi' : type === 'info' ? 'Ma\'lumot' : type === 'warning' ? 'Ogohlantirish' : 'Xato'}
              {type !== 'all' && (
                <span className="ml-2 text-xs">
                  ({logs.filter(l => l.type === type).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                <div className="w-8 h-8 bg-indigo-500 rounded-full" />
              </div>
              <p className="text-gray-600 font-medium">Jurnallar yuklanmoqda...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <Activity size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Tizim jurnallari topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">VAQT</span>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">HARAKAT</span>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">FOYDALANUVCHI</span>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">TAFSILOTLAR</span>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">TURI</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.map((log, idx) => {
                    const typeColor = getTypeColor(log.type);
                    return (
                      <motion.tr
                        key={log.id || idx}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={`${typeColor.bg} border-l-4 border-l-${typeColor.dot}`}
                      >
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono text-gray-600">{formatTimestamp(log.timestamp)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">
                            {actionLabels[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">
                            {log.userEmail || log.userId || 'Tizim'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <details className="group">
                            <summary className="cursor-pointer text-xs text-gray-500 font-medium hover:text-gray-700">
                              Ko\'rish →
                            </summary>
                            <div className="mt-2 p-2 bg-white rounded border border-gray-200 text-xs text-gray-600 max-h-32 overflow-auto">
                              <pre className="font-mono whitespace-pre-wrap break-words">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          </details>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-2 w-fit px-3 py-1 rounded-full ${typeColor.bg} border ${typeColor.border}`}>
                            <div className={`w-2 h-2 rounded-full ${typeColor.dot}`} />
                            <span className={`text-xs font-black uppercase ${typeColor.label}`}>
                              {log.type}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {filteredLogs.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {(['info', 'warning', 'error'] as const).map(type => {
              const count = logs.filter(l => l.type === type).length;
              const typeColor = getTypeColor(type);
              return (
                <div key={type} className={`${typeColor.bg} border ${typeColor.border} rounded-2xl p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${typeColor.dot}`} />
                    <span className={`text-xs font-black uppercase ${typeColor.label}`}>{type}</span>
                  </div>
                  <div className="text-2xl font-black text-gray-900">{count}</div>
                  <p className="text-xs text-gray-600 mt-1">ta event</p>
                </div>
              );
            })}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-xs font-black uppercase text-indigo-600">JAMI</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{logs.length}</div>
              <p className="text-xs text-gray-600 mt-1">ta event</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
