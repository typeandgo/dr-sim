import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/core/i18n';
import { GUIDE } from './guide';

describe('ui/options/guide', () => {
  it('her dilde aynı bölümler vardır', () => {
    const counts = LOCALES.map((locale) => GUIDE[locale].length);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeGreaterThanOrEqual(8);
  });

  it('hiçbir başlık veya metin boş değildir', () => {
    const empty = LOCALES.flatMap((locale) => GUIDE[locale].flatMap((chapter, index) => {
      const problems: string[] = [];
      if (!chapter.title.trim()) problems.push(`${locale}[${index}].title`);
      if (!chapter.blocks.length) problems.push(`${locale}[${index}].blocks`);

      chapter.blocks.forEach((block, blockIndex) => {
        const where = `${locale}[${index}].blocks[${blockIndex}]`;
        if (block.kind === 'p' || block.kind === 'note') {
          if (!block.text.trim()) problems.push(where);
          return;
        }
        if (block.kind === 'terms') {
          if (!block.items.length || block.items.some((item) => !item.term.trim() || !item.desc.trim())) {
            problems.push(where);
          }
          return;
        }
        if (!block.items.length || block.items.some((item) => !item.trim())) problems.push(where);
      });

      return problems;
    }));

    expect(empty).toEqual([]);
  });

  it('iki dilde blok yapısı birebir aynıdır', () => {
    const shape = (locale: 'en' | 'tr'): string => GUIDE[locale]
      .map((chapter) => chapter.blocks.map((block) => block.kind).join(',')).join('|');

    expect(shape('tr')).toBe(shape('en'));
  });
});
