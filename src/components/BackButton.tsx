import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BackButtonProps {
  to?: string;
  className?: string;
}

export default function BackButton({ to, className = '' }: BackButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white font-bold transition-all shadow-sm group ${className}`}
    >
      <ArrowLeft size={18} className="text-gray-900 dark:text-white group-hover:-translate-x-1 transition-transform" />
      <span className="text-gray-900 dark:text-white">{t('common.back')}</span>
    </button>
  );
}
