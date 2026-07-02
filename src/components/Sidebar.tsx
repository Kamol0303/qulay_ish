import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Search, 
  FileText, 
  MessageSquare, 
  User, 
  Bell, 
  ShieldCheck, 
  Settings,
  LogOut,
  Users,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  MapPin,
  Activity,
  BookOpen,
  Plus,
  Heart
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';

import { useTranslation } from 'react-i18next';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();

  const menuItems = {
    worker: [
      { icon: LayoutDashboard, label: t('nav.sidebar.dashboard'), path: '/worker/dashboard', end: true },
      { icon: Heart, label: 'Qulay Ish', path: '/qulay-ish', end: true },
      { icon: Heart, label: t('nav.sidebar.saved_jobs'), path: '/saved-jobs', end: true },
      { icon: Briefcase, label: t('nav.sidebar.all_jobs'), path: '/jobs', end: true },
      { icon: BookOpen, label: t('nav.sidebar.courses'), path: '/courses', end: true },
      { icon: MessageSquare, label: t('nav.sidebar.messages'), path: '/chat', end: true },
      { icon: User, label: t('nav.sidebar.profile'), path: '/my-profile', end: true },
      { icon: Bell, label: t('nav.sidebar.notifications'), path: '/notifications', end: true },
    ],
    employer: [
      { icon: LayoutDashboard, label: t('nav.sidebar.dashboard'), path: '/employer/dashboard', end: true },
      { icon: Plus, label: t('nav.sidebar.post_job'), path: '/employer/create-job', end: true },
      { icon: Briefcase, label: t('nav.sidebar.my_jobs'), path: '/employer/jobs', end: false },
      { icon: Users, label: t('nav.sidebar.applicants'), path: '/employer/applicants', end: false },
      { icon: CheckCircle, label: t('nav.sidebar.contracts'), path: '/employer/contracts', end: false },
      { icon: Heart, label: 'Qulay Ish', path: '/qulay-ish', end: true },
      { icon: Users, label: t('nav.sidebar.worker_base'), path: '/workers', end: true },
      { icon: MessageSquare, label: t('nav.sidebar.messages'), path: '/chat', end: true },
      { icon: User, label: t('nav.sidebar.org_profile'), path: '/my-profile', end: true },
      { icon: Bell, label: t('nav.sidebar.notifications'), path: '/notifications', end: true },
    ],
    admin: [
      { icon: BarChart3, label: t('nav.sidebar.overview'), path: '/admin/dashboard', end: true },
      { icon: Users, label: t('nav.sidebar.users'), path: '/admin/users', end: false },
      { icon: Briefcase, label: t('nav.sidebar.jobs'), path: '/admin/jobs', end: false },
      { icon: CheckCircle, label: t('nav.sidebar.contracts'), path: '/admin/contracts', end: false },
      { icon: AlertTriangle, label: t('nav.sidebar.disputes'), path: '/admin/disputes', end: false },
      { icon: ShieldCheck, label: t('nav.sidebar.verification'), path: '/admin/verification', end: false },
      { icon: BarChart3, label: t('nav.sidebar.statistics'), path: '/statistics', end: true },
      { icon: Settings, label: t('nav.sidebar.settings'), path: '/admin/settings', end: true },
    ],
    super_admin: [
      { icon: LayoutDashboard, label: t('nav.sidebar.global_mgmt'), path: '/super-admin/dashboard', end: true },
      { icon: Users, label: t('nav.sidebar.all_users'), path: '/super-admin/users', end: false },
      { icon: Briefcase, label: t('nav.sidebar.all_jobs_admin'), path: '/super-admin/jobs', end: false },
      { icon: ShieldCheck, label: t('nav.sidebar.verification_queue'), path: '/super-admin/verification', end: false },
      { icon: AlertTriangle, label: t('nav.sidebar.disputes'), path: '/super-admin/disputes', end: false },
      { icon: CheckCircle, label: t('nav.sidebar.contract_audit'), path: '/super-admin/contracts', end: false },
      { icon: Activity, label: t('nav.sidebar.system_logs'), path: '/super-admin/logs', end: false },
      { icon: Settings, label: t('nav.sidebar.system_settings'), path: '/super-admin/settings', end: true },
      { icon: MessageSquare, label: t('nav.sidebar.messages'), path: '/super-admin/messages', end: true },
      { icon: Bell, label: t('nav.sidebar.notifications'), path: '/super-admin/notifications', end: true },
    ]
  };

  const currentMenu = profile?.role ? menuItems[profile.role] : [];

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 h-screen sticky top-0 flex flex-col z-50">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Briefcase className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{t('common.branding_short')}</h1>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{t('common.national_platform')}</p>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {currentMenu.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.end}
            className={({ isActive }) => cn(
              "flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
              isActive
                ? "bg-blue-500 text-white shadow-xl shadow-blue-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-white" : "text-slate-500 group-hover:text-blue-400")} />
                <span className="text-sm tracking-wide">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-800/50 space-y-3">
        <div className="bg-slate-800/30 rounded-[24px] p-4 border border-slate-800/50 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center overflow-hidden">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white truncate">{profile?.fullName}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{t(`auth.${profile?.role}`)}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all border border-rose-500/10"
        >
          <LogOut size={18} />
          <span className="text-sm font-bold">{t('common.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
