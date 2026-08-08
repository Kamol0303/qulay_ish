import React from 'react';
import { Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import BottomTabBar from './BottomTabBar';
import { cn } from '../../lib/utils';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { profile, userRole } = useAuth();
  const location = useLocation();
  const role = userRole || profile?.role;
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
              mexrliqollar
            </Link>
            <div className="flex items-center gap-1">
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
