import { debugLogger } from '../lib/debugLogger';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { User, MapPin, Briefcase, Star, Settings, Save, Plus, X, AlertCircle, CheckCircle, ArrowLeft, BookOpen } from 'lucide-react';
import Layout from '../components/Layout';
import RoleBadge from '../components/RoleBadge';
import { useAuth } from '../hooks/useAuth';
import { REGIONS, DISTRICTS } from '../constants/locations';
import { SKILLS } from '../constants/categories';
import { getDistrictKey } from '../lib/utils';
import { validatePhoneNumber, validateEmail, validateFullName, formatPhoneNumber } from '../lib/validation';

export default function MyProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = React.useState(false);
  const [formData, setFormData] = React.useState({
    fullName: '',
    region: '',
    district: '',
    neighborhood: '',
    bio: '',
    skills: [] as string[],
    experienceLevel: '',
    phoneNumber: '',
    email: '',
    isPremium: false,
    education: [] as Array<{ institution: string; degree: string; startYear?: string; endYear?: string; notes?: string }>,
    experience: [] as Array<{ company: string; position: string; startYear?: string; endYear?: string; details?: string }>
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [success, setSuccess] = React.useState(false);
  const [customSkill, setCustomSkill] = React.useState('');

  React.useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        region: profile.region || '',
        district: profile.district || '',
        neighborhood: profile.neighborhood || '',
        bio: profile.bio || '',
        skills: profile.skills || [],
        experienceLevel: profile.experienceLevel || 'Boshlangʻich',
        phoneNumber: profile.phoneNumber || '',
        email: profile.email || '',
        isPremium: profile.isPremium || false,
        education: profile.education || [],
        experience: profile.experience || []
      });
    }
  }, [profile]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameValidation = validateFullName(formData.fullName);
    if (!nameValidation.isValid) {
      newErrors.fullName = nameValidation.error || '';
    }

    if (formData.phoneNumber) {
      const phoneValidation = validatePhoneNumber(formData.phoneNumber);
      if (!phoneValidation.isValid) {
        newErrors.phoneNumber = phoneValidation.error || '';
      }
    }

    if (formData.email) {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.isValid) {
        newErrors.email = emailValidation.error || '';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!profile || !validateForm()) return;

    setSaving(true);
    setSuccess(false);

    try {
      const updateData: Record<string, unknown> = {
        fullName: formData.fullName,
        region: formData.region,
        district: formData.district,
        neighborhood: formData.neighborhood,
        bio: formData.bio,
        skills: formData.skills,
        experienceLevel: formData.experienceLevel,
        education: formData.education,
        experience: formData.experience,
      };

      if (formData.phoneNumber) updateData.phoneNumber = formData.phoneNumber;
      if (formData.email) updateData.email = formData.email;

      try {
        await api.users.update(profile.uid, updateData as Parameters<typeof api.users.update>[1]);
      } catch {
        debugLogger.log('[Profile] Creating/updating profile via API');
        await api.users.update(profile.uid, {
          uid: profile.uid,
          fullName: formData.fullName,
          email: formData.email || profile.email,
          phoneNumber: formData.phoneNumber || profile.phoneNumber,
          role: profile.role,
          region: formData.region,
          district: formData.district,
          neighborhood: formData.neighborhood,
          bio: formData.bio,
          skills: formData.skills,
          experienceLevel: formData.experienceLevel,
          education: formData.education,
          experience: formData.experience,
          isVerified: false,
          verificationStatus: 'pending',
        } as Parameters<typeof api.users.update>[1]);
      }
      
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      debugLogger.error('Update error:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !formData.skills.includes(customSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, customSkill.trim()]
      }));
      setCustomSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const updateEducationEntry = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map((entry, idx) => idx === index ? { ...entry, [field]: value } : entry)
    }));
  };

  const addEducationEntry = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { institution: '', degree: '', startYear: '', endYear: '', notes: '' }]
    }));
  };

  const removeEducationEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, idx) => idx !== index)
    }));
  };

  const updateExperienceEntry = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.map((entry, idx) => idx === index ? { ...entry, [field]: value } : entry)
    }));
  };

  const addExperienceEntry = () => {
    setFormData(prev => ({
      ...prev,
      experience: [...prev.experience, { company: '', position: '', startYear: '', endYear: '', details: '' }]
    }));
  };

  const removeExperienceEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.filter((_, idx) => idx !== index)
    }));
  };

  const getDistricts = (): string[] => {
    return DISTRICTS[formData.region] || [];
  };

  if (authLoading) return <Layout><div className="p-8">{t('common.loading')}...</div></Layout>;
  if (!profile) return <Layout><div className="p-8">{t('profile.not_found')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white font-bold transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
          {t('common.back')}
        </button>
        
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('profile.title')}</h1>
            {profile && <RoleBadge role={profile.role} size="lg" />}
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 bg-white border border-gray-200 px-6 py-3 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
            >
              <Settings size={20} />
              <span>{t('profile.edit')}</span>
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 rounded-2xl font-bold text-gray-500 hover:text-gray-700"
              >
                {t('profile.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg disabled:opacity-50"
              >
                <Save size={20} />
                <span>{saving ? t('profile.saving') : t('profile.save')}</span>
              </button>
            </div>
          )}
        </div>

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-700"
          >
            <CheckCircle size={20} />
            <span className="font-semibold">{t('profile.saved_successfully')}</span>
          </motion.div>
        )}

        {isEditing ? (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-8"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <User size={24} />
                {t('profile.personal_info')}
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.full_name')} *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, fullName: e.target.value }));
                      if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                    }}
                    className={`w-full px-5 py-3 rounded-xl border outline-none transition-all text-gray-900 font-medium ${
                      errors.fullName
                        ? 'border-red-300 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder={t('profile.enter_full_name')}
                  />
                  {errors.fullName && (
                    <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> {errors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.phone_number')}</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, phoneNumber: formatPhoneNumber(e.target.value) }));
                      if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }));
                    }}
                    className={`w-full px-5 py-3 rounded-xl border outline-none transition-all text-gray-900 font-medium ${
                      errors.phoneNumber
                        ? 'border-red-300 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder="+998 (XX) XXX XXXX"
                  />
                  {errors.phoneNumber && (
                    <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> {errors.phoneNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, email: e.target.value }));
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full px-5 py-3 rounded-xl border outline-none transition-all text-gray-900 font-medium ${
                      errors.email
                        ? 'border-red-300 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder={t('profile.enter_email')}
                  />
                  {errors.email && (
                    <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.bio')}</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none text-gray-900 font-medium"
                    placeholder={t('profile.enter_bio')}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-8"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <MapPin size={24} />
                {t('profile.location')}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.region')} *</label>
                  <select
                    value={formData.region}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, region: e.target.value, district: '' }));
                    }}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                  >
                    <option value="">{t('profile.select_region')}</option>
                    {REGIONS.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.district')} *</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                    disabled={!formData.region}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-900 font-medium"
                  >
                    <option value="">{t('profile.select_district')}</option>
                    {getDistricts().map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.neighborhood')}</label>
                  <input
                    type="text"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                    className="w-full px-5 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                    placeholder={t('profile.enter_neighborhood')}
                  />
                </div>
              </div>
            </motion.div>

            {profile.role === 'worker' && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-200 p-8"
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Briefcase size={24} />
                    {t('profile.skills')}
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {SKILLS.map((skill) => (
                        <button
                          key={skill.id}
                          onClick={() => toggleSkill(skill.name)}
                          className={`px-4 py-3 rounded-xl font-medium transition-all ${
                            formData.skills.includes(skill.name)
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {skill.name}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customSkill}
                        onChange={(e) => setCustomSkill(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addCustomSkill();
                          }
                        }}
                        className="flex-1 px-5 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                        placeholder={t('profile.add_custom_skill')}
                      />
                      <button
                        onClick={addCustomSkill}
                        className="px-5 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    {formData.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.skills.map((skill: string) => (
                          <div
                            key={skill}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {skill}
                            <button
                              onClick={() => removeSkill(skill)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-200 p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
                      <BookOpen size={24} />
                      {t('profile.education')}
                    </div>
                    <button
                      type="button"
                      onClick={addEducationEntry}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-secondary text-foreground border border-border hover:bg-muted transition-all"
                    >
                      <Plus size={16} />
                      {t('profile.add_education')}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.education.map((entry, index) => (
                      <div key={`edu-${index}`} className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-semibold text-gray-900">{t('profile.education_entry')} {index + 1}</span>
                          <button type="button" onClick={() => removeEducationEntry(index)} className="text-red-500 hover:text-red-700">
                            <X size={18} />
                          </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <input
                            type="text"
                            value={entry.institution}
                            onChange={(e) => updateEducationEntry(index, 'institution', e.target.value)}
                            placeholder={t('profile.institution')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={entry.degree}
                            onChange={(e) => updateEducationEntry(index, 'degree', e.target.value)}
                            placeholder={t('profile.degree')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 mt-4">
                          <input
                            type="text"
                            value={entry.startYear}
                            onChange={(e) => updateEducationEntry(index, 'startYear', e.target.value)}
                            placeholder={t('profile.start_year')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={entry.endYear}
                            onChange={(e) => updateEducationEntry(index, 'endYear', e.target.value)}
                            placeholder={t('profile.end_year')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <textarea
                          value={entry.notes}
                          onChange={(e) => updateEducationEntry(index, 'notes', e.target.value)}
                          placeholder={t('profile.education_notes')}
                          className="w-full mt-4 px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-200 p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
                      <Briefcase size={24} />
                      {t('profile.experience')}
                    </div>
                    <button
                      type="button"
                      onClick={addExperienceEntry}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-secondary text-foreground border border-border hover:bg-muted transition-all"
                    >
                      <Plus size={16} />
                      {t('profile.add_experience')}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.experience.map((entry, index) => (
                      <div key={`exp-${index}`} className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-semibold text-gray-900">{t('profile.experience_entry')} {index + 1}</span>
                          <button type="button" onClick={() => removeExperienceEntry(index)} className="text-red-500 hover:text-red-700">
                            <X size={18} />
                          </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <input
                            type="text"
                            value={entry.company}
                            onChange={(e) => updateExperienceEntry(index, 'company', e.target.value)}
                            placeholder={t('profile.company')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={entry.position}
                            onChange={(e) => updateExperienceEntry(index, 'position', e.target.value)}
                            placeholder={t('profile.position')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 mt-4">
                          <input
                            type="text"
                            value={entry.startYear}
                            onChange={(e) => updateExperienceEntry(index, 'startYear', e.target.value)}
                            placeholder={t('profile.start_year')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={entry.endYear}
                            onChange={(e) => updateExperienceEntry(index, 'endYear', e.target.value)}
                            placeholder={t('profile.end_year')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <textarea
                          value={entry.details}
                          onChange={(e) => updateExperienceEntry(index, 'details', e.target.value)}
                          placeholder={t('profile.experience_details')}
                          className="w-full mt-4 px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-8"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User size={20} />
                {t('profile.personal_info')}
              </h2>
              <div className="space-y-4 text-gray-600">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('profile.full_name')}</p>
                  <p className="font-semibold text-gray-900 mt-1">{formData.fullName}</p>
                </div>
                {formData.phoneNumber && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('profile.phone_number')}</p>
                    <p className="font-semibold text-gray-900 mt-1">{formData.phoneNumber}</p>
                  </div>
                )}
                {formData.email && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('profile.email')}</p>
                    <p className="font-semibold text-gray-900 mt-1">{formData.email}</p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-8"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={20} />
                {t('profile.location')}
              </h2>
              <div className="space-y-4 text-gray-600">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('profile.region')}</p>
                  <p className="font-semibold text-gray-900 mt-1">{formData.region}</p>
                </div>
                {formData.district && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('profile.district')}</p>
                    <p className="font-semibold text-gray-900 mt-1">{formData.district}</p>
                  </div>
                )}
                {formData.neighborhood && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('profile.neighborhood')}</p>
                    <p className="font-semibold text-gray-900 mt-1">{formData.neighborhood}</p>
                  </div>
                )}
              </div>
            </motion.div>
            {profile.role === 'worker' && ( 
              <>
                {formData.education.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-gray-200 p-8"
                  >
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BookOpen size={20} />
                      {t('profile.education')}
                    </h2>
                    <div className="space-y-4 text-gray-600">
                      {formData.education.map((entry, index) => (
                        <div key={`edu-view-${index}`} className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                          <p className="font-semibold text-gray-900">{entry.institution || t('profile.education_entry')} {index + 1}</p>
                          <p>{entry.degree}</p>
                          <p className="text-sm text-gray-500">{entry.startYear} — {entry.endYear}</p>
                          {entry.notes && <p className="mt-2 text-gray-600">{entry.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {formData.experience.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-gray-200 p-8"
                  >
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Briefcase size={20} />
                      {t('profile.experience')}
                    </h2>
                    <div className="space-y-4 text-gray-600">
                      {formData.experience.map((entry, index) => (
                        <div key={`exp-view-${index}`} className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                          <p className="font-semibold text-gray-900">{entry.position} — {entry.company}</p>
                          <p className="text-sm text-gray-500">{entry.startYear} — {entry.endYear}</p>
                          {entry.details && <p className="mt-2 text-gray-600">{entry.details}</p>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
