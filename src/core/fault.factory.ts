import { SIMULATED_HEADER } from './constants';
import type { FaultConfig } from './types';

// Arıza üretimi — 01-architecture.md §2.4. Arıza ayarı globaldir; kural bazlı arıza yoktur.

export interface SimulatedHttpResponse {
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
}

export const createAbortError = (): DOMException => new DOMException('The operation was aborted.', 'AbortError');

export const createNetworkError = (): TypeError => new TypeError('Failed to fetch');

// Gövde geçerli JSON mu? Değilse düz metin olarak döner, hata fırlatılmaz.
export const isJsonBody = (body: string): boolean => {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
};

export const describeHttpFault = (fault: FaultConfig): SimulatedHttpResponse => ({
  status: fault.status,
  statusText: fault.statusText,
  body: fault.body,
  headers: {
    'content-type': isJsonBody(fault.body) ? 'application/json' : 'text/plain;charset=utf-8',
    [SIMULATED_HEADER]: '1',
    ...fault.headers,
  },
});

// Verilen süre kadar bekler; signal iptal edilirse AbortError ile reddeder.
export const wait = (ms: number, signal?: AbortSignal | null): Promise<void> => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError());
    return;
  }

  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);

  function onAbort() {
    clearTimeout(timer);
    reject(createAbortError());
  }

  signal?.addEventListener('abort', onAbort, { once: true });
});

// fetch tarafı: arıza tipine göre Response döner veya uygun hatayla reddeder.
export const applyFetchFault = async (fault: FaultConfig, signal?: AbortSignal | null): Promise<Response> => {
  if (signal?.aborted) throw createAbortError();

  if (fault.kind === 'timeout') {
    await wait(fault.timeoutMs, signal);
    throw createAbortError();
  }

  if (fault.delayMs > 0) await wait(fault.delayMs, signal);

  if (fault.kind === 'network') throw createNetworkError();

  const described = describeHttpFault(fault);
  return new Response(described.body, {
    status: described.status,
    statusText: described.statusText,
    headers: described.headers,
  });
};

export type XhrFaultOutcome =
  | { type: 'load'; response: SimulatedHttpResponse }
  | { type: 'error' }
  | { type: 'timeout' }
  | { type: 'abort' };

// XHR tarafı: event tipini ve (varsa) taklit edilecek yanıtı belirler.
export const applyXhrFault = async (fault: FaultConfig, signal?: AbortSignal | null): Promise<XhrFaultOutcome> => {
  if (signal?.aborted) return { type: 'abort' };

  try {
    if (fault.kind === 'timeout') {
      await wait(fault.timeoutMs, signal);
      return { type: 'timeout' };
    }

    if (fault.delayMs > 0) await wait(fault.delayMs, signal);
  } catch {
    return { type: 'abort' };
  }

  if (fault.kind === 'network') return { type: 'error' };

  return { type: 'load', response: describeHttpFault(fault) };
};

// XHR `getAllResponseHeaders()` biçimi
export const serializeHeaders = (headers: Record<string, string>): string => Object.entries(headers)
  .map(([name, value]) => `${name.toLowerCase()}: ${value}`)
  .join('\r\n');
