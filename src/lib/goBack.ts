import type { NavigateFunction } from 'react-router-dom';

/** Stay inside the app. history.back() with an empty stack closes the APK. */
export function goBack(navigate: NavigateFunction, fallback = '/') {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}
