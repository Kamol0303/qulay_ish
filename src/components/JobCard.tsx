import React from 'react';
import { Job } from '../types';
import { MapPin, Clock, Star, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../lib/utils';

interface JobCardProps {
  job: Job;
  onApply?: (jobId: string) => void;
}

export default function JobCard({ job, onApply }: JobCardProps) {
  const { t, i18n } = useTranslation();
  const date = job.createdAt 
    ? (job.createdAt.toDate ? job.createdAt.toDate() : new Date(typeof job.createdAt === 'number' ? job.createdAt * 1000 : job.createdAt.seconds * 1000 || Date.now()))
    : new Date();
  
  const getLocale = () => {
    if (i18n.language === 'ru') return ru;
    if (i18n.language === 'en') return enUS;
    return uz;
  };

  return (
    <motion.div
      whileHover={{ y: -8, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      className="group bg-card rounded-[2rem] border border-border p-7 shadow-sm transition-all duration-500 flex flex-col h-full relative overflow-hidden"
    >
      {/* Decorative element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-primary/20">
              {t(`categories.${job.category}`, { defaultValue: job.category })}
            </span>
            {job.isPromoted && (
              <span className="flex items-center text-[10px] font-black text-blue-600 bg-blue-500/10 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-blue-500/20 shadow-lg shadow-blue-500/10">
                <Star size={12} className="mr-1.5 fill-blue-600" />
                {t('common.promoted', { defaultValue: 'PROMOTED' })}
              </span>
            )}
            {job.status === 'open' && (
              <span className="flex items-center text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-emerald-500/20">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                {t('common.active')}
              </span>
            )}
          </div>
          <h3 className="text-xl font-black text-foreground leading-tight mb-3 group-hover:text-primary transition-colors tracking-tight">
            {job.title}
          </h3>
          <div className="flex flex-wrap items-center text-muted-foreground text-xs gap-y-2 gap-x-5">
            <span className="flex items-center font-semibold">
              <MapPin size={14} className="mr-2 text-primary/60" />
              {t('common.region_name', { defaultValue: job.region })}{job.district ? `, ${t(`districts.${getDistrictKey(job.district)}`, { defaultValue: job.district })}` : ''}
            </span>
            <span className="flex items-center font-semibold">
              <Clock size={14} className="mr-2 text-muted-foreground/60" />
              {formatDistanceToNow(date, { addSuffix: true, locale: getLocale() })}
            </span>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground/80 text-sm leading-relaxed line-clamp-3 mb-10 flex-1 font-medium">
        {job.description || t('jobs.no_description')}
      </p>

      <div className="space-y-6 pt-6 border-t border-border/50 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-secondary border border-border overflow-hidden flex items-center justify-center shadow-inner">
              <img 
                src={`https://ui-avatars.com/api/?name=Employer&background=random&color=fff`} 
                alt="Employer" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer" 
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-black text-foreground">{t('common.verified')}</span>
                <ShieldCheck size={14} className="text-primary" />
              </div>
              <div className="flex items-center text-amber-500">
                <Star size={10} fill="currentColor" />
                <span className="ml-1.5 text-[10px] font-black text-muted-foreground">4.9</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-2">{t('common.price')}</p>
            <div className="text-xl font-black text-primary tracking-tight">
              {(job.price ?? 0).toLocaleString()} <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">{t('common.uzs')}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onApply?.(job.id)}
          className="w-full bg-foreground text-background py-4.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all duration-500 shadow-lg shadow-foreground/5 hover:shadow-primary/20 flex items-center justify-center group/btn"
        >
          {t('common.apply')}
          <ArrowRight size={16} className="ml-2 group-hover/btn:translate-x-2 transition-transform duration-500" />
        </button>
      </div>
    </motion.div>
  );
}
