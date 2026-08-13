import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCompiledScope,
  isInScope,
  normalizeDomainInput,
  parseDomainPattern,
  resetScopeCache,
  toMatchPattern,
  toOriginPattern,
  validateDomainPattern,
} from './matcher';

describe('core/matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScopeCache();
  });

  describe('normalizeDomainInput', () => {
    it.each([
      ['https://api.x.com/', 'api.x.com'],
      ['  API.X.com  ', 'api.x.com'],
      ['http://api.x.com/gw/', 'api.x.com/gw'],
      ['api.x.com?a=1', 'api.x.com'],
      ['api.x.com#frag', 'api.x.com'],
    ])('normalizeDomainInput(%s) -> %s', (input, expected) => {
      expect(normalizeDomainInput(input)).toBe(expected);
    });

    it('null girdide boş string döner', () => {
      expect(normalizeDomainInput(undefined as unknown as string)).toBe('');
    });
  });

  describe('parseDomainPattern', () => {
    it('host ve base path ayrıştırır', () => {
      expect(parseDomainPattern('api.example.com/gw')).toEqual({
        host: 'api.example.com',
        isWildcard: false,
        basePath: '/gw',
      });
    });

    it('wildcard host tanır', () => {
      expect(parseDomainPattern('*.example.com')?.isWildcard).toBe(true);
    });

    it('port kabul eder', () => {
      expect(parseDomainPattern('localhost:3000')?.host).toBe('localhost:3000');
    });

    it.each([['', null], ['   ', null], ['not a host', null], ['*example.com', null], ['api.x.com/<bad>', null]])(
      'geçersiz girdi (%s) null döner',
      (input) => {
        expect(parseDomainPattern(input as string)).toBeNull();
      },
    );

    it('sondaki slash base path’ten temizlenir', () => {
      expect(parseDomainPattern('api.x.com/gw/')?.basePath).toBe('/gw');
    });
  });

  describe('validateDomainPattern', () => {
    it('geçerli domaini normalize edip döner', () => {
      expect(validateDomainPattern('HTTPS://Api.X.com/')).toEqual({ ok: true, pattern: 'api.x.com' });
    });

    it('boş girdiyi reddeder', () => {
      expect(validateDomainPattern('  ')).toEqual({ ok: false, error: 'domain-empty' });
    });

    it('geçersiz girdiyi açıklamayla reddeder', () => {
      expect(validateDomainPattern('a b c')).toEqual({ ok: false, error: 'domain-invalid' });
    });
  });

  describe('isInScope', () => {
    it('boş liste hiçbir URL’i kapsamaz (fail-safe)', () => {
      expect(isInScope('https://api.example.com/x', [])).toBe(false);
    });

    it.each([
      ['https://api.example.com/x', ['*.example.com'], true],
      ['https://example.com/x', ['*.example.com'], true],
      ['https://notexample.com/x', ['*.example.com'], false],
      ['https://api.example.com/x', ['api.example.com'], true],
      ['https://other.example.com/x', ['api.example.com'], false],
      ['https://api.example.com/gw/users', ['api.example.com/gw'], true],
      ['https://api.example.com/gw', ['api.example.com/gw'], true],
      ['https://api.example.com/other', ['api.example.com/gw'], false],
      ['https://api.example.com/gwx', ['api.example.com/gw'], false],
    ])('isInScope(%s, %j) -> %s', (url, patterns, expected) => {
      expect(isInScope(url, patterns as string[])).toBe(expected);
    });

    it('geçersiz URL false döner', () => {
      expect(isInScope('not-a-url', ['api.example.com'])).toBe(false);
    });

    it('http/https dışı protokol kapsam dışıdır', () => {
      expect(isInScope('chrome-extension://abc/x', ['abc'])).toBe(false);
    });

    it('geçersiz pattern sessizce atlanır', () => {
      expect(isInScope('https://api.example.com/x', ['a b c', 'api.example.com'])).toBe(true);
    });

    it('birden fazla scope’tan biri eşleşirse kapsamdadır', () => {
      expect(isInScope('https://cdn.example.com/a', ['api.example.com', 'cdn.example.com'])).toBe(true);
    });
  });

  describe('derleme cache’i', () => {
    it('aynı pattern tekrar sorgulandığında aynı derlenmiş nesne döner', () => {
      const first = getCompiledScope('*.example.com');
      const second = getCompiledScope('*.example.com');
      expect(first).not.toBeNull();
      expect(first).toBe(second);
    });

    it('geçersiz pattern de cache’lenir', () => {
      expect(getCompiledScope('a b c')).toBeNull();
      expect(getCompiledScope('a b c')).toBeNull();
    });

    it('1000 sorguda RegExp bir kez derlenir', () => {
      const url = 'https://api.example.com/x';
      const spy = vi.spyOn(RegExp.prototype, 'test');
      for (let i = 0; i < 1000; i += 1) isInScope(url, ['*.example.com']);
      expect(getCompiledScope('*.example.com')).toBe(getCompiledScope('*.example.com'));
      spy.mockRestore();
    });
  });

  describe('pattern dönüşümleri', () => {
    it('origin ve match pattern üretir', () => {
      expect(toOriginPattern('api.example.com/gw')).toBe('*://api.example.com/*');
      expect(toMatchPattern('*.example.com')).toBe('*://*.example.com/*');
    });

    it('port match pattern’den düşürülür (Chrome port kabul etmez)', () => {
      expect(toOriginPattern('localhost:5175')).toBe('*://localhost/*');
      expect(toMatchPattern('localhost:5175')).toBe('*://localhost/*');
    });

    it('port kapsam eşleşmesinde korunur', () => {
      expect(isInScope('http://localhost:5175/a', ['localhost:5175'])).toBe(true);
      expect(isInScope('http://localhost:5174/a', ['localhost:5175'])).toBe(false);
    });

    it('geçersiz pattern null döner', () => {
      expect(toOriginPattern('a b')).toBeNull();
      expect(toMatchPattern('a b')).toBeNull();
    });
  });
});
