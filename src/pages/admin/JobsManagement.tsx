import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { jobService } from '../../services/jobService';
import { Job } from '../../types';
import {
  Briefcase, Search, Trash2, Clock, MapPin, DollarSign,
  X, AlertTriangle, CheckCircle, Eye
} from 'lucide-react';
import { format, type Locale } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { performanceUtils } from '../../lib/performance';
import { demoStore } from '../../lib/demoStore';
import { DEMO_JOBS } from '../../constants/demoData';

// Safe date parser — handles export timestamps, ISO string, Date
function safeDate(val: any): Date | null {
  if (!val) return null;
  try {
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatDate(val: any, locale: Locale): string {
  const d = safeDate(val);
  if (!d) return '-';
  try { return format(d, 'dd MMM yyyy', { locale }); } catch { return '-'; }
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 3000); return () => clearTimeout(id); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4">
        <p className="text-gray-900 font-bold text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Bekor qilish
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors">
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function JobDetailModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'uz' ? uz : i18n.language === 'ru' ? ru : enUS;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900">{job.title || t('common.unknown')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.status')}</p>
              <p className="font-bold text-gray-900">{job.status || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.price')}</p>
              <p className="font-bold text-gray-900">{((job.price ?? (job as any).salary ?? 0) as number).toLocaleString()} {t('common.uzs')}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.region')}</p>
              <p className="font-bold text-gray-900">{job.region || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.category')}</p>
              <p className="font-bold text-gray-900">{job.category || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.date')}</p>
              <p className="font-bold text-gray-900">{formatDate(job.createdAt, locale)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Employer</p>
              <p className="font-bold text-gray-900 truncate">{(job as any).employerName || job.employerId || '-'}</p>
            </div>
          </div>
          {job.description && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('common.description')}</p>
              <p className="text-gray-700 leading-relaxed">{job.description}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function JobsManagement() {
  const { t, i18n } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 15;

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  useEffect(() => { fetchJobs(true); }, [statusFilter]);

  async function fetchJobs(reset = false) {
    setLoading(true);
    try {
      const nextPage = reset ? 0 : page;
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;

      const fetched = await api.jobs.list(params);
      const sorted = performanceUtils.sortByCreatedAtDesc(fetched);
      const { items, hasMore: more } = performanceUtils.paginate(sorted, pageSize, nextPage);

      const base = reset ? demoStore.mergeJobs([...DEMO_JOBS, ...items]) : [...jobs, ...items];
      const filtered = statusFilter === 'all' ? base : base.filter(j => j.status === statusFilter);

      setJobs(filtered);
      setHasMore(more);
      if (!reset) setPage(nextPage + 1);
      else setPage(1);
    } catch (error) {
      debugLogger.error('Error fetching jobs:', error);
      const fallback = demoStore.mergeJobs(DEMO_JOBS);
      setJobs(statusFilter === 'all' ? fallback as Job[] : fallback.filter(j => j.status === statusFilter) as Job[]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function updateJobStatus(jobId: string, newStatus: string) {
    // Update local state + localStorage immediately (optimistic)
    demoStore.updateJob(jobId, { status: newStatus });
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus as any } : j));
    // Try API (non-blocking for demo jobs)
    try {
      await jobService.update(jobId, { status: newStatus as Job['status'] });
    } catch {
      // Demo jobs may not exist in API
    }
    showToast(t('common.success'), 'success');
  }

  async function deleteJob(jobId: string) {
    // Update local state + localStorage immediately
    demoStore.removeJob(jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    try {
      await jobService.update(jobId, { status: 'closed' });
    } catch {
      // Demo jobs may not exist in API
    }
    showToast(t('common.success'), 'success');
  }

  const locale = i18n.language === 'uz' ? uz : i18n.language === 'ru' ? ru : enUS;

  // Safe filter — skip jobs with no id or title
  const filteredJobs = jobs
    .filter(j => j && j.id)
    .filter(j =>
      !search ||
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.description?.toLowerCase().includes(search.toLowerCase()) ||
      j.employerId?.toLowerCase().includes(search.toLowerCase()) ||
      (j as any).employerName?.toLowerCase().includes(search.toLowerCase()) ||
      j.region?.toLowerCase().includes(search.toLowerCase())
    );

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      open: 'bg-green-50 text-green-700',
      active: 'bg-green-50 text-green-700',
      filled: 'bg-blue-50 text-blue-700',
      'in-progress': 'bg-purple-50 text-purple-700',
      in_progress: 'bg-purple-50 text-purple-700',
      completed: 'bg-gray-50 text-gray-700',
      closed: 'bg-red-50 text-red-700',
    };
    return colors[status || ''] || 'bg-gray-50 text-gray-700';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('admin.jobs.title')}</h1>
          <p className="text-gray-600 text-sm mt-1">{t('admin.jobs.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.jobs.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
          >
            <option value="all">{t('admin.jobs.all')}</option>
            <option value="open">{t('admin.jobs.open')}</option>
            <option value="filled">{t('admin.jobs.filled')}</option>
            <option value="in-progress">{t('admin.jobs.in_progress')}</option>
            <option value="completed">{t('admin.jobs.completed')}</option>
            <option value="closed">{t('admin.jobs.closed')}</option>
          </select>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {loading && filteredJobs.length === 0 ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200">
              <Clock className="w-10 h-10 text-gray-400 animate-spin" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200">
              <div className="text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">{t('common.no_data')}</p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {filteredJobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 mb-1 truncate">
                        {job.title || t('common.unknown')}
                      </h3>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                        {job.region && <span className="flex items-center gap-1"><MapPin size={12} />{job.region}</span>}
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} />
                          {((job.price ?? (job as any).salary ?? 0) as number).toLocaleString()} {t('common.uzs')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(job.createdAt, locale)}
                        </span>
                      </div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(job.status)}`}>
                        {job.status || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.view')}
                      >
                        <Eye size={16} />
                      </button>
                      <select
                        value={job.status || 'open'}
                        onChange={(e) => updateJobStatus(job.id, e.target.value)}
                        className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="open">{t('admin.jobs.open')}</option>
                        <option value="filled">{t('admin.jobs.filled')}</option>
                        <option value="in-progress">{t('admin.jobs.in_progress')}</option>
                        <option value="completed">{t('admin.jobs.completed')}</option>
                        <option value="closed">{t('admin.jobs.closed')}</option>
                      </select>
                      <button
                        onClick={() => setConfirm({
                          message: t('admin.jobs.delete_confirm'),
                          action: () => { deleteJob(job.id); setConfirm(null); }
                        })}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('admin.jobs.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {hasMore && (
            <div className="flex justify-center p-4">
              <button
                onClick={() => fetchJobs(false)}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('common.view')}
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      </AnimatePresence>

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
