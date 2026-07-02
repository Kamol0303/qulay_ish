import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, getDocs, orderBy, doc, updateDoc, where, getDoc } from 'firebase/firestore';
import { Dispute, Profile, Contract } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, CheckCircle, XCircle, Clock, FileText,
  ShieldAlert, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4">
        <p className="text-gray-900 font-bold text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Bekor qilish
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors">
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDisputes() {
  const { t, i18n } = useTranslation();
  const { profile, isDemo } = useAuth();
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<(Dispute & { openedBy?: Profile; contract?: Contract })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  useEffect(() => {
    async function fetchDisputes() {
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return;
      setLoading(true);

      if (isDemo) {
        setDisputes([
          {
            id: '1',
            contractId: 'contract1',
            openedById: 'user1',
            reason: 'Ish oʻz vaqtida bajarilmadi',
            status: 'pending',
            createdAt: { toDate: () => new Date() } as any,
            openedBy: { fullName: 'Demo Foydalanuvchi' } as any,
            contract: { id: 'contract1' } as any
          }
        ]);
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'disputes'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const disputesData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Dispute));

        const combined = await Promise.all(disputesData.map(async (dispute) => {
          const [userSnap, contractSnap] = await Promise.all([
            getDocs(query(collection(db, 'profiles'), where('uid', '==', dispute.openedById))),
            getDoc(doc(db, 'contracts', dispute.contractId))
          ]);
          return {
            ...dispute,
            openedBy: userSnap.docs[0]?.data() as Profile | undefined,
            contract: contractSnap.exists() ? (contractSnap.data() as Contract) : undefined
          };
        }));

        setDisputes(combined);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'disputes');
        showToast(t('common.error'), 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchDisputes();
  }, [profile]);

  async function handleResolve(disputeId: string, status: 'resolved' | 'rejected') {
    setActionLoading(disputeId);
    try {
      await updateDoc(doc(db, 'disputes', disputeId), {
        status,
        resolvedAt: new Date().toISOString()
      });
      setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status } : d));
      showToast(t('common.success'), 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `disputes/${disputeId}`);
      showToast(t('common.error'), 'error');
    } finally {
      setActionLoading(null);
      setConfirm(null);
    }
  }

  // Navigate to contract — stay inside super-admin if that's the current role
  function goToContract(contractId: string) {
    if (!contractId) return;
    const base = profile?.role === 'super_admin' ? '/super-admin/contracts' : '/admin/contracts';
    navigate(`/contracts/${contractId}`);
  }

  const getDateLocale = () => i18n.language === 'ru' ? ru : i18n.language === 'en' ? enUS : uz;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('admin.disputes.title')}</h2>
          <p className="text-muted-foreground mt-2">{t('admin.disputes.subtitle')}</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-secondary/50 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : disputes.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {disputes.map((dispute) => (
                <motion.div
                  key={dispute.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="p-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Dispute Info */}
                      <div className="flex flex-col gap-4 min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                            <ShieldAlert size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('admin.disputes.opened_by')}</p>
                            <p className="text-sm font-bold">{dispute.openedBy?.fullName || t('common.unknown_user')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('admin.disputes.contract_id')}</p>
                            <p className="text-sm font-bold font-mono">{dispute.contractId?.slice(0, 8).toUpperCase() || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Dispute Content */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <AlertTriangle size={14} className="text-amber-500" />
                          <span>
                            {t('common.status')}: {
                              dispute.status === 'resolved' ? t('common.resolved') :
                              dispute.status === 'rejected' ? t('common.rejected') :
                              t('common.pending')
                            } • {format(dispute.createdAt?.toDate?.() || new Date(), 'd MMM, HH:mm', { locale: getDateLocale() })}
                          </span>
                        </div>
                        <div className="bg-secondary/30 p-5 rounded-2xl border border-border/50 text-muted-foreground text-sm leading-relaxed italic">
                          "{dispute.reason}"
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col justify-center gap-3 min-w-[200px]">
                        {dispute.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => setConfirm({
                                message: t('admin.disputes.confirm_resolve'),
                                action: () => handleResolve(dispute.id, 'resolved')
                              })}
                              disabled={actionLoading === dispute.id}
                              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                            >
                              {actionLoading === dispute.id
                                ? <Clock size={18} className="animate-spin" />
                                : <CheckCircle size={18} />}
                              {t('admin.disputes.resolve')}
                            </button>
                            <button
                              onClick={() => setConfirm({
                                message: t('admin.disputes.confirm_reject'),
                                action: () => handleResolve(dispute.id, 'rejected')
                              })}
                              disabled={actionLoading === dispute.id}
                              className="w-full py-3 bg-card text-destructive border border-destructive/20 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-destructive/5 transition-all disabled:opacity-50"
                            >
                              <XCircle size={18} />
                              {t('common.reject')}
                            </button>
                          </>
                        ) : (
                          <div className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
                            dispute.status === 'resolved'
                              ? 'bg-green-50 text-green-700 border border-green-100'
                              : 'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {dispute.status === 'resolved' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                            {dispute.status === 'resolved' ? t('common.resolved') : t('common.rejected')}
                          </div>
                        )}

                        {dispute.contractId ? (
                          <button
                            onClick={() => goToContract(dispute.contractId)}
                            className="w-full py-3 bg-card border border-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary transition-all"
                          >
                            <FileText size={18} />
                            {t('admin.disputes.view_contract')}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold flex items-center justify-center gap-2 text-gray-400 cursor-not-allowed"
                            title="Shartnoma ID mavjud emas"
                          >
                            <FileText size={18} />
                            {t('admin.disputes.view_contract')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-secondary/20 rounded-[40px] p-20 text-center border-2 border-dashed border-border">
            <AlertTriangle size={40} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold text-foreground">{t('admin.disputes.no_disputes')}</h3>
            <p className="text-muted-foreground mt-2">{t('admin.disputes.no_disputes_desc')}</p>
          </div>
        )}
      </div>

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
