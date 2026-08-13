import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bulkSetRuleState,
  findRule,
  removeRule,
  toggleRule,
  upsertRule,
  validateRulePath,
} from './rules';
import type { Rule } from './types';

const rule = (key: string, state: 'allow' | 'block'): Rule => ({
  key,
  method: key.split(' ')[0] as Rule['method'],
  path: key.split(' ')[1] ?? '/',
  state,
  source: 'inventory',
  createdAt: 1,
});

describe('core/rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRulePath', () => {
    it('joker içeren girdiyi reddeder', () => {
      expect(validateRulePath('/auth/*')).toEqual({
        ok: false,
        error: 'path-wildcard',
      });
    });

    it.each(['', '   ', '/'])('geçersiz path (%s) reddedilir', (input) => {
      expect(validateRulePath(input).ok).toBe(false);
    });

    it('null girdiyi reddeder', () => {
      expect(validateRulePath(null as unknown as string).ok).toBe(false);
    });

    it('geçerli path’i normalize eder', () => {
      expect(validateRulePath(' /items/123/publish ')).toEqual({ ok: true, path: '/items/:id/publish' });
    });
  });

  describe('upsertRule', () => {
    it('yeni kural ekler ve anahtarı normalize eder', () => {
      const [added] = upsertRule([], { method: 'get', path: '/items/12/summary', state: 'allow', now: 5 });
      expect(added).toMatchObject({ key: 'GET /items/:id/summary', state: 'allow', createdAt: 5 });
    });

    it('mevcut kaydın durumunu günceller, createdAt’i korur', () => {
      const rules = upsertRule([rule('GET /a', 'allow')], { method: 'GET', path: '/a', state: 'block', now: 99 });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({ state: 'block', createdAt: 1, source: 'inventory' });
    });

    it('not alanını taşır ve mevcut notu korur', () => {
      const withNote = upsertRule([], { method: 'GET', path: '/a', state: 'block', note: 'DR' });
      expect(withNote[0]?.note).toBe('DR');
      const updated = upsertRule(withNote, { method: 'GET', path: '/a', state: 'allow' });
      expect(updated[0]?.note).toBe('DR');
    });

    it('kaynak verilmezse manual varsayılır', () => {
      expect(upsertRule([], { method: 'GET', path: '/a', state: 'allow' })[0]?.source).toBe('manual');
    });

    it('varsayılan createdAt 0’dır', () => {
      expect(upsertRule([], { method: 'GET', path: '/a', state: 'allow' })[0]?.createdAt).toBe(0);
    });
  });

  describe('toggleRule — efektif durumu tersine çevirir', () => {
    it.each<['allow' | 'block' | undefined, 'block' | 'pass', 'allow' | 'block']>([
      ['allow', 'block', 'block'],
      ['block', 'block', 'allow'],
      [undefined, 'block', 'allow'],
      [undefined, 'pass', 'block'],
    ])('mevcut=%s politika=%s -> %s', (current, policy, expected) => {
      const rules = current ? [rule('GET /a', current)] : [];
      const next = toggleRule(rules, { key: 'GET /a', method: 'GET', path: '/a', defaultPolicy: policy });
      expect(next[0]?.state).toBe(expected);
    });

    it('kayıt yokken kaynak inventory olur', () => {
      const next = toggleRule([], { key: 'GET /a', method: 'GET', path: '/a', defaultPolicy: 'block' });
      expect(next[0]?.source).toBe('inventory');
    });

    it('verilen kaynak kullanılabilir', () => {
      const next = toggleRule([], {
        key: 'GET /a', method: 'GET', path: '/a', defaultPolicy: 'block', source: 'quick-allow',
      });
      expect(next[0]?.source).toBe('quick-allow');
    });
  });

  describe('liste yardımcıları', () => {
    const rules = [rule('GET /a', 'allow'), rule('GET /b', 'block'), rule('GET /c', 'allow')];

    it('kaydı bulur', () => {
      expect(findRule(rules, 'GET /b')?.state).toBe('block');
    });

    it('kaydı siler', () => {
      expect(removeRule(rules, 'GET /a').map((entry) => entry.key)).toEqual(['GET /b', 'GET /c']);
    });

    it('toplu durum yazar', () => {
      const next = bulkSetRuleState(rules, [{ method: 'GET', path: '/b' }, { method: 'GET', path: '/d' }], 'allow');
      expect(findRule(next, 'GET /b')?.state).toBe('allow');
      expect(findRule(next, 'GET /d')?.state).toBe('allow');
    });
  });
});
