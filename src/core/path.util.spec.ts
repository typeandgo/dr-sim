import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_NORMALIZATION } from './constants';
import {
  extractPathname,
  normalizeMethod,
  normalizePath,
  resetPathCaches,
} from './path.util';

const rules = (over: Partial<typeof DEFAULT_NORMALIZATION> = {}) => ({ ...DEFAULT_NORMALIZATION, ...over });

describe('core/path.util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPathCaches();
  });

  describe('extractPathname', () => {
    it.each([
      ['/carts/item-count', '/carts/item-count'],
      ['carts/item-count', '/carts/item-count'],
      ['/carts/item-count?x=1', '/carts/item-count'],
      ['https://example.com/carts/item-count?x=1', '/carts/item-count'],
      ['/carts/item-count/', '/carts/item-count'],
      ['/detail#tab', '/detail'],
      ['/', '/'],
      ['', '/'],
      ['?only=query', '/'],
    ])('extractPathname(%s) -> %s', (input, expected) => {
      expect(extractPathname(input)).toBe(expected);
    });

    it('geçersiz absolute URL geldiğinde ham path ile devam eder', () => {
      expect(extractPathname('https://exa mple.com/x')).toBe('/https://exa mple.com/x');
    });

    it('argümansız çağrıldığında kök döner', () => {
      expect(extractPathname()).toBe('/');
    });
  });

  describe('normalizePath', () => {
    it.each([
      ['/items/123/summary', '/items/:id/summary'],
      ['/credit-cards/55', '/credit-cards/:id'],
      ['/contracts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/preview', '/contracts/:id/preview'],
      ['/items/9f2c1a7b4e/summary', '/items/:id/summary'],
      ['/offers/active', '/offers/active'],
      ['/items/:id/summary', '/items/:id/summary'],
      ['/', '/'],
    ])('normalizePath(%s) -> %s', (input, expected) => {
      expect(normalizePath(input)).toBe(expected);
    });

    it('argümansız çağrıldığında kök döner', () => {
      expect(normalizePath()).toBe('/');
    });

    it('numeric kuralı kapalıyken sayısal segment korunur', () => {
      expect(normalizePath('/items/123/summary', rules({ numericId: false }))).toBe('/items/123/summary');
    });

    it('uuid kuralı kapalıyken uuid segmenti korunur', () => {
      const path = '/contracts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/preview';
      expect(normalizePath(path, rules({ uuid: false, longHex: false }))).toBe(path);
    });

    it('hex kuralı kapalıyken uzun hex segmenti korunur', () => {
      expect(normalizePath('/items/9f2c1a7b4e/summary', rules({ longHex: false }))).toBe('/items/9f2c1a7b4e/summary');
    });

    it('özel regex ile slug id yakalanır', () => {
      const custom = rules({ customPatterns: ['^u_[a-z0-9]+$'] });
      expect(normalizePath('/users/u_abc123/profile', custom)).toBe('/users/:id/profile');
    });

    it('geçersiz özel regex segmenti bozmaz', () => {
      const custom = rules({ customPatterns: ['([unclosed'] });
      expect(normalizePath('/users/abc/profile', custom)).toBe('/users/abc/profile');
    });

    it('aynı özel regex tekrar sorgulandığında bir kez derlenir', () => {
      const custom = rules({ customPatterns: ['^s[0-9]+$'] });
      const spy = vi.spyOn(RegExp.prototype, 'test');
      normalizePath('/a/s1/b', custom);
      normalizePath('/a/s2/b', custom);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('normalizeMethod', () => {
    it.each([
      ['get', 'GET'],
      ['Post', 'POST'],
      ['', 'GET'],
    ])('normalizeMethod(%s) -> %s', (input, expected) => {
      expect(normalizeMethod(input)).toBe(expected);
    });

    it('argümansız çağrıldığında GET döner', () => {
      expect(normalizeMethod()).toBe('GET');
    });
  });
});
