import { vi } from 'vitest';

// Minimal `chrome.*` stub — bağımlılık eklemeden (kural 500) MV3 API'lerini taklit eder.

const createStorageArea = () => {
  const data: Record<string, unknown> = {};

  return {
    __data: data,
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (!keys) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      list.forEach((key) => {
        if (key in data) result[key] = data[key];
      });
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete data[key]);
    }),
    clear: vi.fn(async () => {
      Object.keys(data).forEach((key) => delete data[key]);
    }),
  };
};

export const createEvent = <T extends (...args: never[]) => unknown>() => {
  const listeners = new Set<T>();
  return {
    addListener: vi.fn((listener: T) => listeners.add(listener)),
    removeListener: vi.fn((listener: T) => listeners.delete(listener)),
    hasListener: vi.fn((listener: T) => listeners.has(listener)),
    emit: (...args: Parameters<T>) => listeners.forEach((listener) => listener(...args)),
    listenerCount: () => listeners.size,
  };
};

export const installChromeMock = () => {
  const local = createStorageArea();
  const session = createStorageArea();

  const chromeMock = {
    storage: {
      local,
      session,
      onChanged: createEvent(),
    },
    runtime: {
      lastError: undefined as chrome.runtime.LastError | undefined,
      connect: vi.fn(),
      onConnect: createEvent(),
      onInstalled: createEvent(),
      onStartup: createEvent(),
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
      getURL: vi.fn((path: string) => `chrome-extension://drsim/${path}`),
      openOptionsPage: vi.fn(async () => {}),
    },
    // Service worker dili buradan okur (izin gerektirmeyen varsayılan API)
    i18n: {
      getUILanguage: vi.fn(() => 'en'),
    },
    tabs: {
      get: vi.fn(),
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      create: vi.fn(async () => ({}) as chrome.tabs.Tab),
      update: vi.fn(async () => ({}) as chrome.tabs.Tab),
      onRemoved: createEvent(),
      onReplaced: createEvent(),
      onUpdated: createEvent(),
    },
    windows: {
      update: vi.fn(async () => ({}) as chrome.windows.Window),
    },
    action: {
      onClicked: createEvent(),
      setBadgeText: vi.fn(async () => {}),
      setBadgeBackgroundColor: vi.fn(async () => {}),
      setIcon: vi.fn(async () => {}),
      setTitle: vi.fn(async () => {}),
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(async () => true),
      onAlarm: createEvent(),
    },
    permissions: {
      request: vi.fn(async () => true),
      remove: vi.fn(async () => true),
      contains: vi.fn(async () => true),
    },
    scripting: {
      getRegisteredContentScripts: vi.fn(async () => []),
      registerContentScripts: vi.fn(async () => {}),
      updateContentScripts: vi.fn(async () => {}),
      unregisterContentScripts: vi.fn(async () => {}),
    },
    sidePanel: {
      setPanelBehavior: vi.fn(async () => {}),
      open: vi.fn(async () => {}),
    },
    commands: {
      onCommand: createEvent(),
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;
  return chromeMock;
};

export type ChromeMock = ReturnType<typeof installChromeMock>;
export type StorageArea = ReturnType<typeof createStorageArea>;
