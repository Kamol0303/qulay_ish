import React from 'react';
import { Profile } from '../types';
import { MapPin, Star, ShieldCheck, Award, Phone, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../lib/utils';
import { CATEGORIES, SKILLS } from '../constants/categories';
import RoleBadge from './RoleBadge';
import StarRow from './StarRow';
import { useAuth } from '../hooks/useAuth';
import { phoneTelHref } from '../lib/phoneLink';
import { api } from '../lib/api';
import { ApiError } from '../lib/api/client';

interface WorkerCardProps {
  worker: Profile;
  price?: number;
}

export default function WorkerCard({ worker, price }: WorkerCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sample = worker.uid.startsWith('gen-');
  const tel = sample ? '' : phoneTelHref(worker.phoneNumber);
  const phoneLabel = (worker.phoneNumber || '').trim();
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const sendContract = async () => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    if (sample || user.uid === worker.uid || sending || sent) return;
    setSending(true);
    setSendError(null);
    try {
      await api.contracts.sendToWorker(worker.uid, typeof price === 'number' ? { amount: price } : {});
      setSent(true);
    } catch (error) {
      setSendError(error instanceof ApiError || error instanceof Error ? error.message : t('worker_profile.contract_failed'));
    } finally {
      setSending(false);
    }
  };

  const getSkillLabel = (skill: string) => {
    const skillObj = SKILLS.find(s => s.id === skill || s.name === skill);
    if (skillObj) return t(`skills.${skillObj.id}`);
    const category = CATEGORIES.find((c) => c.id === skill);
    if (category) return t(`categories.${category.id}`, { defaultValue: category.name });
    return t(`categories.${skill}`, { defaultValue: skill });
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start space-x-4 mb-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
            <img
              src={worker.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.fullName)}&background=random`}
              alt={worker.fullName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {worker.isVerified && (
            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-lg shadow-sm">
              <ShieldCheck size={12} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{worker.fullName}</h3>
            <RoleBadge role={worker.role} size="sm" showIcon={false} />
            {worker.isPremium && (
              <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center uppercase tracking-widest shadow-lg shadow-blue-500/20">
                PREMIUM
              </span>
            )}
            {Number(worker.rating) >= 4.5 && (
              <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">
                <Award size={10} className="mr-0.5" /> {t('worker_profile.top_worker')}
              </span>
            )}
            {worker.availability === 'busy' && (
              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">
                {t('workers.busy', { defaultValue: 'Band' })}
              </span>
            )}
          </div>
          <div className="flex items-center text-gray-500 text-xs mb-2">
            <MapPin size={12} className="mr-1 text-gray-400" />
            {t('common.region_name', { defaultValue: 'Samarqand viloyati' })}{worker.district ? `, ${t(`districts.${getDistrictKey(worker.district)}`)}` : ''}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {worker.reviewCount ? (
              <StarRow rating={worker.rating} count={worker.reviewCount} />
            ) : (
              <div className="flex items-center text-yellow-500">
                <Star size={14} fill="currentColor" />
                <span className="ml-1 text-sm font-bold text-gray-900">{t('worker_profile.new')}</span>
                <span className="ml-1 text-xs text-gray-400">(0)</span>
              </div>
            )}
            <div className="text-xs text-gray-500">
              <span className="font-bold text-blue-600">{worker.completedJobs || 0}</span> {t('worker_profile.completed_jobs')}
            </div>
            {typeof price === 'number' && (
              <div className="text-xs font-bold text-emerald-600">
                {price.toLocaleString()} {t('common.uzs')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {worker.profession && !worker.skills?.includes(worker.profession) && (
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            {getSkillLabel(worker.profession)}
          </span>
        )}
        {worker.skills?.slice(0, 3).map((skill, idx) => (
          <span key={idx} className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
            {getSkillLabel(skill)}
          </span>
        ))}
        {worker.skills && worker.skills.length > 3 && (
          <span className="text-[10px] font-medium text-gray-400 px-1 py-0.5">
            +{worker.skills.length - 3}
          </span>
        )}
      </div>

      <div className="mb-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
        <p className="text-[10px] font-black tracking-wide text-slate-500">
          {t('worker_profile.registered_phone', { defaultValue: 'Roʻyxatdagi telefon' })}
        </p>
        <p className="text-base font-black text-slate-900">
          {phoneLabel || t('jobs.no_phone')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-2">
        {tel ? (
          <a
            href={tel}
            className="min-h-[44px] bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-emerald-700"
          >
            <Phone size={16} className="mr-1.5" /> {t('worker_profile.call')}
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="min-h-[44px] bg-slate-100 text-slate-400 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center"
          >
            <Phone size={16} className="mr-1.5" /> {t('worker_profile.call')}
          </button>
        )}
        <button
          type="button"
          onClick={sendContract}
          disabled={sample || user?.uid === worker.uid || sending || sent}
          className="min-h-[44px] bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-blue-700 disabled:opacity-40"
        >
          <FileText size={16} className="mr-1.5" />
          {sent
            ? t('worker_profile.contract_sent')
            : sending
              ? t('common.loading')
              : t('worker_profile.send_contract')}
        </button>
      </div>
      {sendError ? <p className="mb-2 text-center text-xs font-semibold text-red-600">{sendError}</p> : null}
      {sent ? (
        <p className="text-center text-xs font-semibold text-slate-600">{t('worker_profile.contract_wait')}</p>
      ) : null}
    </motion.div>
  );
}
