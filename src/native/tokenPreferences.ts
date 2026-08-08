import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'qulay_ish_access_token';
const PROFILE_KEY = 'qulay_ish_session_profile';

/** Mirror JWT into Capacitor Preferences (persists across WebView restarts). */
export async function syncTokenToNativePreferences(token: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (token) {
      await Preferences.set({ key: TOKEN_KEY, value: token });
    } else {
      await Preferences.remove({ key: TOKEN_KEY });
      await Preferences.remove({ key: PROFILE_KEY });
    }
  } catch {
    /* ignore */
  }
}

/** On native boot, restore JWT from Preferences into localStorage if missing. */
export async function hydrateTokenFromNativePreferences(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (localStorage.getItem(TOKEN_KEY)) return;
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value) localStorage.setItem(TOKEN_KEY, value);
    const profile = await Preferences.get({ key: PROFILE_KEY });
    if (profile.value && !localStorage.getItem(PROFILE_KEY)) {
      localStorage.setItem(PROFILE_KEY, profile.value);
    }
  } catch {
    /* ignore */
  }
}

export async function syncProfileToNativePreferences(rawJson: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (rawJson) await Preferences.set({ key: PROFILE_KEY, value: rawJson });
    else await Preferences.remove({ key: PROFILE_KEY });
  } catch {
    /* ignore */
  }
}
