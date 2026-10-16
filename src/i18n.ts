import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { normalizeLanguageCode } from './lib/utils';

import uz from './locales/uz.json';
import ru from './locales/ru.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uz },
      ru: { translation: ru },
      en: { translation: en }
    },
    supportedLngs: ['uz', 'ru', 'en'],
    fallbackLng: 'uz',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false
    },
    detection: {
      // Saved choice wins. The phone language is only the first-visit default.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    },
    // Never show raw i18n keys like "nav.sidebar.saved_jobs" in the UI
    parseMissingKeyHandler: (key) => {
      const last = key.split('.').pop() ?? key;
      return last.replace(/_/g, ' ');
    },
  });

function lockLanguage(lng: string) {
  const code = normalizeLanguageCode(lng);
  try {
    localStorage.setItem('i18nextLng', code);
  } catch {
    /* private mode */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = code;
  }
  if (normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) !== code) {
    void i18n.changeLanguage(code);
  }
}

lockLanguage(i18n.resolvedLanguage || i18n.language);
i18n.on('languageChanged', lockLanguage);

export default i18n;
