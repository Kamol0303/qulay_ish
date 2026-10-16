import React from 'react';
import { Briefcase, User, Shield, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RoleBadgeProps {
  role: 'worker' | 'employer' | 'admin' | 'super_admin';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export default function RoleBadge({ role, size = 'md', showIcon = true }: RoleBadgeProps) {
  const { t } = useTranslation();
  const roleConfig = {
    worker: {
      label: t('auth.worker'),
      icon: User,
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-300',
    },
    employer: {
      label: t('auth.employer'),
      icon: Briefcase,
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-300',
    },
    admin: {
      label: t('auth.admin'),
      icon: Shield,
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-800',
      borderColor: 'border-purple-300',
    },
    super_admin: {
      label: t('auth.super_admin'),
      icon: Crown,
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-900',
      borderColor: 'border-yellow-300',
    },
  };

  const config = roleConfig[role] || roleConfig.worker;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      {config.label}
    </span>
  );
}
