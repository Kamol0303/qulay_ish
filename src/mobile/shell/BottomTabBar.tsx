import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Briefcase,
  MessageSquare,
  User,
  Users,
  Building2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { hapticLight } from '../haptics';

type Tab = { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; end?: boolean };

function tabsForRole(role: string | null | undefined, t: (key: string) => string): Tab[] {
  if (role === 'employer') {
    return [
      { to: '/employer/dashboard', label: t('mobile_nav.home'), icon: Home, end: true },
      { to: '/employer/jobs', label: t('mobile_nav.posts'), icon: Briefcase },
      { to: '/directory', label: t('mobile_nav.workers'), icon: Users },
      { to: '/chat', label: t('mobile_nav.chat'), icon: MessageSquare },
      { to: '/my-profile', label: t('mobile_nav.profile'), icon: User },
    ];
  }
  if (role === 'worker') {
    return [
      { to: '/worker/dashboard', label: t('mobile_nav.home'), icon: Home, end: true },
      { to: '/jobs', label: t('mobile_nav.jobs'), icon: Briefcase },
      { to: '/directory', label: t('mobile_nav.employers'), icon: Building2 },
      { to: '/chat', label: t('mobile_nav.chat'), icon: MessageSquare },
      { to: '/my-profile', label: t('mobile_nav.profile'), icon: User },
    ];
  }
  // Guest / other — compact public tabs
  return [
    { to: '/', label: t('mobile_nav.home'), icon: Home, end: true },
    { to: '/jobs', label: t('mobile_nav.jobs'), icon: Briefcase },
    { to: '/auth', label: t('mobile_nav.login'), icon: User },
  ];
}

export default function BottomTabBar() {
  const { t } = useTranslation();
  const { userRole, profile } = useAuth();
  const role = userRole || profile?.role;
  // Admin keeps content; hide role tabs (9.5) — show only home-ish links
  if (role === 'admin' || role === 'super_admin') {
    return null;
  }
  const tabs = tabsForRole(role, t);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] border-t-2 border-[#c6a15b]/70 bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label={t('mobile_nav.aria_label')}
    >
      <ul
        className="max-w-lg mx-auto grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              onClick={() => void hapticLight()}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-semibold',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <tab.icon size={22} />
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
