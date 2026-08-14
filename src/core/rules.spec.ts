import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findRule,
  removeRule,
  resolveConflict,
  toggleRule,
  upsertRule,
  validateRulePath,
} from './rules';
import type { Rule } from './types';

const rule = (path: string, state: 'allow' | 'block'): Rule => ({
  path,
  state,
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
    it('yeni kural ekler ve path’i normalize eder', () => {
      const [added] = upsertRule([], { path: '/items/12/summary', state: 'allow', now: 5 });
      expect(added).toMatchObject({ path: '/items/:id/summary', state: 'allow', createdAt: 5 });
    });

    it('mevcut kaydın durumunu günceller, createdAt’i korur', () => {
      const rules = upsertRule([rule('/a', 'allow')], { path: '/a', state: 'block', now: 99 });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({ state: 'block', createdAt: 1 });
    });

    it('varsayılan createdAt 0’dır', () => {
      expect(upsertRule([], { path: '/a', state: 'allow' })[0]?.createdAt).toBe(0);
    });

    it('aynı path ikinci kez yazılınca kayıt çoğalmaz, durum güncellenir', () => {
      const first = upsertRule([], { path: '/orders', state: 'allow', now: 10 });
      const second = upsertRule(first, { path: '/orders', state: 'block', now: 99 });

      expect(second).toEqual([{ path: '/orders', state: 'block', createdAt: 10 }]);
    });

    it('path normalize edilerek anahtarlanır', () => {
      const rules = upsertRule([], { path: '/orders/8842/detail', state: 'block', now: 0 });

      expect(rules[0]!.path).toBe('/orders/:id/detail');
    });
  });

  describe('toggleRule — efektif durumu tersine çevirir', () => {
    it.each<['allow' | 'block' | undefined, 'block' | 'pass', 'allow' | 'block']>([
      ['allow', 'block', 'block'],
      ['block', 'block', 'allow'],
      [undefined, 'block', 'allow'],
      [undefined, 'pass', 'block'],
    ])('mevcut=%s politika=%s -> %s', (current, policy, expected) => {
      const rules = current ? [rule('/a', current)] : [];
      const next = toggleRule(rules, { path: '/a', defaultPolicy: policy });
      expect(next[0]?.state).toBe(expected);
    });
  });

  describe('liste yardımcıları', () => {
    const rules = [rule('/a', 'allow'), rule('/b', 'block'), rule('/c', 'allow')];

    it('kaydı bulur', () => {
      expect(findRule(rules, '/b')?.state).toBe('block');
    });

    it('kaydı siler', () => {
      expect(removeRule(rules, '/a').map((entry) => entry.path)).toEqual(['/b', '/c']);
    });

    it('var olan kaydı güncellerken kardeş kayıtlara dokunmaz', () => {
      const next = upsertRule(rules, { path: '/b', state: 'allow' });

      expect(next.map((entry) => entry.path)).toEqual(['/a', '/b', '/c']);
      expect(findRule(next, '/b')?.state).toBe('allow');
      expect(findRule(next, '/a')).toBe(rules[0]);
      expect(findRule(next, '/c')).toBe(rules[2]);
    });
  });

  describe('resolveConflict', () => {
    it('block her zaman kazanır — DR aracında güvenli taraf kesmektir', () => {
      expect(resolveConflict('allow', 'block')).toBe('block');
      expect(resolveConflict('block', 'allow')).toBe('block');
      expect(resolveConflict('block', 'block')).toBe('block');
    });

    it('iki taraf da allow ise allow kalır', () => {
      expect(resolveConflict('allow', 'allow')).toBe('allow');
    });
  });
});
