import { debugLogger } from '../../lib/debugLogger';
import React, { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { REGIONS, DISTRICTS } from '../../constants/locations';
import { SKILLS } from '../../constants/categories';
import { Briefcase, MapPin, CheckCircle, ArrowRight, ArrowLeft, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../../lib/utils';

export default function CreateServicePost() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    expectedPrice: '',
    region: profile?.region || '',
    district: profile?.district || '',
    neighborhood: profile?.neighborhood || '',
    images: [] as string[],
    customImageUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    
    setLoading(true);
    setError(null);

    try {
      await api.servicePosts.create({
        workerId: profile.uid,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        expectedPrice: Number(formData.expectedPrice),
        region: formData.region,
        district: formData.district,
        images: formData.images,
        status: 'active',
      });

      navigate('/worker/service-posts');
    } catch (error: any) {
      debugLogger.error('Error creating service post:', error);
      setError(t('common.error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  const addImage = () => {
    if (formData.customImageUrl && !formData.images.includes(formData.customImageUrl)) {
      setFormData({
        ...formData,
        images: [...formData.images, formData.customImageUrl],
        customImageUrl: ''
      });
    }
  };

  const removeImage = (url: string) => {
    setFormData({
      ...formData,
      images: formData.images.filter(img => img !== url)
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('worker.dashboard.post_service')}</h2>
            <p className="text-muted-foreground mt-2">{t('worker.dashboard.post_service_desc')}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white font-bold transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('common.back')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('employer.dashboard.job_title')}</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder={t('employer.dashboard.job_title_placeholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('jobs.category')}</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  <option value="">{t('common.select')}</option>
                  {SKILLS.map(skill => (
                    <option key={skill.id} value={skill.id}>{t(`skills.${skill.id}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('employer.dashboard.offered_price')} ({t('common.uzs')})</label>
                <input
                  type="number"
                  required
                  value={formData.expectedPrice}
                  onChange={(e) => setFormData({ ...formData, expectedPrice: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder={t('employer.dashboard.price_placeholder', { defaultValue: 'Masalan: 200000' })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('jobs.description')}</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                  placeholder={t('employer.dashboard.job_desc_placeholder')}
                />
              </div>
            </div>
          </div>

          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {t('landing.geo_based')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('profile.region')}</label>
                <select
                  required
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value, district: '' })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  <option value="">{t('common.select')}</option>
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{t('common.region_name', { defaultValue: r })}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('profile.district')}</label>
                <select
                  required
                  disabled={!formData.region}
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50"
                >
                  <option value="">{t('common.select')}</option>
                  {formData.region && DISTRICTS[formData.region as keyof typeof DISTRICTS]?.map(d => (
                    <option key={d} value={d}>{t(`districts.${getDistrictKey(d)}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('profile.neighborhood')} ({t('common.optional')})</label>
                <input
                  type="text"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder={t('auth.neighborhood_placeholder')}
                />
              </div>
            </div>
          </div>

          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              {t('common.images')} ({t('common.optional')})
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formData.customImageUrl}
                  onChange={(e) => setFormData({ ...formData, customImageUrl: e.target.value })}
                  className="flex-1 px-4 py-3.5 rounded-2xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder={t('common.image_url_placeholder')}
                />
                <button
                  type="button"
                  onClick={addImage}
                  className="px-6 py-3 bg-secondary text-foreground rounded-2xl font-bold hover:bg-accent transition-all"
                >
                  {t('auth.add')}
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-border group">
                    <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img)}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-bold">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-8 py-4 text-muted-foreground font-bold hover:text-foreground transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-12 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-200 disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('common.post')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
