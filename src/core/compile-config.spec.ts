import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeDomainPatterns, compileConfig, compileRules } from './compile-config';
import { createTranslator } from './i18n';
import { DEFAULT_SETTINGS } from './constants';
import type { Rule, RuleState, Settings } from './types';

const rule = (path: string, state: RuleState): Rule => ({ path, state, createdAt: 0 });

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('core/compile-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kuralları anahtar → durum haritasına derler', () => {
    const compiled = compileRules([rule('/a', 'allow'), rule('/b', 'block')]);
    expect(compiled['/a']).toBe('allow');
    expect(compiled['/b']).toBe('block');
  });

  it('kurallar path’e anahtarlanır', () => {
    expect(compileRules([rule('/orders', 'allow')])).toEqual({ '/orders': 'allow' });
  });

  it('aynı path’in iki kaydı çakışırsa block kazanır', () => {
    expect(compileRules([rule('/orders', 'allow'), rule('/orders', 'block')])).toEqual({ '/orders': 'block' });
  });

  it('derlenmiş harita prototip zinciri taşımaz', () => {
    expect(Object.getPrototypeOf(compileRules([]))).toBeNull();
  });

  it('izni reddedilmiş domain hariç hepsi derlenir', () => {
    const result = activeDomainPatterns(
      settings({
        domains: [
          { id: '1', pattern: 'a.com', granted: true },
          { id: '2', pattern: 'b.com', granted: false },
          { id: '3', pattern: 'c.com' },
        ],
      }),
    );
    // Eklenen domain doğrudan etkindir; yalnızca izin durumu filtreler (Revizyon 3)
    expect(result).toEqual(['a.com', 'c.com']);
  });

  it('runtime config ayarları ve revizyonu taşır', () => {
    const config = compileConfig(settings({ enabled: true, rules: [rule('/x', 'allow')] }), 7, createTranslator('tr'));
    expect(config).toMatchObject({ enabled: true, defaultPolicy: 'block', revision: 7 });
    expect(config.rulesByKey['/x']).toBe('allow');
  });
});
