import React from 'react';
import Sidebar from './Sidebar';
import BackButton from './BackButton';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { Bell, Search, User, Globe, ChevronDown, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn, normalizeLanguageCode } from '../lib/utils';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function DashboardLayout({ children, title }: { children: React.ReactNode, title?: string }) {
  const { profile, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const [isLangOpen, setIsLangOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const location = useLocation();

  React.useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await api.notifications.list(profile.uid);
        if (!cancelled) setUnreadCount(rows.filter((n) => !n.read).length);
      } catch {
        /* ignore */
      }
    };
    void load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.uid, location.pathname]);

  const notificationsPath =
    profile?.role === 'super_admin' ? '/super-admin/notifications' : '/notifications';
  const messagesPath =
    profile?.role === 'super_admin' ? '/super-admin/messages' : '/chat';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth" />;
  }

  const languages = [
    { code: 'uz', name: t('common.uzbek'), flag: '🇺🇿' },
    { code: 'ru', name: t('common.russian'), flag: '🇷🇺' },
    { code: 'en', name: t('common.english'), flag: '🇺🇸' },
  ];

  const currentLangCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const currentLang = languages.find((l) => l.code === currentLangCode) || languages[0];

  // Don't show back button on main dashboards
  const isMainDashboard = ['/worker/dashboard', '/employer/dashboard', '/admin/dashboard', '/super-admin/dashboard'].includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-24 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-10 sticky top-0 z-40 transition-all duration-500">
          <div className="flex items-center gap-6 flex-1 max-w-2xl">
            {!isMainDashboard && <BackButton />}
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder={t('dashboard.searchPlaceholder')}
                className="w-full pl-14 pr-6 py-4 bg-secondary/50 rounded-[24px] border-none focus:ring-4 focus:ring-primary/10 transition-all duration-300 text-sm font-medium placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-secondary text-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 border border-border/50"
              >
                <Globe className="w-5 h-5 text-primary" />
                <span className="text-sm font-black uppercase tracking-widest">{currentLang.code}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isLangOpen ? "rotate-180" : "")} />
              </button>
              <AnimatePresence>
                {isLangOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden py-2 z-50"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          i18n.changeLanguage(lang.code);
                          setIsLangOpen(false);
                        }}
                        className={`w-full text-left px-5 py-3 text-sm font-bold flex items-center justify-between hover:bg-secondary transition-colors ${
                          currentLangCode === lang.code ? 'text-primary bg-primary/5' : 'text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{lang.flag}</span>
                          <span>{lang.name}</span>
                        </div>
                        {currentLangCode === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link
              to={messagesPath}
              className="relative p-4 rounded-2xl bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 group"
              title="Xabarlar"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            <Link
              to={notificationsPath}
              className="relative p-4 rounded-2xl bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 group"
              title="Bildirishnomalar"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-4 pl-6 border-l border-border">
              <div className="text-right hidden lg:block">
                <p className="text-xs font-black text-foreground leading-none mb-1">{profile.fullName}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{profile.role}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden shadow-inner group cursor-pointer hover:border-primary transition-all duration-300">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-background/50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
