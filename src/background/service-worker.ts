import { ALARM_AUTO_OFF, COMMANDS, SW_MESSAGES } from '@/core/constants';
import { compileConfig } from '@/core/compile-config';
import { validateDomainPattern } from '@/core/matcher';
import { createTranslator, resolveLocale } from '@/core/i18n';
import { buildProfileFile, snapshotProfile } from '@/core/profile';
import { buildReportFile } from '@/core/report.builder';
import {
  bulkSetRuleState,
  removeRule,
  toggleRule,
  upsertRule,
  validateRulePath,
} from '@/core/rules';
import type {
  DomainScope,
  Profile,
  RouteInfo,
  Settings,
  TelemetryRecord,
  UiState,
} from '@/core/types';
import { updateBadge } from './badge';
import { autoOffDeadline, cancelAutoOff, productionDomains, scheduleAutoOff } from './guards/auto-off';
import {
  broadcastConfig,
  broadcastState,
  isContentPort,
  isUiPort,
  registerContentPort,
  registerUiPort,
  replyCommand,
  sendStateTo,
  setUiPortTab,
} from './messaging/ports';
import {
  hasDomainPermission,
  releaseDomainPermission,
  syncContentScripts,
} from './permissions/scope.manager';
import { sessionStore } from './stores/session.store';
import { settingsStore } from './stores/settings.store';

// Service worker — 01-architecture.md §4. Tüm komutlar `{ ok, error? }` ile yanıtlanır;
// hiçbir handler hatası SW'yi çökertmez.

const UNSUPPORTED_URL = /^(chrome|edge|about|devtools|chrome-extension|moz-extension):|^https:\/\/chromewebstore\.google\.com/;

let bootstrapped: Promise<void> | null = null;

const config = (): ReturnType<typeof compileConfig> => compileConfig(settingsStore.get(), settingsStore.revision(), translator());

// Toolbar başlığı da arayüz diliyle aynı (Revizyon 41)
const badgeTitle = (enabled: boolean, blockedCount = 0): string => (enabled
  ? translator()('badge.on', { count: blockedCount })
  : translator()('badge.off'));

const buildState = (tabId: number | null): UiState => {
  const settings = settingsStore.get();
  const session = tabId === null ? null : sessionStore.get(tabId);

  return {
    settings,
    session,
    tabId,
    tabUrl: session?.origin ?? '',
    supported: true,
    autoOffAt: autoOffDeadline(),
    notice: settingsStore.notice(),
    revision: settingsStore.revision(),
  };
};

const pushState = (): void => broadcastState(buildState);

const applyRuntimeSideEffects = async (): Promise<void> => {
  const settings = settingsStore.get();
  await syncContentScripts(settings.domains, settings.pageHosts);
  broadcastConfig(config());
  await updateBadge(settings.enabled, badgeTitle(settings.enabled));
  pushState();
};

const bootstrap = async (): Promise<void> => {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      await settingsStore.load();
      await sessionStore.hydrate();
      sessionStore.prune(Date.now());
      await syncContentScripts(settingsStore.get().domains, settingsStore.get().pageHosts);
      await updateBadge(settingsStore.get().enabled, badgeTitle(settingsStore.get().enabled));
    })();
  }
  return bootstrapped;
};

// ------------------------------------------------------------------ komutlar

interface CommandContext {
  tabId: number | null;
  payload: Record<string, unknown>;
}

type CommandResult = { ok: boolean; error?: string; data?: unknown };

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const asNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const setEnabled = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const enabled = payload.enabled === true;
  const settings = settingsStore.get();

  if (enabled && settings.productionGuard && payload.confirmProduction !== true) {
    const risky = productionDomains(settings.domains, settings.productionHostPatterns);
    if (risky.length) return { ok: false, error: 'production-guard', data: { domains: risky } };
  }

  await settingsStore.update({ enabled });
  if (enabled) await scheduleAutoOff(settingsStore.get().autoOffMinutes);
  else await cancelAutoOff();

  return { ok: true };
};

