import {
  SESSION_PERSIST_DEBOUNCE_MS,
  SESSION_TTL_MS,
  STORAGE_KEYS,
} from '@/core/constants';
import { redactHeaders } from '@/core/redact';
import type {
  DecisionReason,
  InventoryItem,
  LogEntry,
  RouteInfo,
  Settings,
  TabSession,
  TelemetryRecord,
} from '@/core/types';

// Sekme oturumu deposu — 01-architecture.md §5.
// Bellek `Map` + `chrome.storage.session` mirror; SW uyanınca rehydrate edilir.
// Ring buffer + TTL ile budanır (as-is kusuru A-4).

const BLOCKED_REASONS: DecisionReason[] = ['blocked', 'default-block'];

const emptySession = (tabId: number, now: number): TabSession => ({
  tabId,
  origin: '',
  routePath: '/',
  title: '',
  inventory: {},
  successLog: [],
  failLog: [],
  outOfScopeCount: 0,
  droppedCount: 0,
  blockedSinceLoad: 0,
  loadedAt: now,
  updatedAt: now,
});

const pushRing = (log: LogEntry[], entry: LogEntry, max: number): { log: LogEntry[]; dropped: number } => {
  const next = [entry, ...log];
  const dropped = Math.max(0, next.length - max);
  return { log: next.slice(0, max), dropped };
};

// Envanter sınırı aşılırsa en eski (lastAt) kayıt düşer
const pruneInventory = (
  inventory: Record<string, InventoryItem>,
  max: number,
): { inventory: Record<string, InventoryItem>; dropped: number } => {
  const entries = Object.values(inventory);
  if (entries.length <= max) return { inventory, dropped: 0 };

  const kept = entries.sort((a, b) => b.lastAt - a.lastAt).slice(0, max);
  const next: Record<string, InventoryItem> = {};
  kept.forEach((item) => {
    next[item.key] = item;
  });

  return { inventory: next, dropped: entries.length - kept.length };
};

const toLogEntry = (record: TelemetryRecord, settings: Settings, id: string): LogEntry => {
  const entry: LogEntry = {
    id,
    at: record.at,
    method: record.method.toUpperCase() as LogEntry['method'],
    path: record.path,
    url: record.url,
    status: record.status,
    durationMs: record.durationMs,
    outcome: record.outcome,
    simulated: record.simulated,
    reason: record.reason,
    routePath: record.routePath,
    frameId: 0,
  };

  if (record.faultKind) entry.faultKind = record.faultKind;
  // Yakalama varsayılan kapalı; açıksa redaction zorunlu geçiştir (T-502)
  if (settings.captureHeaders && record.headers) entry.headers = redactHeaders(record.headers);

  return entry;
};

export interface SessionStore {
  get: (tabId: number) => TabSession | null;
  ensure: (tabId: number) => TabSession;
  all: () => TabSession[];
  applyTelemetry: (tabId: number, records: TelemetryRecord[], dropped: number, settings: Settings) => TabSession;
  setRoute: (tabId: number, route: RouteInfo, title: string, settings: Settings) => TabSession;
  clearInventory: (tabId: number) => void;
  clearLogs: (tabId: number, which?: 'success' | 'fail') => void;
  remove: (tabId: number) => void;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  prune: (now: number) => void;
}

