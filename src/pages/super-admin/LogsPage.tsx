import { debugLogger } from '../../lib/debugLogger';
import React, { useMemo, useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import systemLogService, { SystemLog } from '../../services/systemLogService';
import { Activity, AlertCircle, AlertTriangle, Info, Download, ChevronDown } from 'lucide-react';
import { toJsDate } from '../../lib/utils';

const actionLabels: Record<string, string> = {
  LOGIN: 'Tizimga kirish',
  LOGOUT: 'Tizimdan chiqish',
  VIEW_JOB: "Ishni ko'rish",
  APPLY_JOB: 'Ishga ariza',
  POST_JOB: "Ish e'loni",
  CREATE_CONTRACT: 'Shartnoma yaratish',
  UPDATE_PROFILE: 'Profilni yangilash',
  UPDATE_GLOBAL_SETTINGS: "Tizim sozlamalarini o'zgartirish",
  RATE_LIMIT_EXCEEDED_JOB: 'Ish limitiga yetildi',
  RATE_LIMIT_EXCEEDED_SERVICE: 'Xizmat limitiga yetildi',
  RATE_LIMIT_EXCEEDED_APPLICATION: 'Ariza limitiga yetildi',
  APPROVE_APPLICATION: 'Arizani tasdiqlash',
  REJECT_APPLICATION: 'Arizani rad etish',
  APPROVE_CONTRACT: 'Shartnomani tasdiqlash',
  REJECT_CONTRACT: 'Shartnomani rad etish',
  VERIFICATION_SUBMIT: 'Tasdiqlash arizasi',
  VERIFICATION_APPROVE: 'Tasdiqlash qabul qilindi',
  VERIFICATION_REJECT: 'Tasdiqlash rad etildi',
  SEND_MESSAGE: 'Xabar yuborildi',
};

const detailLabels: Record<string, string> = {
  preview: 'Xabar matni',
  receiverId: 'Qabul qiluvchi ID',
  senderId: 'Yuboruvchi ID',
  jobId: 'Ish ID',
  jobTitle: 'Ish nomi',
  applicationId: 'Ariza ID',
  contractId: 'Shartnoma ID',
  workerId: 'Ishchi ID',
  employerId: 'Ish beruvchi ID',
  amount: 'Summa',
  reason: 'Sabab',
  status: 'Holat',
  verificationId: 'Tasdiqlash ID',
  targetUserId: 'Foydalanuvchi ID',
  userId: 'Foydalanuvchi ID',
  phone: 'Telefon',
  email: 'Email',
};

type LogType = 'info' | 'warning' | 'error';

function normalizeLogType(type: unknown): LogType {
  const value = String(type || 'info').toLowerCase();
  if (value === 'warning' || value === 'warn') return 'warning';
  if (value === 'error' || value === 'danger') return 'error';
  return 'info';
}

function parseDetails(details: unknown): Record<string, unknown> {
  if (!details) return {};
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { qiymat: details };
    } catch {
      return { qiymat: details };
    }
  }
  if (typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return { qiymat: details };
}

function formatDetailValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ha' : "Yo'q";
  if (key === 'amount' && (typeof value === 'number' || typeof value === 'string')) {
    const n = Number(value);
    if (!Number.isNaN(n)) return `${n.toLocaleString('uz-UZ')} so'm`;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function detailsSummary(details: Record<string, unknown>): string {
  if (details.preview != null) return String(details.preview);
  if (details.jobTitle != null) return String(details.jobTitle);
  if (details.amount != null) return formatDetailValue('amount', details.amount);
  if (details.reason != null) return String(details.reason);
  if (details.contractId != null) return `Shartnoma: ${String(details.contractId).slice(0, 8)}…`;
  if (details.applicationId != null) return `Ariza: ${String(details.applicationId).slice(0, 8)}…`;
  const first = Object.entries(details)[0];
  if (!first) return 'Tafsilot yo‘q';
  return `${detailLabels[first[0]] || first[0]}: ${formatDetailValue(first[0], first[1])}`;
}

function LogDetails({ details }: { details: unknown }) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseDetails(details), [details]);
  const entries = Object.entries(parsed);

  if (entries.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="max-w-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
      >
        {open ? 'Yopish' : "Ko'rish"}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {!open && (
        <p className="mt-1 text-xs text-gray-600 line-clamp-2">{detailsSummary(parsed)}</p>
      )}
      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 space-y-2 shadow-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
              <span className="font-bold text-gray-500">{detailLabels[key] || key}</span>
              <span className="text-gray-800 break-all font-medium">{formatDetailValue(key, value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | LogType>('all');

  useEffect(() => {
    const unsubscribe = systemLogService.subscribeLogs(
      100,
      (newLogs) => {
        const normalized = newLogs.map((log) => ({
          ...log,
          type: normalizeLogType(log.type),
          details: parseDetails(log.details),
        }));
        setLogs(normalized);
        setLoading(false);
      },
      (error) => {
        debugLogger.error('Error loading logs:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const counts = useMemo(
    () => ({
      info: logs.filter((l) => normalizeLogType(l.type) === 'info').length,
      warning: logs.filter((l) => normalizeLogType(l.type) === 'warning').length,
      error: logs.filter((l) => normalizeLogType(l.type) === 'error').length,
      all: logs.length,
    }),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    if (filterType === 'all') return logs;
    return logs.filter((log) => normalizeLogType(log.type) === filterType);
  }, [logs, filterType]);

  const getTypeColor = (type: LogType) => {
    switch (type) {
      case 'error':
        return { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500', label: 'text-red-600', badge: 'XATO' };
      case 'warning':
        return { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-500', label: 'text-amber-600', badge: 'OGOH' };
      default:
        return { bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-500', label: 'text-blue-600', badge: 'INFO' };
    }
  };

  const formatTimestamp = (timestamp: unknown) => {
    const date = toJsDate(timestamp);
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Tashkent',
    }).format(date);
  };

  const handleExportLogs = () => {
    const csvContent = [
      ['VAQT', 'HARAKAT', 'FOYDALANUVCHI', 'TAFSILOTLAR', 'TURI'],
      ...filteredLogs.map((log) => [
        formatTimestamp(log.createdAt || log.timestamp),
        actionLabels[log.action] || log.action,
        log.userEmail || log.userId || "Noma'lum",
        detailsSummary(parseDetails(log.details)),
        normalizeLogType(log.type).toUpperCase(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
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
          <button
            type="button"
            onClick={handleExportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-all"
          >
            <Download size={16} />
            Yuklash
          </button>
        </div>

        <div className="flex flex-wrap gap-2 bg-white rounded-2xl p-2 border border-gray-100 w-fit">
          {(
            [
              { key: 'all', label: 'Barchasi', count: counts.all },
              { key: 'info', label: "Ma'lumot", count: counts.info },
              { key: 'warning', label: 'Ogohlantirish', count: counts.warning },
              { key: 'error', label: 'Xato', count: counts.error },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterType(tab.key)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                filterType === tab.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-80">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <p className="text-gray-600 font-medium">Jurnallar yuklanmoqda...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <Activity size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {filterType === 'all' ? 'Tizim jurnallari topilmadi' : 'Bu turdagi jurnal yo‘q'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Vaqt</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Harakat</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Foydalanuvchi</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Tafsilotlar</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Turi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.map((log, idx) => {
                    const type = normalizeLogType(log.type);
                    const typeColor = getTypeColor(type);
                    return (
                      <tr key={log.id || `${log.action}-${idx}`} className={`${typeColor.bg}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-mono text-gray-600">
                            {formatTimestamp(log.createdAt || log.timestamp)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">
                            {actionLabels[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 break-all">
                            {log.userEmail || log.userId || 'Tizim'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <LogDetails details={log.details} />
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className={`flex items-center gap-2 w-fit px-3 py-1 rounded-full border ${typeColor.bg} ${typeColor.border}`}
                          >
                            {type === 'error' ? (
                              <AlertCircle size={14} className={typeColor.label} />
                            ) : type === 'warning' ? (
                              <AlertTriangle size={14} className={typeColor.label} />
                            ) : (
                              <Info size={14} className={typeColor.label} />
                            )}
                            <span className={`text-xs font-black uppercase ${typeColor.label}`}>{typeColor.badge}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              { key: 'info' as const, title: 'INFO', count: counts.info },
              { key: 'warning' as const, title: 'WARNING', count: counts.warning },
              { key: 'error' as const, title: 'ERROR', count: counts.error },
            ] as const
          ).map((card) => {
            const typeColor = getTypeColor(card.key);
            const active = filterType === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setFilterType(card.key)}
                className={`${typeColor.bg} border ${typeColor.border} rounded-2xl p-4 text-left transition-all ${
                  active ? 'ring-2 ring-indigo-400' : 'hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${typeColor.dot}`} />
                  <span className={`text-xs font-black uppercase ${typeColor.label}`}>{card.title}</span>
                </div>
                <div className="text-2xl font-black text-gray-900">{card.count}</div>
                <p className="text-xs text-gray-600 mt-1">ta event</p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-left transition-all ${
              filterType === 'all' ? 'ring-2 ring-indigo-400' : 'hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-xs font-black uppercase text-indigo-600">JAMI</span>
            </div>
            <div className="text-2xl font-black text-gray-900">{counts.all}</div>
            <p className="text-xs text-gray-600 mt-1">ta event</p>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