const toggleRuleState = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const key = asString(payload.key);
  if (!key) return { ok: false, error: 'invalid-key' };

  const [method = 'GET', path = '/'] = [key.split(' ')[0], key.split(' ').slice(1).join(' ')];

  await settingsStore.mutate((current) => ({
    ...current,
    rules: toggleRule(current.rules, {
      key,
      method,
      path,
      defaultPolicy: current.defaultPolicy,
      source: (payload.source as never) ?? 'inventory',
      now: Date.now(),
    }),
  }));

  return { ok: true };
};

const setRuleState = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const validation = validateRulePath(asString(payload.path));
  if (!validation.ok) return { ok: false, error: validation.error };

  const state = payload.state === 'block' ? 'block' : 'allow';

  await settingsStore.mutate((current) => ({
    ...current,
    rules: upsertRule(current.rules, {
      method: asString(payload.method, 'GET'),
      path: validation.path,
      state,
      source: (payload.source as never) ?? 'manual',
      now: Date.now(),
    }),
  }));

  return { ok: true };
};

const addDomain = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const validation = validateDomainPattern(asString(payload.pattern));
  if (!validation.ok) return { ok: false, error: validation.error };

  const existing = settingsStore.get().domains;
  if (existing.some((domain) => domain.pattern === validation.pattern)) {
    return { ok: false, error: 'Bu domain zaten ekli.' };
  }

  // İzin UI tarafında (kullanıcı hareketi bağlamında) istenmiştir; burada yalnızca doğrulanır
  const granted = await hasDomainPermission(validation.pattern);
  const domain: DomainScope = {
    id: crypto.randomUUID(),
    pattern: validation.pattern,
    granted,
  };

  await settingsStore.mutate((current) => ({ ...current, domains: [...current.domains, domain] }));
  return { ok: true };
};

const removeDomain = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const id = asString(payload.id);
  const target = settingsStore.get().domains.find((domain) => domain.id === id);
  if (!target) return { ok: false, error: 'not-found' };

  const remaining = settingsStore.get().domains.filter((domain) => domain.id !== id);
  await settingsStore.update({ domains: remaining });
  await releaseDomainPermission(target.pattern, [...remaining, ...settingsStore.get().pageHosts]);
  return { ok: true };
};

// Aktif sekmenin origin'ine enjeksiyon izni ister (uygulama host'u ≠ API host'u durumu)
const addPageHost = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const validation = validateDomainPattern(asString(payload.pattern));
  if (!validation.ok) return { ok: false, error: validation.error };

  const existing = settingsStore.get().pageHosts;
  if (existing.some((host) => host.pattern === validation.pattern)) return { ok: true };

  const granted = await hasDomainPermission(validation.pattern);
  if (!granted) return { ok: false, error: 'permission-denied' };

  const host: DomainScope = {
    id: crypto.randomUUID(),
    pattern: validation.pattern,
    granted: true,
  };

  await settingsStore.mutate((current) => ({ ...current, pageHosts: [...current.pageHosts, host] }));
  return { ok: true };
};

const removePageHost = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const id = asString(payload.id);
  const target = settingsStore.get().pageHosts.find((host) => host.id === id);
  if (!target) return { ok: false, error: 'not-found' };

  const remaining = settingsStore.get().pageHosts.filter((host) => host.id !== id);
  await settingsStore.update({ pageHosts: remaining });
  await releaseDomainPermission(target.pattern, [...remaining, ...settingsStore.get().domains]);
  return { ok: true };
};

const applyProfile = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const id = asString(payload.id);
  // Gömülü preset yok (Revizyon 34): profiller yalnızca içe aktarma ile listeye girer.
  const profile = settingsStore.get().profiles.find((entry) => entry.id === id);

  if (!profile) return { ok: false, error: 'not-found' };

  await settingsStore.mutate((current) => ({
    ...current,
    defaultPolicy: profile.defaultPolicy,
    rules: profile.rules,
    fault: profile.fault,
    domains: profile.domains.length ? profile.domains : current.domains,
    activeProfileId: profile.id,
  }));

  return { ok: true };
};

