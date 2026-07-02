import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { db } from '../../firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Profile } from '../../types';
import {
  Users, Search, UserX, CheckCircle, Mail, Phone,
  Clock, AlertTriangle, Eye, ShieldCheck, ShieldOff,
  X, Trash2, MapPin, Calendar, Loader
} from 'lucide-react';
import { format, type Locale } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { performanceUtils } from '../../lib/performance';
import { demoStore } from '../../lib/demoStore';

// Safe date parser
function safeDate(val: any): Date | null {
  if (!val) return null;
  try {
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
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

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4">
        <p className="text-gray-900 font-bold text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Bekor qilish
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader size={14} className="animate-spin" />}
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function UserModal({ user, onClose, onVerify, onBlock, onUnblock, onDelete, actionLoading }: {
  user: Profile;
  onClose: () => void;
  onVerify: (u: Profile) => void;
  onBlock: (u: Profile) => void;
  onUnblock: (u: Profile) => void;
  onDelete: (u: Profile) => void;
  actionLoading: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'uz' ? uz : i18n.language === 'ru' ? ru : enUS;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900">{t('admin.users.view_details')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
              {user.photoUrl
                ? <img src={user.photoUrl} alt={user.fullName} className="w-full h-full object-cover" />
                : <Users size={24} className="text-blue-400" />}
            </div>
            <div>
              <p className="font-black text-gray-900 text-lg">{user.fullName}</p>
              <span className="inline-block px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                {t(`auth.${user.role}`)}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            {user.email && (
              <div className="flex items-center gap-3 text-gray-600">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <span>{user.email}</span>
              </div>
            )}
            {user.phoneNumber && (
              <div className="flex items-center gap-3 text-gray-600">
                <Phone size={16} className="text-gray-400 shrink-0" />
                <span>{user.phoneNumber}</span>
              </div>
            )}
            {user.region && (
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin size={16} className="text-gray-400 shrink-0" />
                <span>{user.region}{user.district ? `, ${user.district}` : ''}</span>
              </div>
            )}
            {user.createdAt && (
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <span>{formatDate(user.createdAt, locale)}</span>
              </div>
            )}
          </div>

          {/* Status badges — live from current user prop */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              user.isBlocked ? 'bg-red-50 text-red-700' :
              user.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}>
              {user.isBlocked
                ? t('common.blocked')
                : user.isVerified
                  ? t('admin.users.verified_status')
                  : t('admin.users.pending_status')}
            </span>
            {(user as any).verificationStatus && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-600">
                {(user as any).verificationStatus}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 space-y-3">
          {/* Verify / Unverify */}
          {!user.isBlocked && (
            <button
              onClick={() => onVerify(user)}
              disabled={actionLoading}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                user.isVerified
                  ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
              }`}
            >
              {actionLoading ? <Loader size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {user.isVerified ? t('admin.users.unverify') : t('admin.users.verify')}
            </button>
          )}

          {/* Block / Unblock */}
          {user.isBlocked ? (
            <button
              onClick={() => onUnblock(user)}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
            >
              {actionLoading ? <Loader size={16} className="animate-spin" /> : <ShieldOff size={16} />}
              {t('admin.users.unblock')}
            </button>
          ) : (
            <button
              onClick={() => onBlock(user)}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50"
            >
              {actionLoading ? <Loader size={16} className="animate-spin" /> : <UserX size={16} />}
              {t('admin.users.block')}
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(user)}
            disabled={actionLoading}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
          >
            {actionLoading ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t('common.delete')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function UsersManagement() {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => Promise<void> } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  // Keep a ref to current users so applyUserPatch can read it without stale closure
  const usersRef = React.useRef<Profile[]>([]);
  useEffect(() => { usersRef.current = users; }, [users]);

  const locale = i18n.language === 'uz' ? uz : i18n.language === 'ru' ? ru : enUS;

  useEffect(() => { fetchUsers(true); }, [roleFilter, verificationFilter]);

  async function fetchUsers(reset = false) {
    setLoading(true);
    try {
      const constraints: any[] = [];
      if (roleFilter !== 'all') constraints.push(where('role', '==', roleFilter));
      if (verificationFilter === 'verified') constraints.push(where('isVerified', '==', true));
      if (verificationFilter === 'unverified') constraints.push(where('isVerified', '==', false));
      constraints.push(orderBy('createdAt', 'desc'));

      const q = performanceUtils.createPaginatedQuery(
        'profiles', constraints, pageSize,
        reset ? undefined : (lastVisible || undefined)
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Profile));

      const merged = reset ? demoStore.mergeUsers(fetched) : [...users, ...fetched];
      setUsers(merged as Profile[]);

      if (snap.docs.length > 0) {
        setLastVisible(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length === pageSize);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      debugLogger.error('Error fetching users:', error);
      const localUsers = demoStore.getUsers();
      setUsers(localUsers as Profile[]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  /** Apply a patch to a user in all state layers: local state, selectedUser, demoStore, Firestore */
  const applyUserPatch = useCallback(async (uid: string, patch: Partial<Profile> & Record<string, any>) => {
    const now = new Date().toISOString();
    const patchWithTime = { ...patch, updatedAt: now };

    // 1. Update local React state immediately (optimistic)
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...patchWithTime } : u));
    setSelectedUser(prev => prev?.uid === uid ? { ...prev, ...patchWithTime } as Profile : prev);

    // 2. Persist to localStorage — upsert full record so status survives page navigation.
    //    Use usersRef to get the current user without stale closure.
    const current = usersRef.current.find(u => u.uid === uid);
    if (current) {
      demoStore.upsertUser({ ...current, ...patchWithTime });
    } else {
      demoStore.updateUser(uid, patchWithTime);
    }

    // 3. Try Firestore (best-effort — fails silently for demo users without write permission)
    try {
      await updateDoc(doc(db, 'profiles', uid), patchWithTime);
    } catch (err) {
      debugLogger.warn('[UsersManagement] Firestore update skipped (demo user or permission denied):', err);
    }
  }, []);

  async function handleVerify(user: Profile) {
    const newVal = !user.isVerified;
    setActionLoading(true);
    try {
      await applyUserPatch(user.uid, {
        isVerified: newVal,
        verificationStatus: newVal ? 'verified' : 'none',
        status: newVal ? 'active' : (user as any).status,
      });
      showToast(newVal ? "Foydalanuvchi tasdiqlandi" : "Tasdiqlash bekor qilindi", 'success');
    } catch {
      showToast("Xatolik yuz berdi", 'error');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  async function handleBlock(user: Profile) {
    setActionLoading(true);
    try {
      await applyUserPatch(user.uid, {
        isBlocked: true,
        status: 'blocked',
        blockedAt: new Date().toISOString(),
      });
      showToast("Foydalanuvchi bloklandi", 'success');
    } catch {
      showToast("Xatolik yuz berdi", 'error');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  async function handleUnblock(user: Profile) {
    setActionLoading(true);
    try {
      await applyUserPatch(user.uid, {
        isBlocked: false,
        status: 'active',
        unblockedAt: new Date().toISOString(),
      });
      showToast("Foydalanuvchi blokdan chiqarildi", 'success');
    } catch {
      showToast("Xatolik yuz berdi", 'error');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  async function handleDelete(user: Profile) {
    setActionLoading(true);
    try {
      await applyUserPatch(user.uid, { status: 'deleted', isBlocked: true });
      demoStore.removeUser(user.uid);
      setUsers(prev => prev.filter(u => u.uid !== user.uid));
      setSelectedUser(null);
      showToast("Foydalanuvchi o'chirildi", 'success');
    } catch {
      showToast("Xatolik yuz berdi", 'error');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  const filteredUsers = users
    .filter(u => u && u.uid)
    .filter(u =>
      !search ||
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phoneNumber?.includes(search)
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('admin.users.title')}</h1>
          <p className="text-gray-600 text-sm mt-1">{t('admin.users.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.users.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
            >
              <option value="all">{t('admin.users.all')}</option>
              <option value="worker">{t('auth.worker')}</option>
              <option value="employer">{t('auth.employer')}</option>
              <option value="admin">{t('auth.admin')}</option>
              <option value="super_admin">{t('auth.super_admin')}</option>
            </select>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
            >
              <option value="all">{t('admin.users.all')}</option>
              <option value="verified">{t('admin.users.verified')}</option>
              <option value="unverified">{t('admin.users.unverified')}</option>
            </select>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading && filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Clock className="w-10 h-10 text-gray-400 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">{t('admin.users.not_found')}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">{t('admin.users.table.user')}</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">{t('admin.users.table.role_region')}</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">{t('admin.users.table.contact')}</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">{t('admin.users.table.status')}</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">{t('admin.users.table.date')}</th>
                    <th className="px-6 py-4 text-right font-bold text-gray-700">{t('admin.users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredUsers.map((user) => (
                      <motion.tr
                        key={user.uid}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">{user.fullName}</p>
                            <p className="text-xs text-gray-500">{user.region}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                            {t(`auth.${user.role}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 text-xs">
                            {user.email && <div className="flex items-center gap-2 text-gray-600"><Mail size={14} />{user.email}</div>}
                            {user.phoneNumber && <div className="flex items-center gap-2 text-gray-600"><Phone size={14} />{user.phoneNumber}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                            user.isBlocked ? 'bg-red-50 text-red-700' :
                            user.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                          }`}>
                            {user.isBlocked
                              ? <><UserX size={12} />{t('common.blocked')}</>
                              : user.isVerified
                                ? <><CheckCircle size={12} />{t('admin.users.verified_status')}</>
                                : <><AlertTriangle size={12} />{t('admin.users.pending_status')}</>}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {formatDate(user.createdAt, locale)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <Eye size={14} />
                            {t('admin.users.view_details')}
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
          {hasMore ? (
            <div className="p-4 border-t border-gray-200 flex justify-center">
              <button
                onClick={() => fetchUsers(false)}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('common.view')}
              </button>
            </div>
          ) : users.length > 0 ? (
            <div className="p-4 border-t border-gray-200 flex justify-center">
              <button
                onClick={() => showToast("Barcha foydalanuvchilar ko'rsatildi", 'success')}
                className="px-6 py-2 bg-gray-100 text-gray-500 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                {t('common.view')}
              </button>
            </div>
          ) : null}
        </motion.div>
      </div>

      {/* User detail modal */}
      <AnimatePresence>
        {selectedUser && (
          <UserModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            actionLoading={actionLoading}
            onVerify={(u) => setConfirm({
              message: u.isVerified ? t('admin.users.unverify') + '?' : "Foydalanuvchini tasdiqlashni xohlaysizmi?",
              action: () => handleVerify(u)
            })}
            onBlock={(u) => setConfirm({
              message: t('admin.users.confirm_block'),
              action: () => handleBlock(u)
            })}
            onUnblock={(u) => setConfirm({
              message: "Foydalanuvchini blokdan chiqarishni tasdiqlaysizmi?",
              action: () => handleUnblock(u)
            })}
            onDelete={(u) => setConfirm({
              message: t('admin.users.confirm_delete'),
              action: () => handleDelete(u)
            })}
          />
        )}
      </AnimatePresence>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          loading={actionLoading}
          onConfirm={() => confirm.action()}
          onCancel={() => !actionLoading && setConfirm(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
