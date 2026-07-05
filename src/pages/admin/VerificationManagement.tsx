import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { VerificationRequest, Profile } from '../../types';
import {
  ShieldCheck, CheckCircle, XCircle, Clock, AlertTriangle,
  Calendar, ExternalLink, X, ZoomIn, Image
} from 'lucide-react';
import { format } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

// Resolve real photo URL from verification request — supports multiple field names
function resolveDocUrl(req: VerificationRequest & { user?: Profile }): string | null {
  return (req as any).documentPhotoUrl
    || (req as any).documentImageUrl
    || (req as any).idCardUrl
    || (req as any).passportUrl
    || (req as any).idPhotoUrl
    || (req as any).documentUrl
    || (req as any).verification?.documentUrl
    || (req as any).verification?.documentPhotoUrl
    || null;
}

function resolveSelfieUrl(req: VerificationRequest & { user?: Profile }): string | null {
  return (req as any).selfiePhotoUrl
    || (req as any).selfieUrl
    || (req as any).verification?.selfieUrl
    || (req as any).verification?.selfiePhotoUrl
    || null;
}

// Image preview modal
function ImagePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <X size={28} />
        </button>
        <img src={url} alt="Preview" className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
      </div>
    </div>
  );
}

// Rejection reason modal
function RejectModal({ onConfirm, onCancel, t }: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full">
        <h3 className="text-lg font-black text-gray-900 mb-4">{t('admin.verification.reject_reason')}</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('admin.verification.reject_reason_placeholder')}
          rows={3}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Bekor qilish
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-40"
          >
            {t('common.reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 3000); return () => clearTimeout(id); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[300] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}

// Photo slot component
function PhotoSlot({ url, label, noLabel, onPreview }: {
  url: string | null;
  label: string;
  noLabel: string;
  onPreview: (url: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border relative group bg-gray-50 flex items-center justify-center">
        {url ? (
          <>
            <img
              src={url}
              alt={label}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <button
              onClick={() => onPreview(url)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <ZoomIn size={22} className="text-white" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 p-4 text-center">
            <Image size={28} />
            <p className="text-xs font-medium">{noLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerificationManagement() {
  const { t, i18n } = useTranslation();
  const { isDemo, profile } = useAuth();
  const [requests, setRequests] = useState<(VerificationRequest & { user?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; userId: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  async function fetchRequests() {
    setLoading(true);
    if (isDemo) {
      setRequests([
        {
          id: '1',
          userId: 'demo_worker',
          status: 'pending',
          // No picsum — real fields empty so placeholder shows
          idPhotoUrl: undefined,
          selfieUrl: undefined,
          createdAt: { toDate: () => new Date() } as any,
          user: { fullName: 'Demo Ishchi', role: 'worker', region: 'Samarqand viloyati' } as any
        } as any,
      ]);
      setLoading(false);
      return;
    }
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const rows = await api.verificationRequests.list(params);
      const data = await Promise.all(rows.map(async (req) => {
        const user = await api.users.get(req.userId).catch(() => undefined);
        return { ...req, user };
      }));
      setRequests(data);
    } catch (error) {
      debugLogger.error('Error fetching verification requests:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(requestId: string, userId: string) {
    setActionLoading(requestId);
    try {
      await api.verificationRequests.update(requestId, {
        status: 'verified',
        reviewedBy: profile?.uid,
      });
      await api.users.update(userId, {
        isVerified: true,
        verificationStatus: 'verified',
      });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'verified' } : r));
      showToast(t('common.success'), 'success');
    } catch (error) {
      showToast(t('common.error'), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(requestId: string, userId: string, reason: string) {
    setActionLoading(requestId);
    setRejectTarget(null);
    try {
      await api.verificationRequests.update(requestId, {
        status: 'rejected',
        reviewNote: reason,
        reviewedBy: profile?.uid,
      });
      await api.users.update(userId, {
        isVerified: false,
        verificationStatus: 'rejected',
      });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
      showToast(t('common.success'), 'success');
    } catch (error) {
      showToast(t('common.error'), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const getDateLocale = () => i18n.language === 'ru' ? ru : i18n.language === 'en' ? enUS : uz;

  const tabs = [
    { key: 'all', label: t('common.all') },
    { key: 'pending', label: t('common.pending') },
    { key: 'approved', label: t('common.approved') },
    { key: 'rejected', label: t('admin.verification.rejected_tab') },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('admin.verification.title')}</h2>
            <p className="text-muted-foreground mt-2">{t('admin.verification.subtitle')}</p>
          </div>
          <div className="flex items-center gap-1 bg-card p-1 rounded-2xl border border-border shadow-sm flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === tab.key ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="bg-card h-96 rounded-3xl animate-pulse border border-border" />
              ))
            ) : requests.length > 0 ? (
              requests.map((req) => {
                const docUrl = resolveDocUrl(req);
                const selfieUrl = resolveSelfieUrl(req);
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm flex flex-col"
                  >
                    {/* User header */}
                    <div className="p-6 border-b border-border">
                      <div className="flex items-center gap-4 mb-4">
                        <img
                          src={req.user?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user?.fullName || 'User')}`}
                          alt=""
                          className="w-12 h-12 rounded-2xl object-cover border border-border"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="font-bold text-foreground">{req.user?.fullName || t('common.unknown_user')}</h4>
                          <p className="text-xs text-muted-foreground capitalize">
                            {req.user?.role === 'worker' ? t('auth.worker') : t('auth.employer')} • {req.user?.region || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {req.createdAt ? format(new Date(req.createdAt as string), 'dd MMM, yyyy', { locale: getDateLocale() }) : '-'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                          req.status === 'approved' ? 'bg-green-100 text-green-600' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {req.status === 'approved' ? t('common.approved') :
                           req.status === 'rejected' ? t('admin.verification.rejected_tab') :
                           t('common.pending')}
                        </span>
                      </div>
                    </div>

                    {/* Photos */}
                    <div className="p-6 space-y-4 flex-1">
                      <div className="grid grid-cols-2 gap-4">
                        <PhotoSlot
                          url={docUrl}
                          label={t('admin.verification.id_photo')}
                          noLabel={t('admin.verification.no_id_photo')}
                          onPreview={setPreviewUrl}
                        />
                        <PhotoSlot
                          url={selfieUrl}
                          label={t('admin.verification.selfie')}
                          noLabel={t('admin.verification.no_selfie')}
                          onPreview={setPreviewUrl}
                        />
                      </div>
                      {/* Show rejection note if rejected */}
                      {req.status === 'rejected' && (req as any).reviewNote && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
                          <span className="font-bold">{t('admin.verification.reject_reason')}: </span>
                          {(req as any).reviewNote}
                        </div>
                      )}
                    </div>

                    {/* Actions — only for pending */}
                    {req.status === 'pending' && (
                      <div className="p-6 bg-muted/30 border-t border-border grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setRejectTarget({ id: req.id!, userId: req.userId })}
                          disabled={actionLoading === req.id}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                          <XCircle size={18} /> {t('common.reject')}
                        </button>
                        <button
                          onClick={() => handleApprove(req.id!, req.userId)}
                          disabled={actionLoading === req.id}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                        >
                          {actionLoading === req.id
                            ? <Clock size={18} className="animate-spin" />
                            : <CheckCircle size={18} />}
                          {t('common.approve')}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center bg-card rounded-3xl border border-border">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-lg font-bold text-foreground">{t('admin.verification.no_requests')}</h3>
                <p className="text-muted-foreground">{t('admin.verification.no_requests_desc')}</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image preview modal */}
      <AnimatePresence>
        {previewUrl && <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
      </AnimatePresence>

      {/* Reject reason modal */}
      {rejectTarget && (
        <RejectModal
          t={t}
          onConfirm={(reason) => handleReject(rejectTarget.id, rejectTarget.userId, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