const saveProfile = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const name = asString(payload.name).trim();
  if (!name) return { ok: false, error: 'Profil adı boş olamaz.' };

  const current = settingsStore.get();
  const profile = snapshotProfile(current, asString(payload.id) || crypto.randomUUID(), name, Date.now());

  const others = current.profiles.filter((entry) => entry.id !== profile.id);
  await settingsStore.update({ profiles: [...others, profile], activeProfileId: profile.id });
  return { ok: true, data: { id: profile.id } };
};

const importProfile = async ({ payload }: CommandContext): Promise<CommandResult> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(asString(payload.json));
  } catch {
    return { ok: false, error: 'invalid-json' };
  }

  const candidate = parsed as Partial<Profile>;
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.rules)) {
    return { ok: false, error: 'profile-schema' };
  }

  const profile: Profile = {
    id: asString(candidate.id) || crypto.randomUUID(),
    name: asString(candidate.name, 'İçe aktarılan profil'),
    defaultPolicy: candidate.defaultPolicy === 'pass' ? 'pass' : 'block',
    domains: Array.isArray(candidate.domains) ? candidate.domains : [],
    rules: candidate.rules,
    fault: candidate.fault ?? settingsStore.get().fault,
    updatedAt: Date.now(),
  };

  const others = settingsStore.get().profiles.filter((entry) => entry.id !== profile.id);
  await settingsStore.update({ profiles: [...others, profile] });
  return { ok: true, data: { id: profile.id } };
};

// Rapor ve profil metinleri arayüzle aynı dilde üretilir (Revizyon 41)
const translator = () => createTranslator(resolveLocale(settingsStore.get().locale, chrome.i18n.getUILanguage()));

const exportReport = ({ tabId, payload }: CommandContext): CommandResult => {
  const session = tabId === null ? null : sessionStore.get(tabId);
  const input = { session, settings: settingsStore.get(), t: translator(), now: Date.now() };

  return { ok: true, data: buildReportFile(asString(payload.format, 'markdown'), input) };
};

