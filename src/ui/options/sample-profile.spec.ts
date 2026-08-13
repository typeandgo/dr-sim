import { describe, expect, it } from 'vitest';
import { LOCALES, createTranslator } from '@/core/i18n';
import { buildProfileFile } from '@/core/profile';
import { sampleProfile } from './sample-profile';

describe('ui/options/sample-profile', () => {
  it('içe aktarmanın zorunlu tuttuğu şemayı karşılar', () => {
    const profile = sampleProfile(createTranslator('tr'));

    // importProfile yalnızca `rules` dizisini zorunlu tutar; örnek onu ve
    // isteğe bağlı alanların hepsini gösterir.
    expect(Array.isArray(profile.rules)).toBe(true);
    expect(profile.rules.length).toBeGreaterThan(0);
    expect(profile.domains.length).toBeGreaterThan(0);
    expect(profile.fault.kind).toBe('http');
  });

  it('hem izinli hem engelli kural içerir — iki durumu da gösterir', () => {
    const states = new Set(sampleProfile(createTranslator('tr')).rules.map((rule) => rule.state));
    expect([...states].sort()).toEqual(['allow', 'block']);
  });

  it('path’ler normalize biçimde yazılmıştır', () => {
    const profile = sampleProfile(createTranslator('en'));

    // Ham sayısal id kalırsa örnek yanlış öğretir: eşleşme normalize anahtar üzerinden
    expect(profile.rules.every((rule) => !/\/\d+/.test(rule.path))).toBe(true);
    expect(profile.rules.some((rule) => rule.path.includes(':id'))).toBe(true);
  });

  it('key alanı method ve path ile tutarlıdır', () => {
    const mismatched = sampleProfile(createTranslator('tr')).rules
      .filter((rule) => rule.key !== `${rule.method} ${rule.path}`);

    expect(mismatched).toEqual([]);
  });

  it('dışa aktarmayla aynı üreticiden geçer ve geri okunabilir', () => {
    const t = createTranslator('tr');
    const profile = sampleProfile(t);
    const file = buildProfileFile(profile, t);

    expect(file.extension).toBe('json');
    expect(JSON.parse(file.content)).toEqual(profile);
  });

  it('her dilde adı ve notları doludur', () => {
    LOCALES.forEach((locale) => {
      const profile = sampleProfile(createTranslator(locale));
      expect(profile.name.trim()).not.toBe('');
      expect(profile.rules.every((rule) => (rule.note ?? '').trim() !== '')).toBe(true);
    });
  });
});
