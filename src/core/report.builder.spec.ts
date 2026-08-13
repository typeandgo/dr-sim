import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { createTranslator } from './i18n';
import {
  blockedItems,
  buildJsonReport,
  buildReportFile,
  buildResultReport,
  passedItems,
  reasonLabel,
} from './report.builder';
import type { DecisionReason, InventoryItem, LogEntry, Settings, TabSession } from './types';

const item = (key: string, reason: DecisionReason): InventoryItem => ({
  key,
  method: key.split(' ')[0] as InventoryItem['method'],
  path: key.split(' ')[1] ?? '/',
  sampleUrl: `https://api.x.com${key.split(' ')[1]}`,
  count: 2,
  lastAt: 0,
  lastStatus: 503,
  lastDurationMs: 5,
  successCount: 0,
  failCount: 2,
  simulatedCount: 2,
  lastReason: reason,
  origin: 'fetch',
  frameId: 0,
  manual: false,
});

const log = (simulated: boolean): LogEntry => ({
  id: '1',
  at: 0,
  method: 'GET',
  path: '/a',
  url: 'https://api.x.com/a',
  status: 503,
  durationMs: 1,
  outcome: 'fail',
  simulated,
  reason: 'default-block',
  routePath: '/home',
  frameId: 0,
});

const session = (over: Partial<TabSession> = {}): TabSession => ({
  tabId: 1,
  origin: 'https://app.x.com',
  routePath: '/portfoy',
  title: 'Portföy',
  inventory: {
    'GET /offers/active': item('GET /offers/active', 'default-block'),
    'GET /org-users/current': item('GET /org-users/current', 'allowed'),
    'GET /credit-cards': item('GET /credit-cards', 'blocked'),
    'GET /out': item('GET /out', 'out-of-scope'),
  },
  successLog: [],
  failLog: [log(true), log(false)],
  outOfScopeCount: 0,
  droppedCount: 0,
  blockedSinceLoad: 0,
  loadedAt: 0,
  updatedAt: 0,
  ...over,
});

const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  domains: [{ id: '1', pattern: 'api.x.com' }],
  ...over,
});

const t = createTranslator('tr');

describe('core/report.builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloklanan ve bloklanmayan EP’leri sebebe göre ayırır', () => {
    expect(blockedItems(session()).map((entry) => entry.key)).toEqual(['GET /credit-cards', 'GET /offers/active']);
    expect(passedItems(session()).map((entry) => entry.key)).toEqual(['GET /org-users/current']);
  });

  it('oturum yokken boş liste döner', () => {
    expect(blockedItems(null)).toEqual([]);
    expect(passedItems(null)).toEqual([]);
  });

  it('§C.4 başlık yapısını üretir', () => {
    const markdown = buildResultReport({ session: session(), t, settings: settings(), now: 0 });
    expect(markdown).toContain('**Portföy** — `/portfoy`');
    expect(markdown).toContain("***Bloklanan EP'ler***");
    expect(markdown).toContain("***Bloklanmayan EP'ler***");
    expect(markdown).toContain('***Çıktı***');
    expect(markdown).toContain('- GET /offers/active');
  });

  it('meta bloğu fail dağılımını yazar', () => {
    const markdown = buildResultReport({ session: session(), t, settings: settings(), now: 0 });
    expect(markdown).toContain('1 simüle · 1 gerçek');
    expect(markdown).toContain('Listede olmayanlar bloklanır');
  });

  it('meta kapatılabilir', () => {
    const markdown = buildResultReport({ session: session(), t, settings: settings(), includeMeta: false });
    expect(markdown).not.toContain('**Tarih:**');
  });

  it('boş oturumda da geçerli rapor üretir', () => {
    const markdown = buildResultReport({ session: null, t, settings: settings({ domains: [] }) });
    expect(markdown).toContain('**Sayfa** — `/`');
    expect(markdown).toContain('- (yok)');
    expect(markdown).toContain('(yok)');
  });

  it('pass politikasında özet cümlesi değişir', () => {
    const markdown = buildResultReport({ session: session(), t, settings: settings({ defaultPolicy: 'pass' }) });
    expect(markdown).toContain('Listede olmayanlar geçer');
  });

  it('http dışı arıza tipini yazar', () => {
    const markdown = buildResultReport({
      session: session(),
      t,
      settings: settings({ fault: { ...DEFAULT_SETTINGS.fault, kind: 'timeout' } }),
    });
    expect(markdown).toContain('**Arıza tipi:** timeout');
  });

  it('JSON raporu anahtarları taşır', () => {
    const parsed = JSON.parse(buildJsonReport({ session: session(), t, settings: settings(), now: 5 })) as Record<string, unknown>;
    expect(parsed).toMatchObject({ generatedAt: 5, routePath: '/portfoy', blocked: expect.any(Array) });
  });

  it('oturum yokken JSON raporu null alanlarla üretilir', () => {
    const parsed = JSON.parse(buildJsonReport({ session: null, t, settings: settings() })) as Record<string, unknown>;
    expect(parsed.routePath).toBeNull();
    expect(parsed.inventory).toEqual([]);
  });

  describe('buildReportFile — format başına dosya kimliği (Revizyon 30)', () => {
    const input = { session: session(), t, settings: settings(), now: 5 };

    it('sonuç raporu markdown olarak iner', () => {
      expect(buildReportFile('markdown', input)).toMatchObject({ name: 'dr-sim-rapor', extension: 'md' });
    });

    it('walkthrough formatı artık üretilmez, sonuç raporuna düşer (Revizyon 35)', () => {
      expect(buildReportFile('walkthrough', input).content).toBe(buildResultReport(input));
    });

    it('json ayrı uzantı alır', () => {
      expect(buildReportFile('json', input)).toMatchObject({ name: 'dr-sim-rapor', extension: 'json' });
    });

    it('bilinmeyen format sonuç raporuna düşer', () => {
      expect(buildReportFile('bilinmeyen', input).content).toBe(buildResultReport(input));
    });
  });

  it('sebep etiketlerini çevirir', () => {
    expect(reasonLabel('default-block', t)).toBe('izin listesinde yok');
    expect(reasonLabel('bilinmeyen' as DecisionReason, t)).toBe('bilinmeyen');
  });
});
