import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  UserPlus,
  Loader2,
  Trash2,
  KeyRound,
  AlertCircle,
  CheckCircle,
  Phone,
  Users,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api, type AdminStaffUser } from '../../lib/api';

type NewAdmin = {
  fullName: string;
  phone: string;
  password: string;
  role: 'admin' | 'super_admin';
};

const EMPTY_FORM: NewAdmin = {
  fullName: '',
  phone: '',
  password: '',
  role: 'admin',
};

function normalizePhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (input.startsWith('+')) return input.trim();
  return input.trim();
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [staff, setStaff] = useState<AdminStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewAdmin>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.adminUsers.list();
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || t('admin_users.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const phone = normalizePhone(form.phone);
    if (!/^\+998\d{9}$/.test(phone)) {
      setError(t('admin_users.err_phone'));
      return;
    }
    if (form.fullName.trim().length < 2) {
      setError(t('admin_users.err_name'));
      return;
    }
    if (form.password.length < 8) {
      setError(t('admin_users.err_password'));
      return;
    }

    setSubmitting(true);
    try {
      await api.adminUsers.create({
        fullName: form.fullName.trim(),
        phone,
        password: form.password,
        role: form.role,
      });
      setSuccess(t('admin_users.created'));
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      setError(e?.message || t('admin_users.create_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (u: AdminStaffUser) => {
    const next = window.prompt(t('admin_users.prompt_new_password', { name: u.fullName }));
    if (next == null) return;
    if (next.length < 8) {
      setError(t('admin_users.err_password'));
      return;
    }
    setError('');
    setSuccess('');
    setBusyId(u.uid);
    try {
      await api.adminUsers.resetPassword(u.uid, next);
      setSuccess(t('admin_users.password_reset'));
    } catch (e: any) {
      setError(e?.message || t('admin_users.reset_error'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (u: AdminStaffUser) => {
    if (!window.confirm(t('admin_users.confirm_delete', { name: u.fullName }))) return;
    setError('');
    setSuccess('');
    setBusyId(u.uid);
    try {
      await api.adminUsers.remove(u.uid);
      setSuccess(t('admin_users.deleted'));
      setStaff((prev) => prev.filter((s) => s.uid !== u.uid));
    } catch (e: any) {
      setError(e?.message || t('admin_users.delete_error'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('admin_users.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('admin_users.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="rounded-3xl border border-border bg-card p-6 space-y-5"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold">{t('admin_users.add_title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">{t('admin_users.field_name')}</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder={t('admin_users.ph_name')}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">{t('admin_users.field_login')}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+998901234567"
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">{t('admin_users.field_password')}</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={t('admin_users.ph_password')}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">{t('admin_users.field_role')}</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'super_admin' }))
                }
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="admin">{t('admin_users.role_admin')}</option>
                <option value="super_admin">{t('admin_users.role_super_admin')}</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {t('admin_users.create_button')}
          </button>
        </motion.form>

        <div className="rounded-3xl border border-border bg-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold">{t('admin_users.list_title')}</h2>
            <span className="ml-auto text-sm text-muted-foreground">{staff.length}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('common.loading')}</span>
            </div>
          ) : staff.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t('admin_users.empty')}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {staff.map((u) => (
                <li key={u.uid} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold truncate">{u.fullName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          u.role === 'super_admin'
                            ? 'bg-purple-500/10 text-purple-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}
                      >
                        {t(`admin_users.role_${u.role}`)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{u.phoneNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReset(u)}
                      disabled={busyId === u.uid}
                      title={t('admin_users.reset_password')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('admin_users.reset_password')}</span>
                    </button>
                    {u.uid !== profile?.uid && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={busyId === u.uid}
                        title={t('admin_users.delete')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {busyId === u.uid ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{t('admin_users.delete')}</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
