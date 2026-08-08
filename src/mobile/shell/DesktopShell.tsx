import React from 'react';

/** Passthrough — desktop pages keep their own Layout / DashboardLayout. */
export default function DesktopShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
