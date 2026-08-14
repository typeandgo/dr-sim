import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FAULT, DEFAULT_NORMALIZATION } from '@/core/constants';
import { MESSAGE_TYPES } from '@/core/message.schema';
import type { RuntimeConfig } from '@/core/types';

// T-201/T-202 kabul kriterleri: config yarışı, karar uygulaması ve kill-switch.

const TOKEN = 'test-token';

const runtimeConfig = (over: Partial<RuntimeConfig> = {}): RuntimeConfig => ({
  enabled: true,
  defaultPolicy: 'block',
  domains: ['api.example.com'],
  rulesByKey: {},
  fault: DEFAULT_FAULT,
  normalization: DEFAULT_NORMALIZATION,
  captureHeaders: false,
  showPageBanner: false,
  bannerText: '',
  revision: 1,
  ...over,
});

const dispatch = (data: unknown): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin, source: window }));
};

const tick = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const sent = (): Array<Record<string, unknown>> => (window.postMessage as unknown as { mock: { calls: unknown[][] } })
  .mock.calls.map((call) => call[0] as Record<string, unknown>);

// `vi.resetModules()` önceki interceptor örneklerini bellekten atmaz; onların bekleyen
// debounce timer'ları sonraki testin postMessage mock'una yazabilir. Bu yüzden telemetri
// doğrulamaları her zaman testin KENDİ path'lerine göre filtrelenir.
const telemetryFor = (prefix: string): Array<{ records: Array<{ path: string; reason: string }> }> => sent()
  .filter((message) => message.type === MESSAGE_TYPES.TELEMETRY)
  .map((message) => message as unknown as { records: Array<{ path: string; reason: string }> })
  .filter((message) => message.records.some((entry) => entry.path.startsWith(prefix)));

let originalFetch: ReturnType<typeof vi.fn>;

const load = async (config?: RuntimeConfig): Promise<void> => {
  await import('./interceptor.main');
  dispatch({ type: MESSAGE_TYPES.INIT, token: TOKEN });
  await tick();
  if (config) {
    dispatch({ type: MESSAGE_TYPES.CONFIG, __drsim: TOKEN, config });
    await tick();
  }
};

describe('content/interceptor.main', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (window as unknown as { __DRSIM__?: boolean }).__DRSIM__;

    originalFetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    window.fetch = originalFetch as unknown as typeof window.fetch;
    window.postMessage = vi.fn() as unknown as typeof window.postMessage;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('kapsamdaki isteği varsayılan politikaya göre bloklar', async () => {
    await load(runtimeConfig());

    const response = await window.fetch('https://api.example.com/offers');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: 'DR simulated unavailable' });
    expect(originalFetch).not.toHaveBeenCalled();
  });

  it('izin listesindeki EP gerçek response döner', async () => {
    await load(runtimeConfig({ rulesByKey: { '/offers': 'allow' } }));

    const response = await window.fetch('https://api.example.com/offers');

    expect(response.status).toBe(200);
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it('kapsam dışı istek hiç dokunulmadan geçer', async () => {
    await load(runtimeConfig());

    await window.fetch('https://other.com/offers');

    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it('relative URL location.href ile mutlaklaştırılır', async () => {
    await load(runtimeConfig({ domains: [window.location.host] }));

    const response = await window.fetch('/api/x');

    expect(response.status).toBe(503);
  });

  it('Request nesnesi ve POST varyantı da yakalanır', async () => {
    await load(runtimeConfig());

    const fromRequest = await window.fetch(new Request('https://api.example.com/a'));
    const fromInit = await window.fetch('https://api.example.com/b', { method: 'POST' });

    expect(fromRequest.status).toBe(503);
    expect(fromInit.status).toBe(503);
  });

  it('farklı id’li aynı EP tek kuralla eşleşir', async () => {
    await load(runtimeConfig({ rulesByKey: { '/items/:id/summary': 'allow' } }));

    const first = await window.fetch('https://api.example.com/items/1/summary');
    const second = await window.fetch('https://api.example.com/items/8842/summary');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('simülasyon kapalıyken istek geçer ama telemetri yazılır', async () => {
    await load(runtimeConfig({ enabled: false }));

    await window.fetch('https://api.example.com/observed');
    await vi.waitFor(() => {
      expect(telemetryFor('/observed')).toHaveLength(1);
    });

    expect(telemetryFor('/observed')[0]?.records[0]?.reason).toBe('disabled');
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it('telemetri batch’lenir: 50 ms penceresindeki 5 istek tek mesajda gider', async () => {
    await load(runtimeConfig());
    // Debounce penceresini deterministik tutmak için kayıtlar tek tick'te toplanır
    vi.useFakeTimers();

    const requests = Promise.all(
      Array.from({ length: 5 }, (_unused, i) => window.fetch(`https://api.example.com/batch-${i}`)),
    );
    await vi.advanceTimersByTimeAsync(0);
    await requests;

    expect(telemetryFor('/batch-')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(60);

    const batches = telemetryFor('/batch-');
    expect(batches).toHaveLength(1);
    expect(batches[0]?.records).toHaveLength(5);
  });

  it('config gelmeden atılan istek config sonrası doğru kararla işlenir', async () => {
    await load();

    const pending = window.fetch('https://api.example.com/offers');
    dispatch({ type: MESSAGE_TYPES.CONFIG, __drsim: TOKEN, config: runtimeConfig() });

    expect((await pending).status).toBe(503);
  });

  it('config hiç gelmezse istek pass-through olur (kill-switch)', async () => {
    vi.useFakeTimers();
    await import('./interceptor.main');

    const pending = window.fetch('https://api.example.com/offers');
    await vi.advanceTimersByTimeAsync(1600);

    expect((await pending).status).toBe(200);
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it('token’sız sahte config mesajı yok sayılır', async () => {
    await load();
    dispatch({ type: MESSAGE_TYPES.CONFIG, __drsim: 'sahte', config: runtimeConfig() });
    await tick();

    vi.useFakeTimers();
    const pending = window.fetch('https://api.example.com/offers');
    await vi.advanceTimersByTimeAsync(1600);

    expect((await pending).status).toBe(200);
  });

  it('ikinci enjeksiyonda fetch tekrar sarmalanmaz', async () => {
    await load(runtimeConfig());
    const patched = window.fetch;

    vi.resetModules();
    await import('./interceptor.main');

    expect(window.fetch).toBe(patched);
  });

  it('history.pushState davranışı korunur ve route yayınlanır', async () => {
    await load(runtimeConfig());
    vi.useFakeTimers();

    history.pushState({}, '', '/yeni-sayfa');
    expect(window.location.pathname).toBe('/yeni-sayfa');

    await vi.advanceTimersByTimeAsync(150);
    const routes = sent().filter((message) => message.type === MESSAGE_TYPES.ROUTE);
    expect(routes.some((message) => (message.route as { pathname: string }).pathname === '/yeni-sayfa')).toBe(true);
  });

  it('gerçek hata durumunda istek bozulmaz ve fail kaydı üretilir', async () => {
    originalFetch.mockResolvedValueOnce(new Response('boom', { status: 502 }));
    await load(runtimeConfig({ rulesByKey: { '/real-error-ep': 'allow' } }));

    const response = await window.fetch('https://api.example.com/real-error-ep');
    expect(response.status).toBe(502);

    await vi.waitFor(() => {
      expect(telemetryFor('/real-error-ep')[0]?.records[0]?.reason).toBe('real-error');
    });
  });
});
