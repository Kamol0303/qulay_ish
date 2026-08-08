import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const QUERY = '(max-width: 768px)';

/** Native APK or narrow viewport → mobile presentation shell. */
export function useIsMobileUi(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return Capacitor.isNativePlatform();
    return Capacitor.isNativePlatform() || window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setMatches(true);
      return;
    }
    const mql = window.matchMedia(QUERY);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return matches;
}

export function isMobileUiSync(): boolean {
  if (typeof window === 'undefined') return Capacitor.isNativePlatform();
  return Capacitor.isNativePlatform() || window.matchMedia(QUERY).matches;
}
