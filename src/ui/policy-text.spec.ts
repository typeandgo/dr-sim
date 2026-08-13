import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, FAULT_PRESETS } from '@/core/constants';
import type { Rule, Settings } from '@/core/types';
import { faultLabel, faultPresetId, policyStatusLine, policySummary } from './policy-text';

const rule = (key: string, state: 'allow' | 'block'): Rule => ({
  key,
  method: 'GET',
  path: key.split(' ')[1] ?? '/',
  state,
  source: 'inventory',
  createdAt: 0,
});

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
      expect(faultLabel({ ...DEFAULT_SETTINGS.fault, ...over })).toBe(expected);
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
      const line = policyStatusLine(settings({ rules: [rule('GET /a', 'allow'), rule('GET /b', 'block')] }));
      expect(line).toBe("Kural yazılmayan EP'ler bloklanıyor (503) · 2 kural");
    });

    it('geçiş politikasında arıza tipi yazılmaz', () => {
      expect(policyStatusLine(settings({ defaultPolicy: 'pass' }))).toBe("Kural yazılmayan EP'ler geçiyor · 0 kural");
    });
  });

  describe('policySummary — Ayarlar’daki detay', () => {
    it('kural kırılımını ve sonucu yazar', () => {
      const summary = policySummary(settings({
        rules: [rule('GET /a', 'allow'), rule('GET /b', 'allow'), rule('GET /c', 'block')],
      }));
      expect(summary).toContain("3 EP'ye kural yazılmış (2 izinli · 1 engelli)");
      expect(summary).toContain('503 dönecek');
    });

    it('kural yokken bunu açıkça söyler', () => {
      expect(policySummary(settings())).toContain('Henüz hiçbir EP’ye kural yazılmamış');
    });

    it('geçiş politikasında sonuç cümlesi değişir', () => {
      expect(policySummary(settings({ defaultPolicy: 'pass' }))).toContain('normal çalışacak');
    });
  });
});
