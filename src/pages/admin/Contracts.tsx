import React, { useEffect, useState } from 'react';
import { debugLogger } from '../../lib/debugLogger';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { contractService } from '../../services/contractService';
import { jobService } from '../../services/jobService';
import { Contract, Profile, Job } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, CheckCircle, XCircle, Clock, DollarSign,
  User, Briefcase, ShieldCheck, AlertTriangle, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 3000); return () => clearTimeout(id); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, confirmClass = 'bg-blue-600 hover:bg-blue-700' }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4">
        <p className="text-gray-900 font-bold text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Bekor qilish
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl text-white font-bold transition-colors ${confirmClass}`}>
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminContracts() {
  const { t, i18n } = useTranslation();
  const { profile, isDemo } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<(Contract & { employer?: Profile; worker?: Profile; job?: Job })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; confirmClass?: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  useEffect(() => {
    async function fetchContracts() {
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return;
      setLoading(true);

      if (isDemo) {
        setContracts([
          {
            id: '1',
            jobId: 'job1',
            workerId: 'worker1',
            employerId: 'employer1',
            amount: 500000,
            status: 'signed',
            adminApproved: false,
            createdAt: { toDate: () => new Date() } as any,
            employer: { fullName: 'Demo Ish beruvchi' } as any,
            worker: { fullName: 'Demo Ishchi' } as any,
            job: { title: 'Demo Ish' } as any,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            terms: 'Demo shartlar',
            employerSigned: true,
            workerSigned: true
          } as any
        ]);
        setLoading(false);
        return;
      }

      try {
        const contractsData = await contractService.list();

        const combined = await Promise.all(contractsData.map(async (contract) => {
          const [employer, worker, job] = await Promise.all([
            api.users.get(contract.employerId).catch(() => undefined),
            api.users.get(contract.workerId).catch(() => undefined),
            contract.jobId ? jobService.getById(contract.jobId).catch(() => undefined) : Promise.resolve(undefined),
          ]);
          return { ...contract, employer, worker, job };
        }));

        setContracts(combined);
      } catch (error) {
        debugLogger.error('Error loading contracts:', error);
        showToast(t('common.error'), 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();
  }, [profile]);

  async function handleApprove(contractId: string) {
    setActionLoading(contractId);
    setConfirm(null);
    try {
      await api.contracts.update(contractId, {
        adminApproved: true,
        status: 'active',
      });
      setContracts(prev => prev.map(c =>
        c.id === contractId ? { ...c, adminApproved: true, status: 'active' } : c
      ));
      showToast(t('common.success'), 'success');
    } catch (error) {
      debugLogger.error('Error approving contract:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(contractId: string) {
    setActionLoading(contractId);
    setConfirm(null);
    try {
      await api.contracts.update(contractId, {
        adminApproved: false,
        status: 'cancelled',
      });
      setContracts(prev => prev.map(c =>
        c.id === contractId ? { ...c, adminApproved: false, status: 'cancelled' } : c
      ));
      showToast(t('common.success'), 'success');
    } catch (error) {
      debugLogger.error('Error approving contract:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const getDateLocale = () => i18n.language === 'ru' ? ru : i18n.language === 'en' ? enUS : uz;

  const statusLabel = (status?: string) => {
    if (!status) return '-';
    const map: Record<string, string> = {
      active: t('common.active'),
      signed: t('common.accepted'),
      draft: t('common.pending'),
      completed: t('common.completed'),
      cancelled: t('common.cancelled'),
      disputed: t('common.pending'),
    };
    return map[status] || status;
  };

  const statusClass = (status?: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-50 text-green-600',
      signed: 'bg-blue-50 text-blue-600',
      draft: 'bg-amber-50 text-amber-600',
      completed: 'bg-gray-100 text-gray-500',
      cancelled: 'bg-red-50 text-red-600',
    };
    return map[status || ''] || 'bg-gray-100 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('admin.contracts.title')}</h2>
          <p className="text-muted-foreground mt-2">{t('admin.contracts.subtitle')}</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-secondary/50 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : contracts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {contracts.map((contract) => (
                <motion.div
                  key={contract.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="p-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Parties */}
                      <div className="flex flex-col gap-4 min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Briefcase size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('auth.employer')}</p>
                            <p className="text-sm font-bold">{contract.employer?.fullName || contract.employerName || t('common.unknown_user')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('auth.worker')}</p>
                            <p className="text-sm font-bold">{contract.worker?.fullName || contract.workerName || t('common.unknown_worker')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Contract details */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <FileText size={14} />
                          <span>ID: {contract.id.slice(0, 8).toUpperCase()} • {contract.job?.title || contract.jobTitle || '-'}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('common.price')}</p>
                            <p className="text-lg font-bold text-primary">{(contract.amount || contract.salary || 0).toLocaleString()} {t('common.uzs')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('common.status')}</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-1 ${statusClass(contract.status)}`}>
                              {statusLabel(contract.status)}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('admin.contracts.admin_approval')}</p>
                            {contract.adminApproved ? (
                              <span className="text-green-600 font-bold text-sm flex items-center gap-1 mt-1">
                                <ShieldCheck size={14} /> {t('common.approved')}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold text-sm flex items-center gap-1 mt-1">
                                <Clock size={14} /> {t('common.pending')}
                              </span>
                            )}
                          </div>
                        </div>
                        {contract.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            {format(contract.createdAt.toDate?.() || new Date(contract.createdAt), 'dd MMM yyyy', { locale: getDateLocale() })}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col justify-center gap-3 min-w-[200px]">
                        {!contract.adminApproved && (contract.status === 'signed' || contract.status === 'draft') && (
                          <>
                            <button
                              onClick={() => setConfirm({
                                message: t('admin.contracts.confirm_approve'),
                                action: () => handleApprove(contract.id),
                                confirmClass: 'bg-green-600 hover:bg-green-700'
                              })}
                              disabled={actionLoading === contract.id}
                              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                            >
                              {actionLoading === contract.id
                                ? <Clock size={18} className="animate-spin" />
                                : <ShieldCheck size={18} />}
                              {t('common.approve')}
                            </button>
                            <button
                              onClick={() => setConfirm({
                                message: t('admin.contracts.confirm_reject'),
                                action: () => handleReject(contract.id),
                                confirmClass: 'bg-red-600 hover:bg-red-700'
                              })}
                              disabled={actionLoading === contract.id}
                              className="w-full py-3 bg-card text-destructive border border-destructive/20 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-destructive/5 transition-all disabled:opacity-50"
                            >
                              <XCircle size={18} />
                              {t('admin.contracts.reject_contract')}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/contracts/${contract.id}`)}
                          className="w-full py-3 bg-card border border-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary transition-all"
                        >
                          <FileText size={18} />
                          {t('admin.contracts.review')}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-secondary/20 rounded-[40px] p-20 text-center border-2 border-dashed border-border">
            <FileText size={40} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold text-foreground">{t('admin.contracts.no_contracts')}</h3>
            <p className="text-muted-foreground mt-2">{t('admin.contracts.no_contracts_desc')}</p>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
          confirmClass={confirm.confirmClass}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
