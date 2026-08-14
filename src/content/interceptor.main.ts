import {
  CONFIG_READY_TIMEOUT_MS,
  ROUTE_DEBOUNCE_MS,
  TELEMETRY_DEBOUNCE_MS,
  TELEMETRY_MAX_BATCH,
  TELEMETRY_MAX_QUEUE,
} from '@/core/constants';
import { decide, shouldRecord } from '@/core/decision-engine';
import { applyFetchFault, applyXhrFault, serializeHeaders } from '@/core/fault.factory';
import { MESSAGE_TYPES } from '@/core/message.schema';
import type { Decision, DecisionReason, RuntimeConfig, TelemetryRecord } from '@/core/types';

// MAIN world interceptor.
// Kural: burada atılan HİÇBİR hata sayfanın isteğini bozmamalı; her yol
// try/catch ile orijinal fetch/XHR'a düşer (global kill-switch).

interface XhrState {
  method: string;
  url: string;
  async: boolean;
  headers: Record<string, string>;
  startedAt: number;
  simulated: boolean;
}

type PatchedWindow = Window & { __DRSIM__?: boolean };

const scope = window as unknown as PatchedWindow;

if (!scope.__DRSIM__) {
  scope.__DRSIM__ = true;

  const originalFetch = window.fetch.bind(window);
  const OriginalXhr = window.XMLHttpRequest;
  const xhrOpen = OriginalXhr.prototype.open;
  const xhrSend = OriginalXhr.prototype.send;
  const xhrSetRequestHeader = OriginalXhr.prototype.setRequestHeader;
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  let channelToken: string | null = null;
  let config: RuntimeConfig | null = null;
  let configTimedOut = false;
  let missedRequests = 0;

  let resolveConfig: () => void = () => {};
  const configReady = new Promise<void>((resolve) => {
    resolveConfig = resolve;
  });
  window.setTimeout(() => {
    configTimedOut = true;
    resolveConfig();
  }, CONFIG_READY_TIMEOUT_MS);

  // ---------------------------------------------------------------- köprü

  const post = (payload: Record<string, unknown>): void => {
    if (!channelToken) return;
    try {
      window.postMessage({ ...payload, __drsim: channelToken }, window.location.origin);
    } catch {
      // sayfa postMessage'ı bozmuş olabilir; sessiz geç
    }
  };

  const announceReady = (): void => {
    try {
      window.postMessage(
        { type: MESSAGE_TYPES.READY, href: window.location.href, __drsim: 'handshake' },
        window.location.origin,
      );
    } catch {
      // yok say
    }
  };

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return;

    if (data.type === MESSAGE_TYPES.INIT && typeof data.token === 'string') {
      channelToken = data.token;
      return;
    }

    if (data.type !== MESSAGE_TYPES.CONFIG) return;
    if (!channelToken || data.__drsim !== channelToken) return;

    config = data.config as RuntimeConfig;
    resolveConfig();
  });

  // -------------------------------------------------------------- telemetri

  const queue: TelemetryRecord[] = [];
  let dropped = 0;
  let flushTimer: number | null = null;

  const flush = (): void => {
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!queue.length && !dropped) return;

    const records = queue.splice(0, TELEMETRY_MAX_BATCH);
    post({ type: MESSAGE_TYPES.TELEMETRY, records, dropped });
    dropped = 0;

    if (queue.length) scheduleFlush();
  };

  function scheduleFlush(): void {
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(flush, TELEMETRY_DEBOUNCE_MS);
  }

  const record = (entry: TelemetryRecord): void => {
    if (queue.length >= TELEMETRY_MAX_QUEUE) {
      queue.shift();
      dropped += 1;
    }
    queue.push(entry);
    scheduleFlush();
  };

  window.addEventListener('pagehide', flush);

  // ------------------------------------------------------------------ route

  let routeTimer: number | null = null;

  const emitRoute = (): void => {
    post({
      type: MESSAGE_TYPES.ROUTE,
      route: {
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      },
    });
  };

  const scheduleRoute = (): void => {
    if (routeTimer !== null) window.clearTimeout(routeTimer);
    routeTimer = window.setTimeout(emitRoute, ROUTE_DEBOUNCE_MS);
  };

  history.pushState = function pushState(this: History, ...args: Parameters<History['pushState']>) {
    const result = originalPushState.apply(this, args);
    scheduleRoute();
    return result;
  };

  history.replaceState = function replaceState(this: History, ...args: Parameters<History['replaceState']>) {
    const result = originalReplaceState.apply(this, args);
    scheduleRoute();
    return result;
  };

  window.addEventListener('popstate', scheduleRoute);
  window.addEventListener('hashchange', scheduleRoute);

  // ------------------------------------------------------------------ karar

  const currentRoutePath = (): string => window.location.pathname;

  // Config beklenir (üst sınır 1500 ms). Config yoksa karar verilmez → pass-through.
  const resolveDecision = async (method: string, url: string): Promise<Decision | null> => {
    if (config && !config.domains.length) return null;

    if (!config) {
      await configReady;
      if (!config) {
        if (!configTimedOut) return null;
        missedRequests += 1;
        return null;
      }
    }

    return decide({ method, url }, config);
  };

  const absolute = (url: string): string => {
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  };

  const toRecord = (
    decision: Decision,
    over: Partial<TelemetryRecord> & Pick<TelemetryRecord, 'url' | 'outcome' | 'origin'>,
  ): TelemetryRecord => ({
    method: decision.method,
    path: decision.path,
    key: decision.key,
    reason: decision.reason,
    at: Date.now(),
    status: null,
    durationMs: null,
    simulated: false,
    routePath: currentRoutePath(),
    ...over,
  });

  const realErrorReason = (decision: Decision, ok: boolean): DecisionReason => (ok ? decision.reason : 'real-error');

  // ------------------------------------------------------------------ fetch

  const readRequestMeta = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): { method: string; url: string; signal: AbortSignal | null; headers: Record<string, string> } => {
    const headers: Record<string, string> = {};
    let method = init?.method ?? 'GET';
    let url: string;
    let signal: AbortSignal | null = init?.signal ?? null;

    if (typeof Request !== 'undefined' && input instanceof Request) {
      url = input.url;
      method = init?.method ?? input.method;
      signal = init?.signal ?? input.signal;
      if (config?.captureHeaders) input.headers.forEach((value, name) => { headers[name] = value; });
    } else {
      url = absolute(String(input));
    }

    if (config?.captureHeaders && init?.headers) {
      new Headers(init.headers).forEach((value, name) => { headers[name] = value; });
    }

    return { method, url: absolute(url), signal, headers };
  };

  const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let meta: ReturnType<typeof readRequestMeta>;
    let decision: Decision | null;

    try {
      meta = readRequestMeta(input, init);
      decision = await resolveDecision(meta.method, meta.url);
    } catch {
      return originalFetch(input as RequestInfo, init);
    }

    if (!decision || !shouldRecord(decision)) return originalFetch(input as RequestInfo, init);

    const startedAt = performance.now();

    if (decision.block && config) {
      const { fault } = config;
      const response = await applyFetchFault(fault, meta.signal).catch((error: unknown) => {
        record(
          toRecord(decision, {
            url: meta.url,
            outcome: 'fail',
            origin: 'fetch',
            simulated: true,
            status: null,
            durationMs: performance.now() - startedAt,
            faultKind: fault.kind,
            headers: config?.captureHeaders ? meta.headers : undefined,
          }),
        );
        throw error;
      });

      record(
        toRecord(decision, {
          url: meta.url,
          outcome: 'fail',
          origin: 'fetch',
          simulated: true,
          status: response.status,
          durationMs: performance.now() - startedAt,
          faultKind: fault.kind,
          headers: config.captureHeaders ? meta.headers : undefined,
        }),
      );

      return response;
    }

    try {
      const response = await originalFetch(input as RequestInfo, init);
      record(
        toRecord(decision, {
          url: meta.url,
          outcome: response.ok ? 'success' : 'fail',
          origin: 'fetch',
          status: response.status,
          durationMs: performance.now() - startedAt,
          reason: realErrorReason(decision, response.ok),
          headers: config?.captureHeaders ? meta.headers : undefined,
        }),
      );
      return response;
    } catch (error) {
      record(
        toRecord(decision, {
          url: meta.url,
          outcome: 'fail',
          origin: 'fetch',
          status: null,
          durationMs: performance.now() - startedAt,
          reason: 'real-error',
        }),
      );
      throw error;
    }
  };

  window.fetch = patchedFetch as typeof window.fetch;

  // -------------------------------------------------------------------- XHR

  const states = new WeakMap<XMLHttpRequest, XhrState>();

  OriginalXhr.prototype.open = function open(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    isAsync: boolean | undefined = true,
    ...rest: unknown[]
  ) {
    try {
      states.set(this, {
        method,
        url: absolute(String(url)),
        async: isAsync !== false,
        headers: {},
        startedAt: 0,
        simulated: false,
      });
    } catch {
      // state tutulamazsa istek normal akar
    }
    return (xhrOpen as (...args: unknown[]) => void).call(this, method, url, isAsync, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  OriginalXhr.prototype.setRequestHeader = function setRequestHeader(
    this: XMLHttpRequest,
    name: string,
    value: string,
  ) {
    const state = states.get(this);
    if (state) state.headers[name] = value;
    return xhrSetRequestHeader.call(this, name, value);
  };

  const defineReadOnly = (xhr: XMLHttpRequest, key: string, value: unknown): void => {
    Object.defineProperty(xhr, key, { configurable: true, get: () => value });
  };

  const fireEvent = (xhr: XMLHttpRequest, type: string): void => {
    xhr.dispatchEvent(new ProgressEvent(type));
  };

  // Simüle yanıtı gerçek XHR gibi gösterir: readyState/status alanları + event sırası
  const simulateXhr = async (xhr: XMLHttpRequest, state: XhrState, decision: Decision): Promise<void> => {
    if (!config) return;
    const { fault } = config;
    const outcome = await applyXhrFault(fault);
    const durationMs = performance.now() - state.startedAt;

    if (outcome.type === 'abort') {
      fireEvent(xhr, 'abort');
      fireEvent(xhr, 'loadend');
      return;
    }

    const status = outcome.type === 'load' ? outcome.response.status : 0;
    const statusText = outcome.type === 'load' ? outcome.response.statusText : '';
    const body = outcome.type === 'load' ? outcome.response.body : '';
    const headerString = outcome.type === 'load' ? serializeHeaders(outcome.response.headers) : '';

    defineReadOnly(xhr, 'readyState', 4);
    defineReadOnly(xhr, 'status', status);
    defineReadOnly(xhr, 'statusText', statusText);
    defineReadOnly(xhr, 'responseText', body);
    defineReadOnly(xhr, 'response', xhr.responseType === 'json' && body ? safeJson(body) : body);
    defineReadOnly(xhr, 'responseURL', state.url);
    Object.defineProperty(xhr, 'getAllResponseHeaders', {
      configurable: true,
      value: () => headerString,
    });
    Object.defineProperty(xhr, 'getResponseHeader', {
      configurable: true,
      value: (name: string) => (outcome.type === 'load' ? outcome.response.headers[name.toLowerCase()] ?? null : null),
    });

    record(
      toRecord(decision, {
        url: state.url,
        outcome: 'fail',
        origin: 'xhr',
        simulated: true,
        status: status || null,
        durationMs,
        faultKind: fault.kind,
        headers: config.captureHeaders ? state.headers : undefined,
      }),
    );

    xhr.onreadystatechange?.call(xhr, new Event('readystatechange'));
    xhr.dispatchEvent(new Event('readystatechange'));

    if (outcome.type === 'load') {
      fireEvent(xhr, 'load');
    } else if (outcome.type === 'timeout') {
      fireEvent(xhr, 'timeout');
    } else {
      fireEvent(xhr, 'error');
    }
    fireEvent(xhr, 'loadend');
  };

  const safeJson = (body: string): unknown => {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  };

  const attachRealXhrTelemetry = (xhr: XMLHttpRequest, state: XhrState, decision: Decision): void => {
    const finish = (outcome: 'success' | 'fail', reason: DecisionReason): void => {
      record(
        toRecord(decision, {
          url: state.url,
          outcome,
          origin: 'xhr',
          status: xhr.status || null,
          durationMs: performance.now() - state.startedAt,
          reason,
          headers: config?.captureHeaders ? state.headers : undefined,
        }),
      );
    };

    xhr.addEventListener('load', () => {
      const ok = xhr.status >= 200 && xhr.status < 400;
      finish(ok ? 'success' : 'fail', realErrorReason(decision, ok));
    });
    xhr.addEventListener('error', () => finish('fail', 'real-error'));
    xhr.addEventListener('timeout', () => finish('fail', 'real-error'));
  };

  OriginalXhr.prototype.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const state = states.get(this);
    if (!state) return xhrSend.call(this, body ?? null);

    state.startedAt = performance.now();

    // Sync XHR beklenemez (01 §2.2) → pass-through + bilgi telemetrisi
    if (!state.async) {
      if (config?.domains.length) {
        record({
          method: state.method.toUpperCase(),
          url: state.url,
          path: new URL(state.url).pathname,
          key: `${state.method.toUpperCase()} ${new URL(state.url).pathname}`,
          at: Date.now(),
          status: null,
          durationMs: null,
          outcome: 'success',
          simulated: false,
          reason: 'sync-xhr',
          origin: 'xhr',
          routePath: currentRoutePath(),
        });
      }
      return xhrSend.call(this, body ?? null);
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- async closure'a XHR örneği taşınır
    const xhr = this;

    void (async () => {
      let decision: Decision | null = null;
      try {
        decision = await resolveDecision(state.method, state.url);
      } catch {
        decision = null;
      }

      if (!decision || !shouldRecord(decision)) {
        xhrSend.call(xhr, body ?? null);
        return;
      }

      if (decision.block && config) {
        state.simulated = true;
        await simulateXhr(xhr, state, decision).catch(() => {
          xhrSend.call(xhr, body ?? null);
        });
        return;
      }

      attachRealXhrTelemetry(xhr, state, decision);
      xhrSend.call(xhr, body ?? null);
    })();

    return undefined;
  };

  // ------------------------------------------------------------------- açılış

  announceReady();
  emitRoute();

  window.addEventListener('load', () => {
    if (missedRequests > 0) post({ type: MESSAGE_TYPES.TELEMETRY, records: [], dropped: missedRequests });
  });
}
