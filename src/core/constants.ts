import type { FaultConfig, HttpMethod, NormalizationRules, Settings } from './types';

export const SCHEMA_VERSION = 3;

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const STORAGE_KEYS = {
  SETTINGS: 'drsim.settings',
  SESSIONS: 'drsim.sessions',
} as const;

export const PORT_NAMES = {
  CONTENT: 'drsim-content',
  UI: 'drsim-ui',
} as const;

export const SCRIPT_IDS = {
  MAIN: 'drsim-main',
  BRIDGE: 'drsim-bridge',
} as const;

export const ALARM_AUTO_OFF = 'drsim-auto-off';

// bridge ⇄ service worker (01-architecture.md §4.2)
export const SW_MESSAGES = {
  CONTENT_READY: 'CONTENT_READY',
  TELEMETRY_BATCH: 'TELEMETRY_BATCH',
  ROUTE_CHANGE: 'ROUTE_CHANGE',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
} as const;

// UI ⇄ service worker (01-architecture.md §4.3)
export const UI_MESSAGES = {
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  COMMAND_RESULT: 'COMMAND_RESULT',
} as const;

export const COMMANDS = {
  SET_ENABLED: 'SET_ENABLED',
  SET_DEFAULT_POLICY: 'SET_DEFAULT_POLICY',
  TOGGLE_RULE_STATE: 'TOGGLE_RULE_STATE',
  SET_RULE_STATE: 'SET_RULE_STATE',
  REMOVE_RULE: 'REMOVE_RULE',
  ADD_MANUAL_ENDPOINT: 'ADD_MANUAL_ENDPOINT',
  BULK_SET_RULE_STATE: 'BULK_SET_RULE_STATE',
  CLEAR_RULES: 'CLEAR_RULES',
  ADD_DOMAIN: 'ADD_DOMAIN',
  REMOVE_DOMAIN: 'REMOVE_DOMAIN',
  ADD_PAGE_HOST: 'ADD_PAGE_HOST',
  REMOVE_PAGE_HOST: 'REMOVE_PAGE_HOST',
  REQUEST_DOMAIN_PERMISSION: 'REQUEST_DOMAIN_PERMISSION',
  SET_FAULT: 'SET_FAULT',
  CLEAR_INVENTORY: 'CLEAR_INVENTORY',
  CLEAR_LOGS: 'CLEAR_LOGS',
  APPLY_PROFILE: 'APPLY_PROFILE',
  SAVE_PROFILE: 'SAVE_PROFILE',
  DELETE_PROFILE: 'DELETE_PROFILE',
  IMPORT_PROFILE: 'IMPORT_PROFILE',
  EXPORT_PROFILE: 'EXPORT_PROFILE',
  EXPORT_REPORT: 'EXPORT_REPORT',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  DISMISS_NOTICE: 'DISMISS_NOTICE',
} as const;

export const SIMULATED_HEADER = 'x-drsim-simulated';

// Interception zamanlaması (01-architecture.md §2.2, §8)
export const CONFIG_READY_TIMEOUT_MS = 1500;
export const TELEMETRY_DEBOUNCE_MS = 50;
export const TELEMETRY_MAX_BATCH = 200;
export const TELEMETRY_MAX_QUEUE = 1000;
export const ROUTE_DEBOUNCE_MS = 100;
export const UI_SNAPSHOT_THROTTLE_MS = 150;
export const SESSION_PERSIST_DEBOUNCE_MS = 500;
export const SETTINGS_WRITE_DEBOUNCE_MS = 200;
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

// Bridge sertleştirme (T-501)
export const MAX_MESSAGE_BYTES = 512 * 1024;
export const MAX_MESSAGES_PER_SECOND = 100;

export const DEFAULT_FAULT: FaultConfig = {
  kind: 'http',
  status: 503,
  statusText: 'Service Unavailable',
  body: '{"message":"DR simulated unavailable"}',
  headers: {},
  delayMs: 0,
  timeoutMs: 30_000,
};

export const DEFAULT_NORMALIZATION: NormalizationRules = {
  numericId: true,
  uuid: true,
  longHex: true,
  customPatterns: [],
};

export const REDACTED_FIELDS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
];

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  enabled: false,
  defaultPolicy: 'block',
  domains: [],
  pageHosts: [],
  rules: [],
  fault: DEFAULT_FAULT,
  normalization: DEFAULT_NORMALIZATION,
  activeProfileId: null,
  profiles: [],
  captureHeaders: false,
  captureBody: false,
  maxLogEntries: 200,
  maxInventoryItems: 500,
  autoOffMinutes: null, // varsayılan kapalı — simülasyon kullanıcı kapatana kadar açık kalır (Revizyon 7)
  productionGuard: true,
  productionHostPatterns: ['*.prod.*', 'www.*', 'api.*.com'],
  keepInventoryOnNavigate: false,
  showPageBanner: true,
  locale: 'tr',
  engine: 'main-world',
};

// Fault tipi seçenekleri (02-ui-spec.md §3.3)
export const FAULT_PRESETS = [
  { id: 'http-503', label: '503 Service Unavailable', kind: 'http', status: 503, statusText: 'Service Unavailable' },
  { id: 'http-500', label: '500 Internal Server Error', kind: 'http', status: 500, statusText: 'Internal Server Error' },
  { id: 'http-429', label: '429 Too Many Requests', kind: 'http', status: 429, statusText: 'Too Many Requests' },
  { id: 'network', label: 'Network error', kind: 'network', status: 0, statusText: '' },
  { id: 'timeout', label: 'Timeout', kind: 'timeout', status: 0, statusText: '' },
] as const;

export const REASON_LABELS: Record<string, string> = {
  disabled: 'simülasyon kapalı',
  'out-of-scope': 'kapsam dışı',
  allowed: 'izinli',
  blocked: 'engel kuralı',
  'default-block': 'izin listesinde yok',
  'default-pass': 'varsayılan',
  'real-error': 'gerçek hata',
  'sync-xhr': 'sync XHR — kapsam dışı',
};
