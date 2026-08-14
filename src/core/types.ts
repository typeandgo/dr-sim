import type { LocalePreference } from './i18n';
// Veri modeli — 01-architecture.md §3.
// Not: "Strategy" / "profil bazlı dallanma" kavramı yoktur; tek kural listesi + varsayılan politika.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type RuleState = 'allow' | 'block';

export type RuleSource = 'inventory' | 'manual' | 'preset' | 'quick-allow';

// Tek kural kaydı: bir EP'nin açık durumu. Joker yok, tam eşleşme.
export interface Rule {
  key: string; // `${method} ${normalizedPath}` — birincil anahtar
  method: HttpMethod;
  path: string; // normalize edilmiş: /items/:id/summary
  state: RuleState;
  source: RuleSource;
  note?: string;
  createdAt: number;
}

export type DefaultPolicy = 'block' | 'pass';

// Eklenen her domain doğrudan etkindir (Revizyon 3); ayrı bir aç/kapa durumu yoktur.
// Yalnızca `granted` üç değerlidir: izin verildi / reddedildi / henüz sorulmadı.
export interface DomainScope {
  id: string;
  pattern: string; // api.example.com | *.example.com | api.example.com/gw
  granted?: boolean; // host izni verildi mi
}

export type FaultKind = 'http' | 'network' | 'timeout';

// Global, tek arıza ayarı. Kural bazlı arıza v1'de yok.
export interface FaultConfig {
  kind: FaultKind;
  status: number;
  statusText: string;
  body: string; // JSON string
  headers: Record<string, string>;
  delayMs: number;
  timeoutMs: number;
}

// Profil = kaydedilmiş kural listesi + kapsam. "Strateji" kavramı yoktur.
export interface Profile {
  id: string;
  name: string;
  defaultPolicy: DefaultPolicy;
  domains: DomainScope[];
  rules: Rule[];
  fault: FaultConfig;
  updatedAt: number;
}

export interface NormalizationRules {
  numericId: boolean;
  uuid: boolean;
  longHex: boolean;
  customPatterns: string[];
}

export interface Settings {
  schemaVersion: number;
  enabled: boolean;
  defaultPolicy: DefaultPolicy;
  // Hangi İSTEKLER yönetilir (request URL filtresi)
  domains: DomainScope[];
  // Hangi SAYFALARA enjekte edilir. Ayrı bir eksendir: uygulama panel.example.com'da
  // çalışırken API api.example.com olabilir. Interceptor sayfaya enjekte edilmezse
  // hiçbir istek yakalanamaz — domain listesi tek başına yetmez.
  pageHosts: DomainScope[];
  rules: Rule[];
  fault: FaultConfig;
  normalization: NormalizationRules;
  activeProfileId: string | null;
  profiles: Profile[];
  captureHeaders: boolean;
  maxLogEntries: number;
  maxInventoryItems: number;
  autoOffMinutes: number | null;
  productionGuard: boolean;
  productionHostPatterns: string[];
  keepInventoryOnNavigate: boolean;
  showPageBanner: boolean;
  locale: LocalePreference;
}

export type DecisionReason =
  | 'disabled'
  | 'out-of-scope'
  | 'allowed'
  | 'blocked'
  | 'default-block'
  | 'default-pass'
  | 'real-error'
  // `decide()` üretmez; sync XHR beklenemediği için interceptor pass-through yapar (01 §2.2)
  | 'sync-xhr';

export interface Decision {
  block: boolean;
  reason: DecisionReason;
  key: string;
  method: HttpMethod;
  path: string;
  inScope: boolean;
}

export interface RequestInfo {
  method: string;
  url: string;
}

// MAIN world'ün karar için ihtiyaç duyduğu her şey — SW'de bir kez derlenir (compile-config.ts)
export interface RuntimeConfig {
  enabled: boolean;
  defaultPolicy: DefaultPolicy;
  domains: string[]; // yalnızca etkin ve izinli pattern'ler
  rulesByKey: Record<string, RuleState>;
  fault: FaultConfig;
  normalization: NormalizationRules;
  captureHeaders: boolean;
  showPageBanner: boolean;
  // Banner metni SW'de çevrilir; content script sözlüğü paketlemez (Revizyon 41)
  bannerText: string;
  revision: number;
}

export type RequestOrigin = 'fetch' | 'xhr' | 'manual';

export interface InventoryItem {
  key: string;
  method: HttpMethod;
  path: string;
  sampleUrl: string;
  count: number;
  lastAt: number;
  lastStatus: number | null;
  lastDurationMs: number | null;
  successCount: number;
  failCount: number;
  simulatedCount: number;
  lastReason: DecisionReason;
  origin: RequestOrigin;
  frameId: number;
}

export interface LogEntry {
  id: string;
  at: number;
  method: HttpMethod;
  path: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  outcome: 'success' | 'fail';
  simulated: boolean;
  reason: DecisionReason;
  faultKind?: FaultKind;
  routePath: string;
  frameId: number;
  headers?: Record<string, string>;
}

export interface TabSession {
  tabId: number;
  // Üst çerçevenin belge kimliği. Her sayfa yüklemesinde yenilenir; SW port'u
  // koptuğunda veya SPA gezinmesinde AYNI kalır. Envanter ve logların ne zaman
  // sıfırdan başlayacağını bu ayırır.
  documentId: string;
  origin: string;
  routePath: string;
  title: string;
  inventory: Record<string, InventoryItem>;
  successLog: LogEntry[];
  failLog: LogEntry[];
  outOfScopeCount: number;
  droppedCount: number;
  blockedSinceLoad: number;
  loadedAt: number;
  updatedAt: number;
}

// MAIN world → bridge → SW yönünde taşınan ham kayıt
export interface TelemetryRecord {
  method: string;
  url: string;
  path: string;
  key: string;
  status: number | null;
  durationMs: number | null;
  outcome: 'success' | 'fail';
  simulated: boolean;
  reason: DecisionReason;
  faultKind?: FaultKind;
  origin: RequestOrigin;
  at: number;
  routePath: string;
  headers?: Record<string, string>;
}

export interface RouteInfo {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
}

export interface UiState {
  settings: Settings;
  session: TabSession | null;
  tabId: number | null;
  tabUrl: string;
  supported: boolean;
  autoOffAt: number | null;
  notice: string | null;
  revision: number;
}
