import { describe, expect, it } from 'vitest';
import {
  EN,
  FALLBACK_LOCALE,
  LOCALES,
  TR,
  createTranslator,
  describeMessage,
  isMessageKey,
  resolveLocale,
  type LocalePreference,
  type MessageKey,
} from './i18n';

const t = createTranslator('en');

describe('core/i18n', () => {
  describe('sözlük bütünlüğü', () => {
    it('TR, EN ile aynı anahtar kümesine sahiptir', () => {
      // Tip sistemi eksik anahtarı zaten yakalar; bu test FAZLA anahtarı da yakalar.
      expect(Object.keys(TR).sort()).toEqual(Object.keys(EN).sort());
    });

    it('hiçbir çeviri boş değildir', () => {
      const empty = LOCALES.flatMap((locale) => Object.entries(locale === 'en' ? EN : TR)
        .filter(([, value]) => !value.trim())
        .map(([key]) => `${locale}:${key}`));

      expect(empty).toEqual([]);
    });

    it('iki dilde de aynı yer tutucular kullanılır', () => {
      const tokens = (value: string): string[] => (value.match(/\{\w+\}/g) ?? []).sort();
      const mismatched = (Object.keys(EN) as MessageKey[])
        .filter((key) => tokens(EN[key]).join() !== tokens(TR[key]).join());

      expect(mismatched).toEqual([]);
    });
  });

  describe('resolveLocale', () => {
    it.each<[LocalePreference, string, string]>([
      ['auto', 'tr', 'tr'],
      ['auto', 'tr-TR', 'tr'],
      ['auto', 'TR-tr', 'tr'],
      ['auto', 'en-US', 'en'],
      ['auto', 'de', 'en'],
      ['auto', '', 'en'],
      ['en', 'tr-TR', 'en'],
      ['tr', 'en-US', 'tr'],
    ])('%s + %s -> %s', (preference, uiLanguage, expected) => {
      expect(resolveLocale(preference, uiLanguage)).toBe(expected);
    });

    it('Türkçe olmayan her dil fallback’e düşer', () => {
      expect(resolveLocale('auto', 'fr-CA')).toBe(FALLBACK_LOCALE);
    });

    it('“trv” gibi tr ile başlayan başka bir dil Türkçe sanılmaz', () => {
      expect(resolveLocale('auto', 'trv')).toBe('en');
    });
  });

  describe('createTranslator', () => {
    it('seçilen dilin metnini döndürür', () => {
      expect(createTranslator('en')('common.allow')).toBe('Allow');
      expect(createTranslator('tr')('common.allow')).toBe('İzin ver');
    });

    it('yer tutucuları doldurur', () => {
      expect(t('policy.ruleCount', { count: 3 })).toBe('3 rules');
    });

    it('birden fazla yer tutucu doldurulur', () => {
      expect(createTranslator('tr')('inventory.title', { blocked: 2, total: 5 }))
        .toBe('Sayfa EP Envanteri (2 engelli / 5)');
    });

    it('parametre verilmezse şablon olduğu gibi döner', () => {
      expect(t('policy.ruleCount')).toBe('{count} rules');
    });

    it('karşılığı verilmeyen yer tutucu görünür kalır', () => {
      expect(t('inventory.title', { blocked: 1 })).toBe('Page EP inventory (1 blocked / {total})');
    });
  });

  describe('isMessageKey', () => {
    it('bilinen anahtarı tanır', () => {
      expect(isMessageKey('common.allow')).toBe(true);
    });

    it('bilinmeyeni reddeder', () => {
      expect(isMessageKey('bilinmeyen.anahtar')).toBe(false);
    });
  });

  describe('describeMessage', () => {
    it('doğrudan anahtarı çevirir', () => {
      expect(describeMessage('connection.timeout', t)).toBe('Timed out.');
    });

    it('çıplak hata kodunu error.* altında arar', () => {
      expect(describeMessage('domain-invalid', t)).toBe(EN['error.domain-invalid']);
    });

    it('tanınmayan mesajı olduğu gibi gösterir', () => {
      expect(describeMessage('production-guard', t)).toBe('production-guard');
    });
  });
});
