import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FAULT, DEFAULT_NORMALIZATION } from './constants';
import { decide, effectiveState, nextRuleState, shouldRecord } from './decision-engine';
import { resetScopeCache } from './matcher';
import type { RuleState, RuntimeConfig } from './types';

const config = (over: Partial<RuntimeConfig> = {}): RuntimeConfig => ({
  enabled: true,
  defaultPolicy: 'block',
  domains: ['api.example.com'],
  rulesByKey: {},
  fault: DEFAULT_FAULT,
  normalization: DEFAULT_NORMALIZATION,
  captureHeaders: false,
  captureBody: false,
  showPageBanner: true,
  revision: 1,
  ...over,
});

const url = (path: string) => `https://api.example.com${path}`;

describe('core/decision-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScopeCache();
  });

  describe('decide — karar tablosunun tamamı', () => {
    it.each<[string, Partial<RuntimeConfig>, string, boolean, string]>([
      ['enabled=false', { enabled: false }, '/offers', false, 'disabled'],
      ['kapsam dışı URL', {}, 'https://other.com/offers', false, 'out-of-scope'],
      [
        "kayıt allow + politika block",
        { rulesByKey: { 'GET /offers': 'allow' as RuleState } },
        '/offers',
        false,
        'allowed',
      ],
      [
        "kayıt allow + politika pass",
        { defaultPolicy: 'pass', rulesByKey: { 'GET /offers': 'allow' as RuleState } },
        '/offers',
        false,
        'allowed',
      ],
      [
        "kayıt block + politika block",
        { rulesByKey: { 'GET /offers': 'block' as RuleState } },
        '/offers',
        true,
        'blocked',
      ],
      [
        "kayıt block + politika pass",
        { defaultPolicy: 'pass', rulesByKey: { 'GET /offers': 'block' as RuleState } },
        '/offers',
        true,
        'blocked',
      ],
      ['kayıt yok + politika block', {}, '/offers', true, 'default-block'],
      ['kayıt yok + politika pass', { defaultPolicy: 'pass' }, '/offers', false, 'default-pass'],
    ])('%s', (_name, over, path, expectedBlock, expectedReason) => {
      const target = path.startsWith('http') ? path : url(path);
      const decision = decide({ method: 'GET', url: target }, config(over));

      expect(decision.block).toBe(expectedBlock);
      expect(decision.reason).toBe(expectedReason);
    });

    it('domain listesi boşken hiçbir istek yönetilmez (fail-safe)', () => {
      const decision = decide({ method: 'GET', url: url('/offers') }, config({ domains: [] }));
      expect(decision).toMatchObject({ block: false, reason: 'out-of-scope', inScope: false });
    });

    it('kapsam dışı istek, simülasyon kapalıyken de out-of-scope kalır (kaydedilmez)', () => {
      const decision = decide({ method: 'GET', url: 'https://other.com/x' }, config({ enabled: false }));
      expect(decision.reason).toBe('out-of-scope');
      expect(shouldRecord(decision)).toBe(false);
    });

    it('simülasyon kapalıyken kapsamdaki istek kaydedilir', () => {
      const decision = decide({ method: 'GET', url: url('/offers') }, config({ enabled: false }));
      expect(shouldRecord(decision)).toBe(true);
    });

    it('aynı path farklı method ayrı değerlendirilir', () => {
      const cfg = config({ rulesByKey: { 'GET /offers': 'allow' } });
      expect(decide({ method: 'GET', url: url('/offers') }, cfg).block).toBe(false);
      expect(decide({ method: 'POST', url: url('/offers') }, cfg).block).toBe(true);
    });

    it('farklı id’li aynı EP tek kayıtla eşleşir', () => {
      const cfg = config({ rulesByKey: { 'GET /items/:id/summary': 'allow' } });
      expect(decide({ method: 'GET', url: url('/items/1/summary') }, cfg).reason).toBe('allowed');
      expect(decide({ method: 'GET', url: url('/items/8842/summary') }, cfg).reason).toBe('allowed');
    });

    it('kararda normalize edilmiş anahtar döner', () => {
      const decision = decide({ method: 'get', url: url('/items/12/summary?x=1') }, config());
      expect(decision.key).toBe('GET /items/:id/summary');
      expect(decision.path).toBe('/items/:id/summary');
      expect(decision.method).toBe('GET');
    });

    it('açık kayıt her iki politikada da aynı davranır', () => {
      const withBlockPolicy = decide({ method: 'GET', url: url('/x') }, config({ rulesByKey: { 'GET /x': 'allow' } }));
      const withPassPolicy = decide(
        { method: 'GET', url: url('/x') },
        config({ defaultPolicy: 'pass', rulesByKey: { 'GET /x': 'allow' } }),
      );
      expect(withBlockPolicy.reason).toBe(withPassPolicy.reason);
    });
  });

  describe('nextRuleState — toggle semantiği', () => {
    it.each<['allow' | 'block' | undefined, 'block' | 'pass', 'allow' | 'block']>([
      ['allow', 'block', 'block'],
      ['block', 'block', 'allow'],
      [undefined, 'block', 'allow'],
      [undefined, 'pass', 'block'],
      ['allow', 'pass', 'block'],
      ['block', 'pass', 'allow'],
    ])('nextRuleState(%s, %s) -> %s', (current, policy, expected) => {
      expect(nextRuleState(current, policy)).toBe(expected);
    });
  });

  describe('effectiveState', () => {
    it.each<['allow' | 'block' | undefined, 'block' | 'pass', 'allow' | 'block']>([
      ['allow', 'block', 'allow'],
      ['block', 'pass', 'block'],
      [undefined, 'block', 'block'],
      [undefined, 'pass', 'allow'],
    ])('effectiveState(%s, %s) -> %s', (current, policy, expected) => {
      expect(effectiveState(current, policy)).toBe(expected);
    });
  });
});
