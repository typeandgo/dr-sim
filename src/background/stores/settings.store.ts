import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  SETTINGS_WRITE_DEBOUNCE_MS,
  STORAGE_KEYS,
} from '@/core/constants';
import { resolveConflict } from '@/core/rules';
import type { Rule, RuleState, Settings } from '@/core/types';

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

// v4 kural kaydı `key`/`method`/`source`/`note` de taşıyordu; yalnızca `path`
// kalır. Aynı path'e inen kayıtlar birleşir, durum çakışırsa `resolveConflict`
// karar verir (block kazanır) ve `createdAt` en eski kayıttan devralınır —
// kuralın listeye ilk giriş anı odur. `Settings.rules` ile kayıtlı profillerin
// kuralları AYNI yoldan geçer: iki dönüşüm ayrışırsa profil sessizce bozulurdu.
const mergeLegacyRules = (value: unknown): Rule[] => {
  const merged = new Map<string, Rule>();

  (Array.isArray(value) ? value : []).forEach((raw) => {
    const rule = raw as { path?: unknown; state?: unknown; createdAt?: unknown } | null;
    const path = typeof rule?.path === 'string' ? rule.path : '';
    if (!path) return;

    const state: RuleState = rule?.state === 'block' ? 'block' : 'allow';
    const createdAt = typeof rule?.createdAt === 'number' ? rule.createdAt : 0;
    const existing = merged.get(path);

    merged.set(path, existing
      ? { path, state: resolveConflict(existing.state, state), createdAt: Math.min(existing.createdAt, createdAt) }
      : { path, state, createdAt });
  });

  return [...merged.values()];
};

// Profilde kural listesi yoktur; durumuna göre iki path listesine ayrılır.
const splitLegacyRules = (value: unknown): { allow: string[]; block: string[] } => {
  const rules = mergeLegacyRules(value);

  return {
    allow: rules.filter((rule) => rule.state === 'allow').map((rule) => rule.path),
    block: rules.filter((rule) => rule.state === 'block').map((rule) => rule.path),
  };
};

const asStringList = (value: unknown): string[] => (Array.isArray(value) ? value : [])
  .filter((entry): entry is string => typeof entry === 'string');

// v4 profili `domains: DomainScope[]` taşıyordu, yeni biçim düz pattern dizisi.
// `granted` makineye özel izin durumudur ve profile hiç girmez — izin, profil
// uygulanırken yerelde ölçülür (`applyProfile`). Zaten string olan liste aynen geçer.
const toPatternList = (value: unknown): string[] => (Array.isArray(value) ? value : [])
  .map((entry) => {
    if (typeof entry === 'string') return entry;
    const pattern = (entry as { pattern?: unknown } | null)?.pattern;
    return typeof pattern === 'string' ? pattern : '';
  })
  .filter((pattern) => pattern !== '');

// v5 profili dosya biçimini birebir taşır: `rules[]` yerine `allow`/`block`,
// `domains` düz string dizisi. `allow`/`block` zaten varsa profil yeni biçimdedir
// ve listeleri yeniden üretilmez — zincir aynı veri üstünde tekrar koşarsa liste
// boşalmasın (idempotent). Nesne olmayan girdi düşürülür: `profiles.find` gibi
// tüketiciler her kaydın nesne olduğunu varsayıyor.
const migrateProfile = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const profile = { ...(raw as Record<string, unknown>) };
  const lists = Array.isArray(profile.allow) || Array.isArray(profile.block)
    ? { allow: asStringList(profile.allow), block: asStringList(profile.block) }
    : splitLegacyRules(profile.rules);

  delete profile.rules;

  return { ...profile, domains: toPatternList(profile.domains), ...lists };
};

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
  // v5: kural anahtarı METHOD+path'ten yalnız path'e indi (Revizyon 59).
  // KAYITLI PROFİLLER DE dönüşür: atlanırlarsa profil `allow`/`block` taşımaz,
  // uygulanınca ham TypeError fırlatır ve dışa aktarılınca kural listesi
  // SESSİZCE düşer — indirilen dosya artık geri yüklenemez hale gelirdi.
  4: (data) => ({
    ...data,
    rules: mergeLegacyRules(data.rules),
    profiles: (Array.isArray(data.profiles) ? data.profiles : [])
      .map(migrateProfile)
      .filter((profile): profile is Record<string, unknown> => profile !== null),
    schemaVersion: 5,
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
