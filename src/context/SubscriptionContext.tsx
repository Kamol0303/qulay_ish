import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { SubscriptionStatusResponse } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface SubscriptionContextType {
  status: SubscriptionStatusResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** True when the current path should be blocked (expired + path in blockedPaths). */
  isPathBlocked: (pathname: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [status, setStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.subscription.status();
      setStatus(res);
    } catch {
      // Never hard-block on a status fetch failure.
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void refresh();
    if (!isSuperAdmin) return;
    const interval = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh, isSuperAdmin]);

  const isPathBlocked = useCallback(
    (pathname: string) => {
      if (!status?.blocked) return false;
      return status.blockedPaths.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
    },
    [status],
  );

  const value = useMemo(
    () => ({ status, loading, refresh, isPathBlocked }),
    [status, loading, refresh, isPathBlocked],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return ctx;
}
