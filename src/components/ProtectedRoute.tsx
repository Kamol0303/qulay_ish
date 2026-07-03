import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, requiresTwoFactor, isTwoFactorVerified } = useAuth();
  const { t } = useTranslation();

  // Still resolving auth state — show spinner, never redirect yet
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // No Firebase user at all → go to auth
  if (!user) return <Navigate to="/auth" replace />;

  // User exists but profile not yet in context (e.g. just created, snapshot pending).
  // Show spinner instead of redirecting — the snapshot will arrive shortly.
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

  if (requiresTwoFactor && !isTwoFactorVerified) {
    return <Navigate to="/auth/2fa" replace />;
  }

  return <>{children}</>;
}
