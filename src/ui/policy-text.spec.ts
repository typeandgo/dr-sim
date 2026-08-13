import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, FAULT_PRESETS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Rule, Settings } from '@/core/types';
import { faultLabel, faultPresetId, policyStatusLine } from './policy-text';

const rule = (key: string, state: 'allow' | 'block'): Rule => ({
  key,
  method: 'GET',
  path: key.split(' ')[1] ?? '/',
  state,
  source: 'inventory',
  createdAt: 0,
});

const t = createTranslator('tr');

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('ui/policy-text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('faultLabel', () => {
    it.each<[Partial<Settings['fault']>, string]>([
      [{}, '503'],
      [{ status: 429 }, '429'],
      [{ kind: 'network' }, 'network error'],
      [{ kind: 'timeout', timeoutMs: 3000 }, '3 sn sonra timeout'],
    ])('%j -> %s', (over, expected) => {
      expect(faultLabel({ ...DEFAULT_SETTINGS.fault, ...over }, t)).toBe(expected);
    });
  });

  describe('faultPresetId — Ayarlar’daki seçicinin değeri', () => {
    it.each<[Partial<Settings['fault']>, string]>([
      [{}, 'http-503'],
      [{ status: 429 }, 'http-429'],
      [{ kind: 'network' }, 'network'],
      [{ kind: 'timeout' }, 'timeout'],
    ])('%j -> %s', (over, expected) => {
      expect(faultPresetId({ ...DEFAULT_SETTINGS.fault, ...over })).toBe(expected);
    });

    it('her preset id’si geri eşleşir', () => {
      const ids = FAULT_PRESETS.map((preset) => preset.id);
      FAULT_PRESETS.forEach((preset) => {
        expect(ids).toContain(faultPresetId({
          ...DEFAULT_SETTINGS.fault,
          kind: preset.kind,
          status: preset.status,
        }));
      });
    });
  });

  describe('policyStatusLine — paneldeki tek satır', () => {
    it('blok politikasında arıza tipini ve kural sayısını yazar', () => {
      const line = policyStatusLine(settings({ rules: [rule('GET /a', 'allow'), rule('GET /b', 'block')] }), t);
      expect(line).toBe("Kural yazılmayan EP'ler bloklanıyor (503) · 2 kural");
    });

    it('geçiş politikasında arıza tipi yazılmaz', () => {
      expect(policyStatusLine(settings({ defaultPolicy: 'pass' }), t)).toBe("Kural yazılmayan EP'ler geçiyor · 0 kural");
    });
  });
});
