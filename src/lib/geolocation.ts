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
