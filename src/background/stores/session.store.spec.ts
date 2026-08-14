import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/core/constants';
import type { Settings, TelemetryRecord } from '@/core/types';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import { createSessionStore } from './session.store';

let chromeMock: ChromeMock;
let clock = 1_000;

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

const record = (over: Partial<TelemetryRecord> = {}): TelemetryRecord => ({
  method: 'GET',
  url: 'https://api.x.com/offers',
  path: '/offers',
  key: 'GET /offers',
  status: 200,
  durationMs: 12,
  outcome: 'success',
  simulated: false,
  reason: 'allowed',
  origin: 'fetch',
  at: clock,
  routePath: '/home',
  ...over,
});

const blocked = (over: Partial<TelemetryRecord> = {}): TelemetryRecord => record({
  outcome: 'fail',
  simulated: true,
  reason: 'default-block',
  status: 503,
  faultKind: 'http',
  ...over,
});

describe('background/session.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clock = 1_000;
    chromeMock = installChromeMock();
  });

  const store = () => createSessionStore(() => clock);

  it('envanteri upsert eder ve sayaçları toplar', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record(), record({ status: 500, outcome: 'fail', reason: 'real-error' })], 0, settings());

    const item = sessions.get(1)?.inventory['/offers'];
    expect(item).toMatchObject({ count: 2, successCount: 1, failCount: 1, lastStatus: 500 });
    expect(sessions.get(1)?.successLog).toHaveLength(1);
    expect(sessions.get(1)?.failLog).toHaveLength(1);
  });

  it('kapsam dışı kaydı envantere yazmaz, sayacı artırır', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record({ reason: 'out-of-scope' })], 0, settings());

    expect(sessions.get(1)?.inventory).toEqual({});
    expect(sessions.get(1)?.outOfScopeCount).toBe(1);
  });

  it('3 sekmede envanterler karışmaz', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record({ key: 'GET /a', path: '/a' })], 0, settings());
    sessions.applyTelemetry(2, [record({ key: 'GET /b', path: '/b' })], 0, settings());
    sessions.applyTelemetry(3, [record({ key: 'GET /c', path: '/c' })], 0, settings());

    expect(Object.keys(sessions.get(1)!.inventory)).toEqual(['/a']);
    expect(Object.keys(sessions.get(2)!.inventory)).toEqual(['/b']);
    expect(sessions.all()).toHaveLength(3);
  });

  it('log ring buffer limiti aşınca en eskiyi düşürür', () => {
    const sessions = store();
    const records = Array.from({ length: 5 }, (_unused, i) => record({ at: i }));
    sessions.applyTelemetry(1, records, 0, settings({ maxLogEntries: 3 }));

    expect(sessions.get(1)?.successLog).toHaveLength(3);
    expect(sessions.get(1)?.droppedCount).toBeGreaterThan(0);
  });

  it('envanter limiti aşılınca en eski EP düşer', () => {
    const sessions = store();
    const records = Array.from({ length: 6 }, (_unused, i) => record({
      key: `GET /p${i}`, path: `/p${i}`, at: i,
    }));
    sessions.applyTelemetry(1, records, 0, settings({ maxInventoryItems: 3 }));

    expect(Object.keys(sessions.get(1)!.inventory)).toHaveLength(3);
    expect(sessions.get(1)?.inventory['/p0']).toBeUndefined();
  });

  it('1000 istek sonrası limitler aşılmaz', () => {
    const sessions = store();
    const records = Array.from({ length: 1000 }, (_unused, i) => record({
      key: `GET /p${i % 700}`, path: `/p${i % 700}`, at: i,
    }));
    sessions.applyTelemetry(1, records, 0, settings());

    expect(Object.keys(sessions.get(1)!.inventory).length).toBeLessThanOrEqual(500);
    expect(sessions.get(1)!.successLog.length).toBeLessThanOrEqual(200);
  });

  it('aynı path’in farklı method’ları tek envanter satırında toplanır', () => {
    const sessions = store();

    sessions.applyTelemetry(1, [
      { ...record(), method: 'GET', key: 'GET /orders', path: '/orders' },
      { ...record(), method: 'POST', key: 'POST /orders', path: '/orders' },
      { ...record(), method: 'GET', key: 'GET /orders', path: '/orders' },
    ], 0, settings());

    const inventory = sessions.get(1)!.inventory;

    expect(Object.keys(inventory)).toEqual(['/orders']);
    expect(inventory['/orders']!.methods).toEqual(['GET', 'POST']);
    expect(inventory['/orders']!.count).toBe(3);
  });

  it('route değişiminde envanteri sıfırlar, ayarla korunabilir', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record()], 0, settings());
    sessions.setRoute(1, { origin: 'https://app.x.com', pathname: '/other', search: '', hash: '' }, 'Başlık', settings());
    expect(sessions.get(1)?.inventory).toEqual({});
    expect(sessions.get(1)?.title).toBe('Başlık');

    sessions.applyTelemetry(1, [record()], 0, settings());
    sessions.setRoute(
      1,
      { origin: 'https://app.x.com', pathname: '/third', search: '', hash: '' },
      '',
      settings({ keepInventoryOnNavigate: true }),
    );
    expect(Object.keys(sessions.get(1)!.inventory)).toHaveLength(1);
  });

  it('aynı route tekrar bildirildiğinde envanter korunur', () => {
    const sessions = store();
    const route = { origin: 'https://app.x.com', pathname: '/home', search: '', hash: '' };
    sessions.setRoute(1, route, 'A', settings());
    sessions.applyTelemetry(1, [record()], 0, settings());
    sessions.setRoute(1, route, 'A', settings());
    expect(Object.keys(sessions.get(1)!.inventory)).toHaveLength(1);
  });

  it('yakalama kapalıyken header loglanmaz', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record({ headers: { authorization: 'Bearer x' } })], 0, settings());

    const entry = sessions.get(1)?.successLog[0];
    expect(entry?.headers).toBeUndefined();
  });

  it('yakalama açıkken hassas header’lar maskelenir', () => {
    const sessions = store();
    sessions.applyTelemetry(
      1,
      [record({ headers: { authorization: 'Bearer x', 'x-trace-id': 't1' } })],
      0,
      settings({ captureHeaders: true }),
    );

    const entry = sessions.get(1)?.successLog[0];
    expect(entry?.headers).toEqual({ authorization: '***', 'x-trace-id': 't1' });
  });

  describe('startDocument — her sayfa yüklemesi sıfırdan başlar', () => {
    const seeded = () => {
      const sessions = store();
      sessions.applyTelemetry(1, [record(), blocked()], 0, settings());
      sessions.startDocument(1, 'doc-1', settings());
      sessions.applyTelemetry(1, [record(), blocked()], 0, settings());
      return sessions;
    };

    it('yeni belge loglari ve envanteri sıfırlar', () => {
      const sessions = seeded();
      expect(sessions.get(1)?.successLog.length).toBeGreaterThan(0);
      expect(sessions.get(1)?.failLog.length).toBeGreaterThan(0);

      sessions.startDocument(1, 'doc-2', settings());

      const session = sessions.get(1)!;
      expect(session.successLog).toEqual([]);
      expect(session.failLog).toEqual([]);
      expect(session.inventory).toEqual({});
      expect(session.blockedSinceLoad).toBe(0);
      expect(session.documentId).toBe('doc-2');
    });

    // SW uykuya dalıp uyanınca bridge yeniden bağlanır ve AYNI kimliği gönderir.
    // Bunu yeni sayfa sanmak, kullanıcının kayıtlarını sebepsiz silerdi.
    it('aynı belge kimliği hiçbir şeyi silmez', () => {
      const sessions = seeded();
      const before = sessions.get(1)!.failLog.length;

      sessions.startDocument(1, 'doc-1', settings());

      expect(sessions.get(1)?.failLog).toHaveLength(before);
      expect(Object.keys(sessions.get(1)!.inventory).length).toBeGreaterThan(0);
    });

    it('kimlik boşsa yok sayılır', () => {
      const sessions = seeded();
      const before = sessions.get(1)!.failLog.length;

      sessions.startDocument(1, '', settings());

      expect(sessions.get(1)?.failLog).toHaveLength(before);
    });

    // Ayarın adı "envanteri koru"; loglar her yüklemede yine de sıfırlanır
    it('keepInventoryOnNavigate açıkken envanter kalır, loglar yine sıfırlanır', () => {
      const sessions = seeded();

      sessions.startDocument(1, 'doc-2', settings({ keepInventoryOnNavigate: true }));

      const session = sessions.get(1)!;
      expect(session.successLog).toEqual([]);
      expect(session.failLog).toEqual([]);
      expect(Object.keys(session.inventory).length).toBeGreaterThan(0);
    });
  });

  // Hard reset: tek sekme değil, tüm oturumlar
  it('clear tüm sekmeleri siler ve oturum deposunu boşaltır', async () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record()], 0, settings());
    sessions.applyTelemetry(2, [record()], 0, settings());
    expect(sessions.all()).toHaveLength(2);

    await sessions.clear();

    expect(sessions.all()).toEqual([]);
    expect(sessions.get(1)).toBeNull();
    expect(chromeMock.storage.session.remove).toHaveBeenCalledWith(STORAGE_KEYS.SESSIONS);
  });

  it('temizleme aksiyonları çalışır', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record(), blocked()], 0, settings());

    sessions.clearInventory(1);
    expect(sessions.get(1)?.inventory).toEqual({});

    sessions.remove(1);
    expect(sessions.get(1)).toBeNull();
  });

  it('bilinmeyen sekmede temizleme sessizce geçer', () => {
    const sessions = store();
    expect(() => {
      sessions.clearInventory(42);
    }).not.toThrow();
  });

  it('SW yeniden başlatıldığında rehydrate eder', async () => {
    const first = store();
    first.applyTelemetry(1, [record()], 0, settings());
    await first.persist();

    expect(chromeMock.storage.session.set).toHaveBeenCalled();

    const second = store();
    await second.hydrate();
    expect(second.get(1)?.inventory['/offers']).toBeTruthy();
  });

  it('rehydrate verisi yoksa boş başlar', async () => {
    const sessions = store();
    await sessions.hydrate();
    expect(sessions.all()).toEqual([]);
  });

  it('rehydrate hatası yutulur', async () => {
    chromeMock.storage.session.get.mockRejectedValueOnce(new Error('yok'));
    const sessions = store();
    await expect(sessions.hydrate()).resolves.toBeUndefined();
  });

  it('bozuk rehydrate kaydı atlanır', async () => {
    chromeMock.storage.session.__data[STORAGE_KEYS.SESSIONS] = { bad: { tabId: 'x' } };
    const sessions = store();
    await sessions.hydrate();
    expect(sessions.all()).toEqual([]);
  });

  it('TTL dolan oturumlar budanır', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [record()], 0, settings());
    sessions.prune(clock + 7 * 60 * 60 * 1000);
    expect(sessions.all()).toEqual([]);
  });

  it('düşen kayıt sayısı toplanır', () => {
    const sessions = store();
    sessions.applyTelemetry(1, [], 7, settings());
    expect(sessions.get(1)?.droppedCount).toBe(7);
  });
});