export const createSessionStore = (now: () => number = Date.now): SessionStore => {
  const sessions = new Map<number, TabSession>();
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let logSeq = 0;

  const persist = async (): Promise<void> => {
    try {
      await chrome.storage.session.set({
        [STORAGE_KEYS.SESSIONS]: Object.fromEntries([...sessions.entries()]),
      });
    } catch {
      // storage.session dolabilir; oturum verisi kritik değil
    }
  };

  const schedulePersist = (): void => {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void persist();
    }, SESSION_PERSIST_DEBOUNCE_MS);
  };

  const ensure = (tabId: number): TabSession => {
    const existing = sessions.get(tabId);
    if (existing) return existing;

    const created = emptySession(tabId, now());
    sessions.set(tabId, created);
    return created;
  };

  const upsertInventory = (session: TabSession, record: TelemetryRecord, settings: Settings): void => {
    const key = record.key;
    const existing = session.inventory[key];
    const isFail = record.outcome === 'fail';

    session.inventory[key] = {
      key,
      method: record.method.toUpperCase() as InventoryItem['method'],
      path: record.path,
      sampleUrl: record.url,
      count: (existing?.count ?? 0) + 1,
      lastAt: record.at,
      lastStatus: record.status,
      lastDurationMs: record.durationMs,
      successCount: (existing?.successCount ?? 0) + (isFail ? 0 : 1),
      failCount: (existing?.failCount ?? 0) + (isFail ? 1 : 0),
      simulatedCount: (existing?.simulatedCount ?? 0) + (record.simulated ? 1 : 0),
      lastReason: record.reason,
      origin: record.origin,
      frameId: 0,
      manual: existing?.manual ?? false,
    };

    const pruned = pruneInventory(session.inventory, settings.maxInventoryItems);
    session.inventory = pruned.inventory;
    session.droppedCount += pruned.dropped;
  };

  const applyTelemetry = (
    tabId: number,
    records: TelemetryRecord[],
    dropped: number,
    settings: Settings,
  ): TabSession => {
    const session = ensure(tabId);
    session.droppedCount += dropped;

    records.forEach((record) => {
      if (record.reason === 'out-of-scope') {
        session.outOfScopeCount += 1;
        return;
      }

      upsertInventory(session, record, settings);

      logSeq += 1;
      const entry = toLogEntry(record, settings, `${record.at}-${logSeq}`);

      if (record.outcome === 'success') {
        const result = pushRing(session.successLog, entry, settings.maxLogEntries);
        session.successLog = result.log;
        session.droppedCount += result.dropped;
      } else {
        const result = pushRing(session.failLog, entry, settings.maxLogEntries);
        session.failLog = result.log;
        session.droppedCount += result.dropped;
      }

      if (record.simulated && BLOCKED_REASONS.includes(record.reason)) {
        session.blockedSinceLoad += 1;
      }
    });

    session.updatedAt = now();
    schedulePersist();
    return session;
  };

  const setRoute = (tabId: number, route: RouteInfo, title: string, settings: Settings): TabSession => {
    const session = ensure(tabId);
    const changed = session.routePath !== route.pathname || session.origin !== route.origin;

    session.origin = route.origin;
    session.routePath = route.pathname;
    session.title = title || session.title;

    if (changed) {
      session.loadedAt = now();
      session.blockedSinceLoad = 0;
      if (!settings.keepInventoryOnNavigate) {
        session.inventory = {};
        session.droppedCount = 0;
        session.outOfScopeCount = 0;
      }
    }

    session.updatedAt = now();
    schedulePersist();
    return session;
  };

  return {
    get: (tabId) => sessions.get(tabId) ?? null,
    ensure,
    all: () => [...sessions.values()],
    applyTelemetry,
    setRoute,
    clearInventory: (tabId) => {
      const session = sessions.get(tabId);
      if (!session) return;
      session.inventory = {};
      session.droppedCount = 0;
      session.updatedAt = now();
      schedulePersist();
    },
    clearLogs: (tabId, which) => {
      const session = sessions.get(tabId);
      if (!session) return;
      if (which !== 'fail') session.successLog = [];
      if (which !== 'success') session.failLog = [];
      session.updatedAt = now();
      schedulePersist();
    },
    remove: (tabId) => {
      sessions.delete(tabId);
      schedulePersist();
    },
    // Tüm sekmelerin envanteri ve logları. Bekleyen yazma iptal edilir ki
    // temizlikten sonra eski oturumları geri yazmasın.
    clear: async () => {
      sessions.clear();
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      try {
        await chrome.storage.session.remove(STORAGE_KEYS.SESSIONS);
      } catch {
        // oturum verisi kritik değil
      }
    },
    hydrate: async () => {
      try {
        const stored = await chrome.storage.session.get(STORAGE_KEYS.SESSIONS);
        const raw = stored[STORAGE_KEYS.SESSIONS] as Record<string, TabSession> | undefined;
        if (!raw) return;
        Object.values(raw).forEach((session) => {
          if (typeof session?.tabId === 'number') sessions.set(session.tabId, session);
        });
      } catch {
        // rehydrate başarısızsa boş başlanır
      }
    },
    persist,
    prune: (at) => {
      sessions.forEach((session, tabId) => {
        if (at - session.updatedAt > SESSION_TTL_MS) sessions.delete(tabId);
      });
    },
  };
};

export const sessionStore = createSessionStore();
