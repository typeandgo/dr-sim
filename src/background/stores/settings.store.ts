import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  SETTINGS_WRITE_DEBOUNCE_MS,
  STORAGE_KEYS,
} from '@/core/constants';
import type { Settings } from '@/core/types';

// Kalıcı ayar/profil deposu — 01-architecture.md §5.
// Bozuk veride varsayılana dönülür ve kullanıcıya bilgi verilir (fail-safe).

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

// Kayıtlı domain/sayfa kayıtlarından artık kullanılmayan `enabled` alanını düşürür
const stripEnabled = (value: unknown): unknown => (Array.isArray(value)
  ? value.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const rest = { ...(entry as Record<string, unknown>) };
    delete rest.enabled;
    return rest;
  })
  : value);

// schemaVersion zinciri: migrations[from](data) → data
export const migrations: Record<number, Migration> = {
  0: (data) => ({ ...data, schemaVersion: 1 }),
  // v2: DomainScope.enabled kaldırıldı — eklenen her domain doğrudan etkindir (Revizyon 3)
  1: (data) => ({
    ...data,
    domains: stripEnabled(data.domains),
    pageHosts: stripEnabled(data.pageHosts),
    schemaVersion: 2,
  }),
  // v3: auto-off varsayılanı kapatıldı — mevcut kurulumlardaki 30 dk da temizlenir (Revizyon 7)
  2: (data) => ({
    ...data,
    autoOffMinutes: data.autoOffMinutes === 30 ? null : data.autoOffMinutes,
    schemaVersion: 3,
  }),
  // v4: dil tercihi eklendi (Revizyon 41). Eski kayıtlardaki 'tr' kullanıcı seçimi
  // değil, tek dilli sürümün sabitiydi — tarayıcı diline bırakılır.
  3: (data) => ({
    ...data,
    locale: data.locale === 'en' ? 'en' : 'auto',
    schemaVersion: 4,
  }),
};

export const migrate = (raw: Record<string, unknown>): Record<string, unknown> => {
  let data = raw;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) break;
    data = step(data);
    version = typeof data.schemaVersion === 'number' ? data.schemaVersion : version + 1;
  }

  return data;
};

// Eksik alanlar varsayılanla tamamlanır; tip uyuşmazlığında varsayılan kazanır.
export const normalizeSettings = (raw: unknown): Settings => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };

  const data = migrate(raw as Record<string, unknown>);
  const merged: Settings = { ...DEFAULT_SETTINGS };

  (Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>).forEach((key) => {
    const value = data[key as string];
    if (value === undefined || value === null) return;
    if (Array.isArray(DEFAULT_SETTINGS[key]) !== Array.isArray(value)) return;
    if (!Array.isArray(value) && typeof value !== typeof DEFAULT_SETTINGS[key] && DEFAULT_SETTINGS[key] !== null) return;
    (merged as unknown as Record<string, unknown>)[key as string] = value;
  });

  merged.schemaVersion = SCHEMA_VERSION;
  merged.fault = { ...DEFAULT_SETTINGS.fault, ...(merged.fault ?? {}) };
  merged.normalization = { ...DEFAULT_SETTINGS.normalization, ...(merged.normalization ?? {}) };

  return merged;
};

export interface SettingsStore {
  load: () => Promise<Settings>;
  get: () => Settings;
  reset: () => Promise<Settings>;
  update: (patch: Partial<Settings>) => Promise<Settings>;
  mutate: (fn: (current: Settings) => Settings) => Promise<Settings>;
  revision: () => number;
  notice: () => string | null;
  clearNotice: () => void;
  subscribe: (listener: (settings: Settings) => void) => () => void;
  flush: () => Promise<void>;
}

export const createSettingsStore = (): SettingsStore => {
  let cache: Settings = { ...DEFAULT_SETTINGS };
  let loaded = false;
  let revision = 0;
  let notice: string | null = null;
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingWrite: Promise<void> | null = null;
  const listeners = new Set<(settings: Settings) => void>();

  const notify = (): void => {
    listeners.forEach((listener) => {
      try {
        listener(cache);
      } catch {
        // bir dinleyicinin hatası diğerlerini durdurmasın
      }
    });
  };

  const write = async (): Promise<void> => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: cache });
    } catch {
      notice = 'settings-write';
    }
  };

  const scheduleWrite = (): void => {
    if (writeTimer) clearTimeout(writeTimer);
    pendingWrite = new Promise((resolve) => {
      writeTimer = setTimeout(() => {
        writeTimer = null;
        void write().then(resolve);
      }, SETTINGS_WRITE_DEBOUNCE_MS);
    });
  };

  const commit = async (next: Settings): Promise<Settings> => {
    cache = next;
    revision += 1;
    scheduleWrite();
    notify();
    return cache;
  };

  const load = async (): Promise<Settings> => {
    if (loaded) return cache;

    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const raw = stored[STORAGE_KEYS.SETTINGS] as unknown;
      cache = normalizeSettings(raw);
      if (raw && typeof raw !== 'object') notice = 'settings-read';
    } catch {
      cache = { ...DEFAULT_SETTINGS };
      notice = 'settings-read';
    }

    loaded = true;
    revision += 1;
    return cache;
  };

  return {
    load,
    get: () => cache,
    // Kurulum anına dönüş. Bekleyen debounce'lu yazma İPTAL EDİLİR: yoksa
    // temizlikten sonra tetiklenip eski ayarları geri yazardı.
    reset: async () => {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      pendingWrite = null;

      cache = { ...DEFAULT_SETTINGS };
      revision += 1;
      loaded = true;
      notice = null;

      try {
        await chrome.storage.local.remove(STORAGE_KEYS.SETTINGS);
      } catch {
        notice = 'settings-write';
      }

      notify();
      return cache;
    },
    update: (patch) => commit({ ...cache, ...patch }),
    mutate: (fn) => commit(fn(cache)),
    revision: () => revision,
    notice: () => notice,
    clearNotice: () => {
      notice = null;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush: async () => {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
        await write();
        return;
      }
      await pendingWrite;
    },
  };
};

export const settingsStore = createSettingsStore();
