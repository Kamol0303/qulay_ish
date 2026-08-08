import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Briefcase,
  FileText,
  MessageSquare,
  User,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { hapticLight } from '../haptics';

type Tab = { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; end?: boolean };

function tabsForRole(role?: string | null): Tab[] {
  if (role === 'employer') {
    return [
      { to: '/employer/dashboard', label: 'Bosh', icon: Home, end: true },
      { to: '/employer/jobs', label: 'E’lonlar', icon: Briefcase },
      { to: '/employer/applicants', label: 'Arizalar', icon: ClipboardList },
      { to: '/chat', label: 'Chat', icon: MessageSquare },
      { to: '/my-profile', label: 'Profil', icon: User },
    ];
  }
  if (role === 'worker') {
    return [
      { to: '/worker/dashboard', label: 'Bosh', icon: Home, end: true },
      { to: '/jobs', label: 'Ishlar', icon: Briefcase },
      { to: '/worker/applications', label: 'Arizalar', icon: FileText },
      { to: '/chat', label: 'Chat', icon: MessageSquare },
      { to: '/my-profile', label: 'Profil', icon: User },
    ];
  }
  // Guest / other — compact public tabs
  return [
    { to: '/', label: 'Bosh', icon: Home, end: true },
    { to: '/jobs', label: 'Ishlar', icon: Briefcase },
    { to: '/auth', label: 'Kirish', icon: User },
  ];
}

export default function BottomTabBar() {
  const { userRole, profile } = useAuth();
  const role = userRole || profile?.role;
  // Admin keeps content; hide role tabs (9.5) — show only home-ish links
  if (role === 'admin' || role === 'super_admin') {
    return null;
  }
  const tabs = tabsForRole(role);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Asosiy navigatsiya"
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