const handlers: Record<string, (ctx: CommandContext) => CommandResult | Promise<CommandResult>> = {
  [COMMANDS.SET_ENABLED]: setEnabled,
  [COMMANDS.SET_DEFAULT_POLICY]: async ({ payload }) => {
    await settingsStore.update({ defaultPolicy: payload.policy === 'pass' ? 'pass' : 'block' });
    return { ok: true };
  },
  [COMMANDS.TOGGLE_RULE_STATE]: toggleRuleState,
  [COMMANDS.SET_RULE_STATE]: setRuleState,
  // Revizyon 15'te izin listesi paneli kaldırıldı; bu iki komutun şu an UI yüzeyi yok.
  // Protokolde bırakıldılar (01 §4.3) — elle EP ekleme geri istenirse tek bileşen yeter.
  [COMMANDS.ADD_MANUAL_ENDPOINT]: setRuleState,
  [COMMANDS.REMOVE_RULE]: async ({ payload }) => {
    await settingsStore.mutate((current) => ({ ...current, rules: removeRule(current.rules, asString(payload.key)) }));
    return { ok: true };
  },
  // Revizyon 24'te fırtına bandı kaldırıldı; toplu izin komutunun da UI yüzeyi yok.
  [COMMANDS.BULK_SET_RULE_STATE]: async ({ payload }) => {
    const entries = Array.isArray(payload.entries) ? (payload.entries as Array<{ method: string; path: string }>) : [];
    const state = payload.state === 'block' ? 'block' : 'allow';
    await settingsStore.mutate((current) => ({
      ...current,
      rules: bulkSetRuleState(current.rules, entries, state, 'inventory', Date.now()),
    }));
    return { ok: true };
  },
  [COMMANDS.CLEAR_RULES]: async () => {
    await settingsStore.update({ rules: [] });
    return { ok: true };
  },
  [COMMANDS.ADD_DOMAIN]: addDomain,
  [COMMANDS.REMOVE_DOMAIN]: removeDomain,
  [COMMANDS.ADD_PAGE_HOST]: addPageHost,
  [COMMANDS.REMOVE_PAGE_HOST]: removePageHost,
  [COMMANDS.REQUEST_DOMAIN_PERMISSION]: async ({ payload }) => {
    const id = asString(payload.id);
    const target = settingsStore.get().domains.find((domain) => domain.id === id);
    if (!target) return { ok: false, error: 'not-found' };

    const granted = await hasDomainPermission(target.pattern);
    await settingsStore.mutate((current) => ({
      ...current,
      domains: current.domains.map((domain) => (domain.id === id ? { ...domain, granted } : domain)),
    }));

    return granted ? { ok: true } : { ok: false, error: 'permission-denied' };
  },
  [COMMANDS.SET_FAULT]: async ({ payload }) => {
    const fault = { ...settingsStore.get().fault, ...(payload.fault as object) };
    await settingsStore.update({ fault });
    return { ok: true };
  },
  [COMMANDS.CLEAR_INVENTORY]: ({ tabId, payload }) => {
    const target = tabId ?? asNumber(payload.tabId, -1);
    if (target < 0) return { ok: false, error: 'no-tab' };
    sessionStore.clearInventory(target);
    return { ok: true };
  },
  [COMMANDS.CLEAR_LOGS]: ({ tabId, payload }) => {
    const target = tabId ?? asNumber(payload.tabId, -1);
    if (target < 0) return { ok: false, error: 'no-tab' };
    sessionStore.clearLogs(target, payload.which as 'success' | 'fail' | undefined);
    return { ok: true };
  },
  [COMMANDS.APPLY_PROFILE]: applyProfile,
  // Revizyon 32'de "Kaydet" butonu kaldırıldı; bu komutun şu an UI yüzeyi yok.
  // Profiller yalnızca içe aktarma ile listeye giriyor; mevcut durumu dosyaya
  // dökmek isteyen "Dışa aktar"ı seçimsiz kullanıyor (anlık görüntü).
  [COMMANDS.SAVE_PROFILE]: saveProfile,
  [COMMANDS.DELETE_PROFILE]: async ({ payload }) => {
    const id = asString(payload.id);
    await settingsStore.mutate((current) => ({
      ...current,
      profiles: current.profiles.filter((entry) => entry.id !== id),
      activeProfileId: current.activeProfileId === id ? null : current.activeProfileId,
    }));
    return { ok: true };
  },
  [COMMANDS.IMPORT_PROFILE]: importProfile,
  // Seçili profil **aynen** dışa aktarılır (Revizyon 31): paylaşılan dosya, karşı
  // tarafın içe aktardığı dosyayla birebir aynı olsun. Seçim yoksa mevcut ayarların
  // anlık görüntüsü verilir — o da paylaşılabilir bir kurulumdur.
  [COMMANDS.EXPORT_PROFILE]: ({ payload }) => {
    const current = settingsStore.get();
    const id = asString(payload.id) || current.activeProfileId || '';
    const stored = current.profiles.find((entry) => entry.id === id);

    return {
      ok: true,
      data: buildProfileFile(stored ?? snapshotProfile(current, 'current', translator()('profile.snapshotName'), Date.now())),
    };
  },
  [COMMANDS.EXPORT_REPORT]: exportReport,
  [COMMANDS.UPDATE_SETTINGS]: async ({ payload }) => {
    const patch = payload.settings as Partial<Settings>;
    if (!patch || typeof patch !== 'object') return { ok: false, error: 'invalid-settings' };
    await settingsStore.update(patch);
    if (patch.autoOffMinutes !== undefined && settingsStore.get().enabled) {
      await scheduleAutoOff(settingsStore.get().autoOffMinutes);
    }
    return { ok: true };
  },
  [COMMANDS.DISMISS_NOTICE]: () => {
    settingsStore.clearNotice();
    return { ok: true };
  },
};

const runCommand = async (command: string, ctx: CommandContext): Promise<CommandResult> => {
  const handler = handlers[command];
  if (!handler) return { ok: false, error: 'unknown-command' };

  try {
    return await handler(ctx);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'command-failed' };
  }
};

