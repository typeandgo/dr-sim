import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeDomainPatterns, compileConfig, compileRules } from './compile-config';
import { DEFAULT_SETTINGS } from './constants';
import type { Rule, Settings } from './types';

const rule = (key: string, state: 'allow' | 'block'): Rule => ({
  key,
  method: 'GET',
  path: key.split(' ')[1] ?? '/',
  state,
  source: 'inventory',
  createdAt: 0,
});

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('core/compile-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kuralları anahtar → durum haritasına derler', () => {
    const compiled = compileRules([rule('GET /a', 'allow'), rule('POST /b', 'block')]);
    expect(compiled['GET /a']).toBe('allow');
    expect(compiled['POST /b']).toBe('block');
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
    const config = compileConfig(settings({ enabled: true, rules: [rule('GET /x', 'allow')] }), 7);
    expect(config).toMatchObject({ enabled: true, defaultPolicy: 'block', revision: 7 });
    expect(config.rulesByKey['GET /x']).toBe('allow');
  });
});
