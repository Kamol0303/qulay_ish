import { debugLogger } from '../../lib/debugLogger';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { Settings, Save, Globe, Shield, Database, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SystemSettingsData {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  premiumEnabled: boolean;
  verificationRequired: boolean;
  supportEmail: string;
  maxJobPostsPerUser: number;
  aiAssistantEnabled: boolean;
}

const DEFAULTS: SystemSettingsData = {
  maintenanceMode: false,
  registrationEnabled: true,
  premiumEnabled: true,
  verificationRequired: true,
  supportEmail: 'support@qulayish.uz',
  maxJobPostsPerUser: 10,
  aiAssistantEnabled: true,
};

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 3500); return () => clearTimeout(id); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${value ? 'bg-blue-500' : 'bg-gray-200'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${value ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

export default function SystemSettings() {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [settings, setSettings] = useState<SystemSettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SystemSettingsData, string>>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  useEffect(() => {
    if (isDemo) { setLoading(false); return; }
    (async () => {
      try {
        const data = await api.settings.getGlobal();
        if (data) {
          setSettings({ ...DEFAULTS, ...(data as unknown as SystemSettingsData) });
        }
      } catch (err) {
        debugLogger.error('Error loading settings:', err);
        showToast(t('common.error'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [isDemo]);

  function validate(): boolean {
    const errs: typeof errors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(settings.supportEmail)) {
      errs.supportEmail = 'Email noto\'g\'ri formatda';
    }
    if (!Number.isInteger(settings.maxJobPostsPerUser) || settings.maxJobPostsPerUser < 1) {
      errs.maxJobPostsPerUser = 'Musbat son bo\'lishi kerak';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    if (isDemo) {
      showToast(t('admin.settings.demo_save'), 'success');
      return;
    }

    setSaving(true);
    try {
      await api.settings.updateGlobal(settings as unknown as Record<string, unknown>);
      showToast(t('admin.settings.save_success'), 'success');
    } catch (err) {
      debugLogger.error('Error saving settings:', err);
      showToast(t('admin.settings.save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof SystemSettingsData>(key: K, value: SystemSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('nav.sidebar.system_settings')}</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">{t('admin.settings.subtitle')}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {saving
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={20} />}
            {t('common.save')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform Status */}
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Globe size={20} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">{t('admin.settings.platform_status')}</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-gray-900 leading-none mb-1">{t('admin.settings.maintenance_mode')}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.maintenance_desc')}</p>
                </div>
                <Toggle value={settings.maintenanceMode} onChange={(v) => set('maintenanceMode', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-gray-900 leading-none mb-1">{t('admin.settings.user_registration')}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.registration_desc')}</p>
                </div>
                <Toggle value={settings.registrationEnabled} onChange={(v) => set('registrationEnabled', v)} />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Shield size={20} className="text-purple-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">{t('admin.settings.security')}</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-gray-900 leading-none mb-1">{t('admin.settings.mandatory_verification')}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.verification_desc')}</p>
                </div>
                <Toggle value={settings.verificationRequired} onChange={(v) => set('verificationRequired', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-gray-900 leading-none mb-1">{t('admin.settings.ai_assistant')}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('admin.settings.ai_desc')}</p>
                </div>
                <Toggle value={settings.aiAssistantEnabled} onChange={(v) => set('aiAssistantEnabled', v)} />
              </div>
            </div>
          </div>

          {/* Business Rules */}
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Database size={20} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">{t('admin.settings.business_rules')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  {t('admin.settings.support_email')}
                </label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => set('supportEmail', e.target.value)}
                  className={`w-full px-5 py-4 rounded-2xl bg-gray-50 border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900 transition-colors ${errors.supportEmail ? 'border-red-400' : 'border-gray-100'}`}
                />
                {errors.supportEmail && (
                  <p className="text-xs text-red-500 font-medium mt-1">{errors.supportEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  {t('admin.settings.max_jobs')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.maxJobPostsPerUser}
                  onChange={(e) => set('maxJobPostsPerUser', parseInt(e.target.value) || 1)}
                  className={`w-full px-5 py-4 rounded-2xl bg-gray-50 border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900 transition-colors ${errors.maxJobPostsPerUser ? 'border-red-400' : 'border-gray-100'}`}
                />
                {errors.maxJobPostsPerUser && (
                  <p className="text-xs text-red-500 font-medium mt-1">{errors.maxJobPostsPerUser}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
