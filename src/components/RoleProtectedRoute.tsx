import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

type RoleProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles: string[];
};

export default function RoleProtectedRoute({
  children,
  allowedRoles,
}: RoleProtectedRouteProps) {
  const { profile, loading, user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground font-medium">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // User exists but profile snapshot hasn't arrived yet — wait, don't redirect
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    debugLogger.log('[RoleProtectedRoute] Role not allowed', {
      role: profile.role,
      allowedRoles,
    });

    // If trying to access admin/super_admin routes without permission, show 403
    const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/super-admin');
    if (isAdminRoute && !['admin', 'super_admin'].includes(profile.role)) {
      return <Navigate to="/403" replace />;
    }

    const roleHome: Record<string, string> = {
      worker: '/worker/dashboard',
      employer: '/employer/dashboard',
      admin: '/admin/dashboard',
      super_admin: '/super-admin/dashboard',
    };

    return <Navigate to={roleHome[profile.role] ?? '/'} replace />;
  }

  debugLogger.log('[RoleProtectedRoute] Access granted', {
    uid: user.uid,
    role: profile.role,
  });

  return <>{children}</>;
}