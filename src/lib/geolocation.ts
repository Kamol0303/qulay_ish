import { Capacitor } from '@capacitor/core';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Get the device location once. Uses the Capacitor Geolocation plugin on native
 * (APK/iOS) with a runtime permission prompt, and falls back to the browser
 * Geolocation API on the web. Battery-friendly (coarse accuracy, cached briefly).
 */
export async function getCurrentPosition(options?: { highAccuracy?: boolean }): Promise<Coords> {
  const highAccuracy = options?.highAccuracy ?? false;

  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      perm = await Geolocation.requestPermissions({ permissions: ['location'] });
    }
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      throw new Error('Lokatsiya ruxsati berilmadi');
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: highAccuracy,
      timeout: 15000,
      maximumAge: 60000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }

  return new Promise<Coords>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Brauzer lokatsiyani qoʻllab-quvvatlamaydi'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || 'Lokatsiya olinmadi')),
      { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 60000 },
    );
  });
}

export function isGeolocationAvailable(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export type LocationBlockReason = 'permission' | 'services' | 'unavailable';

interface SettingsPlugin {
  openAppSettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
}

const AppSettings = Capacitor.registerPlugin<SettingsPlugin>('AppSettings');

function errorText(err: unknown): { code: string; message: string } {
  if (err && typeof err === 'object') {
    const record = err as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === 'string' ? record.code : '',
      message: typeof record.message === 'string' ? record.message : '',
    };
  }
  return { code: '', message: err instanceof Error ? err.message : String(err) };
}

/** Map a Capacitor Geolocation failure to the screen the user must clear. */
export function classifyLocationFailure(err: unknown): LocationBlockReason {
  const { code, message } = errorText(err);
  const text = `${code} ${message}`.toLowerCase();
  if (
    code === 'OS-PLUG-GLOC-0007' ||
    code === 'OS-PLUG-GLOC-0009' ||
    code === 'OS-PLUG-GLOC-0016' ||
    code === 'OS-PLUG-GLOC-0017' ||
    text.includes('not enabled') ||
    text.includes('enable location') ||
    text.includes('location settings') ||
    text.includes('turned off')
  ) {
    return 'services';
  }
  if (code === 'OS-PLUG-GLOC-0003' || text.includes('denied')) return 'permission';
  return 'unavailable';
}

/**
 * APK entry check. Prompts for location permission and a position.
 * The website never calls this.
 */
export async function requireNativeLocation(): Promise<{
  ok: boolean;
  reason: LocationBlockReason | null;
}> {
  if (!Capacitor.isNativePlatform()) return { ok: true, reason: null };
  const { Geolocation } = await import('@capacitor/geolocation');
  try {
    await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 120000,
    });
    return { ok: true, reason: null };
  } catch (err) {
    const reason = classifyLocationFailure(err);
    if (reason !== 'unavailable') return { ok: false, reason };
    const { code } = errorText(err);
    try {
      const perm = await Geolocation.checkPermissions();
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      // A slow GPS fix is not a disabled location service. Any other failure
      // keeps the app closed until location is actually on.
      if (granted && code === 'OS-PLUG-GLOC-0010') return { ok: true, reason: null };
      return { ok: false, reason: granted ? 'services' : 'permission' };
    } catch (checkErr) {
      return { ok: false, reason: classifyLocationFailure(checkErr) };
    }
  }
}

export async function openAppLocationSettings(): Promise<void> {
  await AppSettings.openLocationSettings();
}

export async function openAppPermissionSettings(): Promise<void> {
  await AppSettings.openAppSettings();
}
