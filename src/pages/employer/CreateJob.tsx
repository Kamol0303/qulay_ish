import { debugLogger } from '../../lib/debugLogger';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { CATEGORIES } from '../../constants/categories';
import { isValidDistrictId } from '../../constants/districts';
import { Briefcase, MapPin, DollarSign, CalendarClock, CheckCircle, AlertCircle, Sparkles, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';
import { jobService } from '../../services/jobService';
import { isIdentityVerified } from '../../lib/verificationGate';
import { Link } from 'react-router-dom';

export default function CreateJob() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const verified = isIdentityVerified(profile);

  const handleAiVacancy = async () => {
    setAiLoading(true);
    setError(null);
    try {
      const res = await api.ai.vacancy({
        title: formData.title,
        category: formData.category,
        description: formData.description,
        requirements: [],
        region: profile?.region || 'Samarqand viloyati',
        salary: formData.price,
        language: i18n.resolvedLanguage || i18n.language || 'uz',
      });
      setFormData((prev) => ({ ...prev, description: res.text }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error_occurred'));
    } finally {
      setAiLoading(false);
    }
  };
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    scheduledAt: '',
    workType: 'one_time',
  });
  const now = new Date();
  const minimumSchedule = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError(t('errors.no_permission'));
      return;
    }
    if (!isIdentityVerified(profile)) {
      setError(t('verification.required_notice'));
      return;
    }
    
    // Validation
    if (!formData.title || !formData.description || !formData.category || !formData.price || !formData.scheduledAt) {
      setError(t('common.fill_all_fields'));
      return;
    }
    if (!isValidDistrictId(profile?.district)) {
      setError(t('employer.dashboard.profile_district_required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Always use real database - no demo mode for job creation
      const jobId = await jobService.create({
        employerId: user.uid,
        employerName: profile?.fullName || 'Unknown',
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: Number(formData.price),
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
        region: profile.region || 'Samarqand viloyati',
        district: profile.district,
        workType: formData.workType,
        requirements: [],
        status: 'open'
      });

      if (jobId) {
        setSuccess(true);
        setTimeout(() => navigate('/employer/dashboard'), 2000);
      } else {
        setError(t('common.error_occurred'));
      }
    } catch (err) {
      debugLogger.error("Error creating job:", err);
      setError(t('common.error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-foreground tracking-tight">{t('employer.dashboard.post_job')}</h1>
          <p className="text-muted-foreground mt-2">{t('employer.dashboard.post_job_desc')}</p>
        </div>

        {!verified && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 text-amber-800">
            <div className="flex items-center gap-3 flex-1">
              <AlertCircle size={20} className="shrink-0" />
              <p className="font-medium text-sm">{t('verification.required_notice')}</p>
            </div>
            <Link
              to="/verification"
              className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold text-center"
            >
              {t('verification.action')}
            </Link>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
            >
              <AlertCircle size={20} />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border border-green-200 rounded-3xl p-12 text-center"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
                <CheckCircle size={48} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{t('employer.dashboard.job_created')}</h2>
              <p className="text-gray-600">{t('employer.dashboard.redirecting')}...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className={`space-y-8 ${!verified ? 'pointer-events-none opacity-60' : ''}`}>
              {/* Basic Info */}
              <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Briefcase size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{t('employer.dashboard.basic_info')}</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('employer.dashboard.job_title')}</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder={t('employer.dashboard.job_title_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('jobs.category')}</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">{t('common.select')}...</option>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('jobs.description')}</label>
                      <button
                        type="button"
                        onClick={handleAiVacancy}
                        disabled={aiLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
                      >
                        {aiLoading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {t('employer.dashboard.ai_help')}
                      </button>
                    </div>
                    <textarea
                      required
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                      placeholder={t('employer.dashboard.job_desc_placeholder')}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                <div className="flex items-center gap-2 font-bold">
                  <MapPin size={18} className="text-primary" />
                  {t('employer.dashboard.location_automatic')}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t('employer.dashboard.location_automatic_desc', {
                    district: t(`districts.${profile?.district}`, { defaultValue: profile?.district || '—' }),
                  })}
                </p>
              </div>

              {/* Price and work type */}
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                      <DollarSign size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{t('employer.dashboard.price_and_duration')}</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        {t('employer.dashboard.scheduled_at')}
                      </label>
                      <div className="relative">
                        <CalendarClock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                          type="datetime-local"
                          required
                          min={minimumSchedule}
                          value={formData.scheduledAt}
                          onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                          className="w-full px-4 py-3 pl-11 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('employer.dashboard.scheduled_at_hint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('employer.dashboard.offered_price')}</label>
                      <input
                        type="number"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder={t('employer.dashboard.price_placeholder', { defaultValue: 'Masalan: 100000' })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('employer.dashboard.job_type')}</label>
                      <select
                        value={formData.workType}
                        onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="one_time">{t('jobs.one_time')}</option>
                        <option value="daily">{t('jobs.daily')}</option>
                        <option value="permanent">{t('jobs.permanent')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-12 py-5 bg-blue-500 text-white rounded-3xl font-black text-xl hover:bg-blue-600 shadow-2xl shadow-blue-200 transition-all disabled:opacity-50"
                >
                  {loading ? t('common.saving') : t('employer.dashboard.post_job')}
                </button>
              </div>
            </form>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