// -------------------------------------------------------------------- portlar

const handleContentMessage = async (message: unknown, tabId: number): Promise<void> => {
  const data = message as { type?: string; records?: TelemetryRecord[]; dropped?: number; route?: RouteInfo; title?: string };
  if (!data?.type) return;

  await bootstrap();
  const settings = settingsStore.get();

  if (data.type === SW_MESSAGES.TELEMETRY_BATCH) {
    sessionStore.applyTelemetry(tabId, data.records ?? [], data.dropped ?? 0, settings);
    if (settings.enabled) await updateBadge(true, badgeTitle(true, sessionStore.get(tabId)?.blockedSinceLoad ?? 0));
    pushState();
    return;
  }

  if (data.type === SW_MESSAGES.ROUTE_CHANGE && data.route) {
    sessionStore.setRoute(tabId, data.route, asString(data.title), settings);
    pushState();
  }
};

const handleUiMessage = async (message: unknown, port: chrome.runtime.Port): Promise<void> => {
  const data = message as { type?: string; tabId?: number | null; id?: string; command?: string; payload?: Record<string, unknown> };
  if (!data?.type) return;

  await bootstrap();

  if (data.type === 'SUBSCRIBE') {
    const tabId = typeof data.tabId === 'number' ? data.tabId : null;
    setUiPortTab(port, tabId);
    sendStateTo(port, buildState(tabId));
    return;
  }

  if (data.type !== 'COMMAND' || !data.command || !data.id) return;

  const tabId = typeof data.tabId === 'number' ? data.tabId : null;
  const result = await runCommand(data.command, { tabId, payload: data.payload ?? {} });
  replyCommand(port, data.id, result);

  if (result.ok) await applyRuntimeSideEffects();
  else pushState();
};

chrome.runtime.onConnect.addListener((port) => {
  if (isContentPort(port)) {
    const entry = registerContentPort(port);
    if (!entry) return;

    port.onMessage.addListener((message) => {
      void handleContentMessage(message, entry.tabId).catch(() => {});
    });

    void bootstrap().then(() => {
      try {
        port.postMessage({ type: SW_MESSAGES.CONFIG_UPDATED, config: config() });
      } catch {
        // port kopmuş olabilir
      }
    });
    return;
  }

  if (!isUiPort(port)) return;

  registerUiPort(port);
  port.onMessage.addListener((message) => {
    void handleUiMessage(message, port).catch(() => {});
  });
});

// ------------------------------------------------------------ yaşam döngüsü

// Toolbar ikonu doğrudan side panel'i açar; popup yüzeyi yoktur.
// `openPanelOnActionClick` yalnızca manifest'te `action.default_popup` YOKKEN etkilidir.
const enableActionOpensPanel = (): void => {
  void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
};

chrome.runtime.onInstalled.addListener(() => {
  void bootstrap();
  enableActionOpensPanel();
});

chrome.runtime.onStartup.addListener(() => {
  void bootstrap();
  enableActionOpensPanel();
});

// Yedek: panel davranışı bir sebeple uygulanmadıysa onClicked tetiklenir ve
// tıklama gesture'ı içinde paneli elle açarız.
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId === undefined) return;
  void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => sessionStore.remove(tabId));
chrome.tabs.onReplaced.addListener((_added, removed) => sessionStore.remove(removed));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading' || !changeInfo.url) return;
  if (UNSUPPORTED_URL.test(changeInfo.url)) sessionStore.remove(tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_AUTO_OFF) return;
  void (async () => {
    await bootstrap();
    await settingsStore.update({ enabled: false });
    await cancelAutoOff();
    await applyRuntimeSideEffects();
  })();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-simulation') return;
  void (async () => {
    await bootstrap();
    const result = await runCommand(COMMANDS.SET_ENABLED, {
      tabId: null,
      payload: { enabled: !settingsStore.get().enabled, confirmProduction: true },
    });
    if (result.ok) await applyRuntimeSideEffects();
  })();
});

void bootstrap();
enableActionOpensPanel();

export { buildState, runCommand };
