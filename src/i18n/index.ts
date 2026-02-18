import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import es from './locales/es';
import en from './locales/en';

const LANGUAGE_KEY = '@movistar_koi_language';

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
      callback(savedLang || 'es');
    } catch {
      callback('es');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // ignore
    }
  },
};

i18n
  .use(languageDetector as any)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
export { LANGUAGE_KEY };
