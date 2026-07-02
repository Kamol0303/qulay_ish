import { debugLogger } from '../../lib/debugLogger';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { REGIONS, DISTRICTS } from '../../constants/locations';
import { CATEGORIES } from '../../constants/categories';
import { Briefcase, MapPin, DollarSign, Calendar, FileText, Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../../lib/utils';
import { jobService } from '../../services/jobService';

export default function CreateJob() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, isDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    region: '',
    district: '',
    neighborhood: '',
    workType: 'one_time',
    requirements: [] as string[],
    currentRequirement: ''
  });

  const handleAddRequirement = () => {
    if (formData.currentRequirement.trim()) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, prev.currentRequirement.trim()],
        currentRequirement: ''
      }));
    }
  };

  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError(t('errors.no_permission'));
      return;
    }
    
    // Validation
    if (!formData.title || !formData.description || !formData.category || !formData.price || !formData.region || !formData.district) {
      setError(t('common.fill_all_fields'));
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
        region: formData.region,
        district: formData.district,
        neighborhood: formData.neighborhood,
        workType: formData.workType,
        requirements: formData.requirements.filter(r => r.trim()), // Filter empty strings
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
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('employer.dashboard.post_job')}</h1>
          <p className="text-gray-500 mt-2">{t('employer.dashboard.post_job_desc')}</p>
        </div>

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
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Info */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Briefcase size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{t('employer.dashboard.basic_info')}</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('employer.dashboard.job_title')}</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder={t('employer.dashboard.job_title_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('jobs.category')}</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">{t('common.select')}...</option>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('jobs.description')}</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                      placeholder={t('employer.dashboard.job_desc_placeholder')}
                    />
                  </div>
                </div>
              </div>

              {/* Location & Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                      <MapPin size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{t('common.location')}</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">{t('profile.region')}</p>
                      <p className="text-sm font-black text-blue-900">{t('common.region_name', { defaultValue: 'Samarqand viloyati' })}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('profile.district')}</label>
                      <select
                        required
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value, region: 'Samarqand viloyati' })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="">{t('common.select')}...</option>
                        {DISTRICTS["Samarqand viloyati"].map(d => <option key={d} value={d}>{t(`districts.${getDistrictKey(d)}`)}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('profile.neighborhood')}</label>
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder={t('auth.neighborhood_placeholder')}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                      <DollarSign size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{t('employer.dashboard.price_and_duration')}</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('employer.dashboard.offered_price')}</label>
                      <input
                        type="number"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder={t('employer.dashboard.price_placeholder', { defaultValue: 'Masalan: 100000' })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('employer.dashboard.job_type')}</label>
                      <select
                        value={formData.workType}
                        onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="one_time">{t('jobs.one_time')}</option>
                        <option value="daily">{t('jobs.daily')}</option>
                        <option value="permanent">{t('jobs.permanent')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{t('jobs.requirements')}</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.currentRequirement}
                      onChange={(e) => setFormData({ ...formData, currentRequirement: e.target.value })}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none"
                      placeholder={t('employer.dashboard.requirement_placeholder')}
                    />
                    <button
                      type="button"
                      onClick={handleAddRequirement}
                      className="bg-gray-900 text-white px-6 rounded-xl font-bold hover:bg-gray-800"
                    >
                      {t('auth.add')}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.requirements.map((req, index) => (
                      <div key={`req-${index}-${req}`} className="bg-gray-100 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-sm text-gray-700">{req}</span>
                        <button
                          type="button"
                          onClick={() => removeRequirement(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
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
