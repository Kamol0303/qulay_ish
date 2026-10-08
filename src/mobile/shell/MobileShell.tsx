import React from 'react';
import { Bell, Moon, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import BottomTabBar from './BottomTabBar';
import { cn, normalizeLanguageCode } from '../../lib/utils';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { profile, userRole } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const role = userRole || profile?.role;
  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const nextLanguage = language === 'uz' ? 'ru' : language === 'ru' ? 'en' : 'uz';
  const hideTabs =
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/super-admin-login') ||
    location.pathname.startsWith('/verification') ||
    location.pathname.startsWith('/contracts/') ||
    location.pathname.startsWith('/employer/create') ||
    location.pathname.startsWith('/worker/create') ||
    location.pathname.startsWith('/worker/edit');

  const hideTopBar =
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/super-admin-login');

  const showAdminHeader = role === 'admin' || role === 'super_admin';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!hideTopBar && (
        <header className="sticky top-0 z-[65] border-b border-border bg-card/95 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between min-h-[52px] px-4">
            <Link to="/" className="font-black tracking-tight text-primary text-lg">
              Mehrli qo'llar
            </Link>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void i18n.changeLanguage(nextLanguage)}
                className="min-h-[44px] min-w-[44px] rounded-xl text-xs font-black uppercase text-muted-foreground"
                aria-label={t('common.change_language')}
                title={t('common.change_language')}
              >
                {language}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-muted-foreground"
                aria-label={theme === 'dark' ? t('common.light_mode') : t('common.dark_mode')}
                title={theme === 'dark' ? t('common.light_mode') : t('common.dark_mode')}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              {profile && (
                <Link
                  to={role === 'super_admin' ? '/super-admin/notifications' : '/notifications'}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-muted-foreground"
                  aria-label="Bildirishnomalar"
                >
                  <Bell size={22} />
                </Link>
              )}
            </div>
          </div>
          {showAdminHeader && (
            <p className="px-4 pb-2 text-xs text-muted-foreground">
              Admin panel — mobil soddalashtirilgan ko‘rinish (to‘liq jadval keyinroq).
            </p>
          )}
        </header>
      )}

      <main
        className={cn(
          'flex-1 min-h-0',
          hideTopBar && 'pt-[env(safe-area-inset-top)]',
          !hideTabs && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
        )}
      >
        {children}
      </main>

      {!hideTabs && <BottomTabBar />}
    </div>
  );
}
