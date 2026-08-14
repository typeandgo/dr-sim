import { DEFAULT_SETTINGS, PORT_NAMES, UI_MESSAGES } from '@/core/constants';
import type { UiState } from '@/core/types';
import { createStore, type Store } from './store';

// SW port köprüsü.
// SW uykudaysa `connect` onu uyandırır; port koparsa backoff ile yeniden bağlanır.

export const emptyState = (): UiState => ({
  settings: { ...DEFAULT_SETTINGS },
  session: null,
  tabId: null,
  tabUrl: '',
  supported: true,
  autoOffAt: null,
  notice: null,
  revision: 0,
});

export interface CommandResponse {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface Connection {
  store: Store<UiState>;
  send: (command: string, payload?: Record<string, unknown>) => Promise<CommandResponse>;
  destroy: () => void;
}

const UNSUPPORTED_URL = /^(chrome|edge|about|devtools|chrome-extension|moz-extension):|^https:\/\/chromewebstore\.google\.com/;

export const createConnection = (): Connection => {
  const store = createStore<UiState>(emptyState());
  const pending = new Map<string, (response: CommandResponse) => void>();

  let port: chrome.runtime.Port | null = null;
  let tabId: number | null = null;
  let backoff = 250;
  let destroyed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const resolveTab = async (): Promise<void> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id ?? null;
      const supported = !UNSUPPORTED_URL.test(tab?.url ?? '');
      store.setState((current) => ({ ...current, tabId, tabUrl: tab?.url ?? '', supported }));
    } catch {
      tabId = null;
    }
  };

  const subscribe = (): void => {
    try {
      port?.postMessage({ type: 'SUBSCRIBE', tabId });
    } catch {
      // port koptu; onDisconnect yakalar
    }
  };

  const connect = (): void => {
    if (destroyed) return;

    try {
      port = chrome.runtime.connect({ name: PORT_NAMES.UI });
    } catch {
      scheduleReconnect();
      return;
    }

    backoff = 250;

    port.onMessage.addListener((message: unknown) => {
      const data = message as { type?: string; state?: UiState; id?: string; ok?: boolean; error?: string; data?: unknown };

      if (data?.type === UI_MESSAGES.STATE_SNAPSHOT && data.state) {
        store.setState((current) => ({ ...data.state as UiState, tabUrl: current.tabUrl, supported: current.supported }));
        return;
      }

      if (data?.type === UI_MESSAGES.COMMAND_RESULT && data.id) {
        pending.get(data.id)?.({ ok: data.ok === true, error: data.error, data: data.data });
        pending.delete(data.id);
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      scheduleReconnect();
    });

    subscribe();
  };

  function scheduleReconnect(): void {
    if (destroyed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoff);
    backoff = Math.min(backoff * 2, 5000);
  }

  const send = (command: string, payload: Record<string, unknown> = {}): Promise<CommandResponse> => new Promise((resolve) => {
    if (!port) {
      resolve({ ok: false, error: 'connection.reconnecting' });
      return;
    }

    const id = crypto.randomUUID();
    pending.set(id, resolve);

    try {
      port.postMessage({ type: 'COMMAND', id, command, payload, tabId });
    } catch {
      pending.delete(id);
      resolve({ ok: false, error: 'connection.sendFailed' });
    }

    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      resolve({ ok: false, error: 'connection.timeout' });
    }, 5000);
  });

  const onTabChange = (): void => {
    void resolveTab().then(subscribe);
  };

  chrome.tabs.onActivated.addListener(onTabChange);
  chrome.tabs.onUpdated.addListener(onTabChange);

  void resolveTab().then(connect);

  return {
    store,
    send,
    destroy: () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      chrome.tabs.onActivated.removeListener(onTabChange);
      chrome.tabs.onUpdated.removeListener(onTabChange);
      try {
        port?.disconnect();
      } catch {
        // yok say
      }
    },
  };
};
