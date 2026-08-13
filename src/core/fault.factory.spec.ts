import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FAULT, SIMULATED_HEADER } from './constants';
import {
  applyFetchFault,
  applyXhrFault,
  createAbortError,
  createNetworkError,
  describeHttpFault,
  isJsonBody,
  serializeHeaders,
  wait,
} from './fault.factory';
import type { FaultConfig } from './types';

const fault = (over: Partial<FaultConfig> = {}): FaultConfig => ({ ...DEFAULT_FAULT, ...over });

describe('core/fault.factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('yardımcılar', () => {
    it('AbortError üretir', () => {
      expect(createAbortError().name).toBe('AbortError');
    });

    it('network hatası TypeError’dır', () => {
      expect(createNetworkError()).toBeInstanceOf(TypeError);
    });

    it.each([
      ['{"a":1}', true],
      ['not json', false],
    ])('isJsonBody(%s) -> %s', (body, expected) => {
      expect(isJsonBody(body)).toBe(expected);
    });

    it('header’ları XHR biçiminde serialize eder', () => {
      expect(serializeHeaders({ 'Content-Type': 'application/json' })).toBe('content-type: application/json');
    });
  });

  describe('describeHttpFault', () => {
    it('JSON gövdede application/json ve simüle header’ı taşır', () => {
      const described = describeHttpFault(fault());
      expect(described.headers['content-type']).toBe('application/json');
      expect(described.headers[SIMULATED_HEADER]).toBe('1');
    });

    it('geçersiz JSON gövdede düz metin döner, hata fırlatmaz', () => {
      const described = describeHttpFault(fault({ body: 'plain text' }));
      expect(described.headers['content-type']).toBe('text/plain;charset=utf-8');
      expect(described.body).toBe('plain text');
    });

    it('kullanıcı header’ları eklenir', () => {
      const described = describeHttpFault(fault({ headers: { 'x-custom': 'v' } }));
      expect(described.headers['x-custom']).toBe('v');
    });
  });

  describe('wait', () => {
    it('iptal edilmiş signal ile hemen reddeder', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(wait(10, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('bekleme sırasında iptal edilirse reddeder', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const promise = wait(1000, controller.signal);
      controller.abort();
      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('signal olmadan süre sonunda çözülür', async () => {
      vi.useFakeTimers();
      const promise = wait(50);
      vi.advanceTimersByTime(50);
      await expect(promise).resolves.toBeUndefined();
    });

    it('iptal edilmeyen signal ile süre sonunda çözülür ve listener bırakılır', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const remove = vi.spyOn(controller.signal, 'removeEventListener');
      const promise = wait(50, controller.signal);
      vi.advanceTimersByTime(50);
      await expect(promise).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    });
  });

  describe('applyFetchFault', () => {
    it.each([503, 500, 429])('http fault %d döner ve gövdesi okunabilir', async (status) => {
      const response = await applyFetchFault(fault({ status }));
      expect(response.status).toBe(status);
      expect(response.headers.get(SIMULATED_HEADER)).toBe('1');
      await expect(response.json()).resolves.toEqual({ message: 'DR simulated unavailable' });
    });

    it('network fault TypeError ile reddeder', async () => {
      await expect(applyFetchFault(fault({ kind: 'network' }))).rejects.toBeInstanceOf(TypeError);
    });

    it('timeout fault süre sonunda AbortError verir', async () => {
      vi.useFakeTimers();
      const promise = applyFetchFault(fault({ kind: 'timeout', timeoutMs: 3000 }));
      const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(3000);
      await assertion;
    });

    it('delayMs ayarlıyken arıza gecikmeli döner', async () => {
      vi.useFakeTimers();
      const promise = applyFetchFault(fault({ delayMs: 200 }));
      let settled = false;
      void promise.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(199);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(settled).toBe(true);
    });

    it('iptal edilmiş signal ile hemen AbortError verir', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(applyFetchFault(fault(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    });
  });

  describe('applyXhrFault', () => {
    it('http fault load event’i ve taklit yanıt döner', async () => {
      const outcome = await applyXhrFault(fault());
      expect(outcome).toMatchObject({ type: 'load', response: { status: 503 } });
    });

    it('network fault error event’i döner', async () => {
      expect(await applyXhrFault(fault({ kind: 'network' }))).toEqual({ type: 'error' });
    });

    it('timeout fault timeout event’i döner', async () => {
      vi.useFakeTimers();
      const promise = applyXhrFault(fault({ kind: 'timeout', timeoutMs: 1000 }));
      await vi.advanceTimersByTimeAsync(1000);
      expect(await promise).toEqual({ type: 'timeout' });
    });

    it('iptal edilmiş signal ile abort döner', async () => {
      const controller = new AbortController();
      controller.abort();
      expect(await applyXhrFault(fault(), controller.signal)).toEqual({ type: 'abort' });
    });

    it('gecikme sırasında iptal edilirse abort döner', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const promise = applyXhrFault(fault({ delayMs: 500 }), controller.signal);
      controller.abort();
      expect(await promise).toEqual({ type: 'abort' });
    });

    it('delayMs ayarlıyken gecikmeli döner', async () => {
      vi.useFakeTimers();
      const promise = applyXhrFault(fault({ delayMs: 100 }));
      await vi.advanceTimersByTimeAsync(100);
      expect(await promise).toMatchObject({ type: 'load' });
    });
  });
});
