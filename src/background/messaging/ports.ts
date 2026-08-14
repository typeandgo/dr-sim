import { PORT_NAMES, SW_MESSAGES, UI_MESSAGES, UI_SNAPSHOT_THROTTLE_MS } from '@/core/constants';
import type { RuntimeConfig, UiState } from '@/core/types';

// SW 30 sn boşta sonlanabilir; portlar kopunca bridge/UI yeniden bağlanır.

interface ContentPortEntry {
  port: chrome.runtime.Port;
  tabId: number;
  frameId: number;
}

const contentPorts = new Set<ContentPortEntry>();
const uiPorts = new Map<chrome.runtime.Port, { tabId: number | null }>();

let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let snapshotPending = false;

export const registerContentPort = (port: chrome.runtime.Port): ContentPortEntry | null => {
  const tabId = port.sender?.tab?.id;
  if (typeof tabId !== 'number') return null;

  const entry: ContentPortEntry = { port, tabId, frameId: port.sender?.frameId ?? 0 };
  contentPorts.add(entry);
  port.onDisconnect.addListener(() => contentPorts.delete(entry));
  return entry;
};

export const registerUiPort = (port: chrome.runtime.Port): void => {
  uiPorts.set(port, { tabId: null });
  port.onDisconnect.addListener(() => uiPorts.delete(port));
};

export const setUiPortTab = (port: chrome.runtime.Port, tabId: number | null): void => {
  const entry = uiPorts.get(port);
  if (entry) entry.tabId = tabId;
};

export const uiPortTabIds = (): Array<number | null> => [...uiPorts.values()].map((entry) => entry.tabId);

const safePost = (port: chrome.runtime.Port, message: unknown): void => {
  try {
    port.postMessage(message);
  } catch {
    // port kopmuş olabilir; onDisconnect temizler
  }
};

export const sendConfigToTab = (tabId: number, config: RuntimeConfig): void => {
  contentPorts.forEach((entry) => {
    if (entry.tabId === tabId) safePost(entry.port, { type: SW_MESSAGES.CONFIG_UPDATED, config });
  });
};

export const broadcastConfig = (config: RuntimeConfig): void => {
  contentPorts.forEach((entry) => safePost(entry.port, { type: SW_MESSAGES.CONFIG_UPDATED, config }));
};

export const contentTabIds = (): number[] => [...new Set([...contentPorts].map((entry) => entry.tabId))];

// UI snapshot'ı throttle'lanır (150 ms) — yüksek trafikte panel boğulmasın
export const broadcastState = (build: (tabId: number | null) => UiState): void => {
  snapshotPending = true;
  if (snapshotTimer) return;

  const flush = (): void => {
    snapshotTimer = null;
    if (!snapshotPending) return;
    snapshotPending = false;

    uiPorts.forEach((entry, port) => {
      safePost(port, { type: UI_MESSAGES.STATE_SNAPSHOT, state: build(entry.tabId) });
    });

    snapshotTimer = setTimeout(flush, UI_SNAPSHOT_THROTTLE_MS);
  };

  flush();
};

export const sendStateTo = (port: chrome.runtime.Port, state: UiState): void => {
  safePost(port, { type: UI_MESSAGES.STATE_SNAPSHOT, state });
};

export const replyCommand = (
  port: chrome.runtime.Port,
  id: string,
  result: { ok: boolean; error?: string; data?: unknown },
): void => {
  safePost(port, { type: UI_MESSAGES.COMMAND_RESULT, id, ...result });
};

export const isUiPort = (port: chrome.runtime.Port): boolean => port.name === PORT_NAMES.UI;
export const isContentPort = (port: chrome.runtime.Port): boolean => port.name === PORT_NAMES.CONTENT;

export const resetPorts = (): void => {
  contentPorts.clear();
  uiPorts.clear();
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = null;
  snapshotPending = false;
};
