import React from 'react';
import AuthPage from '../../pages/AuthPage';

/**
 * Full-screen auth — AuthPage already is self-contained (no site Header).
 * Wrapper adds mobile-friendly outer spacing class for native shell.
 */
export default function AuthMobile() {
  return (
    <div className="min-h-[calc(100vh-3.25rem)] bg-background">
      <AuthPage />
    </div>
  );
}
