import { describe, expect, it } from 'vitest';
import { LOCALES, createTranslator } from '@/core/i18n';
import { PROFILE_FIELDS } from './profile-fields';
import { sampleProfile } from './sample-profile';

// Alan sözlüğünün asıl riski eskimesidir: şemaya alan eklenir, doküman aynı kalır.
// Aşağıdaki iki test sözlüğü örnek profilin GERÇEK JSON çıktısına bağlar.

const groupOf = (path: string) => PROFILE_FIELDS.tr.find((group) => group.path === path);

const namesIn = (path: string): string[] => (groupOf(path)?.rows ?? []).map((row) => row.name);

describe('ui/options/profile-fields', () => {
  const profile = sampleProfile(createTranslator('tr'));
  const json = JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;

  it('kök alanların tamamı sözlükte vardır', () => {
    const documented = new Set(namesIn('{ … }'));
    const undocumented = Object.keys(json).filter((key) => !documented.has(key));

    expect(undocumented).toEqual([]);
  });

  it('kural alanlarının tamamı sözlükte vardır', () => {
    const documented = new Set(namesIn('rules[]'));
    const actual = new Set((json.rules as Array<Record<string, unknown>>).flatMap((rule) => Object.keys(rule)));

    expect([...actual].filter((key) => !documented.has(key))).toEqual([]);
  });

  it('arıza ve domain alanlarının tamamı sözlükte vardır', () => {
    const fault = new Set(namesIn('fault'));
    expect(Object.keys(json.fault as object).filter((key) => !fault.has(key))).toEqual([]);

    const domain = new Set(namesIn('domains[]'));
    const actual = (json.domains as Array<Record<string, unknown>>).flatMap((entry) => Object.keys(entry));
    expect(actual.filter((key) => !domain.has(key))).toEqual([]);
  });

  it('sözlükte şemada olmayan bir alan uydurulmamıştır', () => {
    // Ters yön: doküman var olmayan bir anahtar anlatırsa kullanıcı boşa uğraşır.
    // `granted` ve `updatedAt` bilinçli istisna — örnekte yok ama şemada var.
    const optionalExtras = new Set(['granted', 'updatedAt']);

    const rootKeys = new Set(Object.keys(json));
    expect(namesIn('{ … }').filter((name) => !rootKeys.has(name) && !optionalExtras.has(name))).toEqual([]);

    const ruleKeys = new Set((json.rules as Array<Record<string, unknown>>).flatMap((rule) => Object.keys(rule)));
    expect(namesIn('rules[]').filter((name) => !ruleKeys.has(name))).toEqual([]);
  });

  it('her dilde aynı gruplar ve aynı anahtarlar vardır', () => {
    const shape = (locale: 'en' | 'tr'): string => PROFILE_FIELDS[locale]
      .map((group) => `${group.path}:${group.rows.map((row) => `${row.name}/${row.required}`).join(',')}`)
      .join('|');

    expect(shape('tr')).toBe(shape('en'));
  });

  it('hiçbir başlık, tip veya açıklama boş değildir', () => {
    const problems = LOCALES.flatMap((locale) => PROFILE_FIELDS[locale].flatMap((group, index) => {
      const where = `${locale}[${index}]`;
      const issues: string[] = [];

      if (!group.title.trim()) issues.push(`${where}.title`);
      if (!group.path.trim()) issues.push(`${where}.path`);
      if (!group.intro.trim()) issues.push(`${where}.intro`);
      if (!group.rows.length) issues.push(`${where}.rows`);

      group.rows.forEach((row, rowIndex) => {
        if (!row.name.trim() || !row.type.trim() || !row.desc.trim()) issues.push(`${where}.rows[${rowIndex}]`);
      });

      return issues;
    }));

    expect(problems).toEqual([]);
  });
});
