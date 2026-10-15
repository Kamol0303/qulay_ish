import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  openAppLocationSettings,
  openAppPermissionSettings,
  requireNativeLocation,
  type LocationBlockReason,
} from '../lib/geolocation';

type GateStatus = 'checking' | 'ready' | LocationBlockReason;

/**
 * On the APK, ask for location after the splash is gone and cover the app
 * until location is on. The website is unchanged.
 */
export default function LocationRequiredGate({ children }: { children: React.ReactNode }) {
  const native = Capacitor.isNativePlatform();
  const { t } = useTranslation();
  const [status, setStatus] = useState<GateStatus>(native ? 'checking' : 'ready');
  const statusRef = useRef(status);
  statusRef.current = status;
  const running = useRef(false);
  const waits = useRef(0);

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || running.current) return;
    running.current = true;
    if (statusRef.current !== 'ready') setStatus('checking');
    try {
      const state = await App.getState().catch(() => ({ isActive: true }));
      if (!state.isActive) {
        waits.current += 1;
        if (waits.current >= 5) setStatus('permission');
        else window.setTimeout(() => void refresh(), 400);
        return;
      }
      waits.current = 0;
      const result = await requireNativeLocation();
      setStatus(result.ok || !result.reason ? 'ready' : result.reason);
    } catch {
      setStatus('unavailable');
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!native) return;
    // Wait until the splash has left the screen. Asking for location in the
    // same moment crashes Xiaomi while the splash exit animation is running.
    const timer = window.setTimeout(() => {
      void refresh();
    }, 700);
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && statusRef.current !== 'ready') void refresh();
    });
    return () => {
      window.clearTimeout(timer);
      void handle.then((listener) => listener.remove());
    };
  }, [native, refresh]);

  if (!native) return <>{children}</>;

  const servicesOff = status === 'services';
  const checking = status === 'checking';

  return (
    <>
    {children}
    {status !== 'ready' && (
    <div className="fixed inset-0 z-[80] bg-background text-foreground flex items-center justify-center px-6 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <MapPin size={30} />
        </div>
        <p className="text-sm font-semibold text-primary">Mehrli qo&apos;llar</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">{t('location_gate.title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {checking
            ? t('location_gate.checking')
            : servicesOff
              ? t('location_gate.services_body')
              : t('location_gate.permission_body')}
        </p>
        <p className="mt-2 text-sm font-semibold">{t('location_gate.required')}</p>
        {!checking && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => {
                if (servicesOff) {
                  void openAppLocationSettings().catch(() => undefined);
                  return;
                }
                void refresh();
              }}
              className="min-h-[48px] w-full rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
            >
              {servicesOff
                ? t('location_gate.enable')
                : status === 'permission'
                  ? t('location_gate.allow')
                  : t('location_gate.retry')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (servicesOff) {
                  void refresh();
                  return;
                }
                const open = status === 'permission' ? openAppPermissionSettings : openAppLocationSettings;
                void open().catch(() => undefined);
              }}
              className="min-h-[48px] w-full rounded-2xl border border-border bg-card px-4 font-bold"
            >
              {servicesOff ? t('location_gate.retry') : t('location_gate.settings')}
            </button>
          </div>
        )}
      </div>
    </div>
    )}
    </>
  );
}
