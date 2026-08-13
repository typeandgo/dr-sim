import {
  createTranslator,
  resolveLocale,
  type Locale,
  type LocalePreference,
  type Translate,
} from '@/core/i18n';

// `chrome.i18n` bu üründe YALNIZCA tarayıcı dilini okumak için kullanılır; sözlüğün
// kendisi `core/i18n.ts`'tedir (gerekçe orada). Test ortamında (jsdom) `chrome.i18n`
// bulunmayabildiği için `navigator.language`'a düşülür.
export const browserLanguage = (): string => {
  try {
    return chrome.i18n?.getUILanguage?.() || navigator.language;
  } catch {
    return navigator.language;
  }
};

export const localeOf = (preference: LocalePreference): Locale => resolveLocale(preference, browserLanguage());

export const translatorFor = (preference: LocalePreference): Translate => createTranslator(localeOf(preference));
