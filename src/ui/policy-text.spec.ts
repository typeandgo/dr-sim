import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, FAULT_PRESETS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Rule, Settings } from '@/core/types';
import { faultLabel, faultPresetId, policyStatusLine } from './policy-text';

const rule = (path: string, state: 'allow' | 'block'): Rule => ({ path, state, createdAt: 0 });

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
      [{ status: 404 }, 'http-404'],
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
      const line = policyStatusLine(settings({ rules: [rule('/a', 'allow'), rule('/b', 'block')] }), t);
      expect(line).toBe("Kural yazılmayan EP'ler bloklanıyor · engelli EP'ler 503 alıyor · 2 kural");
    });

    // Arıza, açık `engelli` kurallarına da uygulanır: `Geçsin` politikasında tek
    // bir EP'yi engelleyen kullanıcı da hangi arızayı aldığını görmek zorunda.
    it('geçiş politikasında da arıza tipi yazılır', () => {
      expect(policyStatusLine(settings({ defaultPolicy: 'pass', rules: [rule('/b', 'block')] }), t))
        .toBe("Kural yazılmayan EP'ler geçiyor · engelli EP'ler 503 alıyor · 1 kural");
    });

    it('network arızasında 503 yerine arızanın adı yazılır', () => {
      const line = policyStatusLine(settings({
        defaultPolicy: 'pass',
        fault: { ...DEFAULT_SETTINGS.fault, kind: 'network' },
      }), t);

      expect(line).toBe("Kural yazılmayan EP'ler geçiyor · engelli EP'ler network error alıyor · 0 kural");
    });
  });
});
