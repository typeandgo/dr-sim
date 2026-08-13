import { MAX_MESSAGE_BYTES, MAX_MESSAGES_PER_SECOND } from './constants';
import type { DecisionReason, RequestOrigin, RouteInfo, TelemetryRecord } from './types';

// Bridge sertleştirme — 04-test-release-security.md §4.1.
// Sayfadan gelen hiçbir veriye güvenilmez: tip whitelist'i + şema doğrulaması +
// prototype pollution filtresi + boyut ve hız limiti.

export const MESSAGE_TYPES = {
  READY: 'DRSIM_READY',
  TELEMETRY: 'DRSIM_TELEMETRY',
  ROUTE: 'DRSIM_ROUTE',
  INIT: 'DRSIM_INIT',
  CONFIG: 'DRSIM_CONFIG',
} as const;

const INBOUND_TYPES: string[] = [MESSAGE_TYPES.READY, MESSAGE_TYPES.TELEMETRY, MESSAGE_TYPES.ROUTE];
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const REASONS: DecisionReason[] = [
  'disabled',
  'out-of-scope',
  'allowed',
  'blocked',
  'default-block',
  'default-pass',
  'real-error',
  'sync-xhr',
];
const ORIGINS: RequestOrigin[] = ['fetch', 'xhr', 'manual'];

export type InboundMessage =
  | { type: typeof MESSAGE_TYPES.READY; href: string }
  | { type: typeof MESSAGE_TYPES.TELEMETRY; records: TelemetryRecord[]; dropped: number }
  | { type: typeof MESSAGE_TYPES.ROUTE; route: RouteInfo };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown, max = 2048): string | null => (typeof value === 'string' && value.length <= max ? value : null);

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// Prototype pollution koruması: tehlikeli anahtarlar derinlemesine düşürülür.
export const sanitizeKeys = (value: unknown, depth = 0): unknown => {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizeKeys(item, depth + 1));

  const clean: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  Object.keys(value as Record<string, unknown>).forEach((key) => {
    if (DANGEROUS_KEYS.has(key)) return;
    clean[key] = sanitizeKeys((value as Record<string, unknown>)[key], depth + 1);
  });
  return clean;
};

export const byteLength = (value: unknown): number => {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const parseTelemetryRecord = (raw: unknown): TelemetryRecord | null => {
  if (!isRecord(raw)) return null;

  const method = str(raw.method, 16);
  const url = str(raw.url, 4096);
  const path = str(raw.path, 2048);
  const key = str(raw.key, 2100);
  const at = num(raw.at);
  const outcome = raw.outcome === 'success' || raw.outcome === 'fail' ? raw.outcome : null;
  const reason = REASONS.includes(raw.reason as DecisionReason) ? (raw.reason as DecisionReason) : null;
  const origin = ORIGINS.includes(raw.origin as RequestOrigin) ? (raw.origin as RequestOrigin) : null;

  if (!method || !url || !path || !key || at === null || !outcome || !reason || !origin) return null;

  const record: TelemetryRecord = {
    method,
    url,
    path,
    key,
    at,
    outcome,
    reason,
    origin,
    status: num(raw.status),
    durationMs: num(raw.durationMs),
    simulated: raw.simulated === true,
    routePath: str(raw.routePath, 2048) ?? '/',
  };

  if (raw.faultKind === 'http' || raw.faultKind === 'network' || raw.faultKind === 'timeout') {
    record.faultKind = raw.faultKind;
  }
  if (isRecord(raw.headers)) record.headers = sanitizeKeys(raw.headers) as Record<string, string>;

  return record;
};

const parseRoute = (raw: unknown): RouteInfo | null => {
  if (!isRecord(raw)) return null;
  const origin = str(raw.origin, 512);
  const pathname = str(raw.pathname, 2048);
  if (origin === null || pathname === null) return null;
  return { origin, pathname, search: str(raw.search, 2048) ?? '', hash: str(raw.hash, 512) ?? '' };
};

// Sayfadan (MAIN world) gelen mesajı doğrular; uymuyorsa sessizce null döner.
export const validateInboundMessage = (data: unknown, token: string): InboundMessage | null => {
  if (!isRecord(data)) return null;
  if (typeof data.__drsim !== 'string' || data.__drsim !== token) return null;
  if (typeof data.type !== 'string' || !INBOUND_TYPES.includes(data.type)) return null;
  if (byteLength(data) > MAX_MESSAGE_BYTES) return null;

  if (data.type === MESSAGE_TYPES.READY) {
    const href = str(data.href, 4096);
    return href === null ? null : { type: MESSAGE_TYPES.READY, href };
  }

  if (data.type === MESSAGE_TYPES.ROUTE) {
    const route = parseRoute(data.route);
    return route === null ? null : { type: MESSAGE_TYPES.ROUTE, route };
  }

  if (!Array.isArray(data.records)) return null;
  const records = data.records
    .slice(0, 500)
    .map(parseTelemetryRecord)
    .filter((record): record is TelemetryRecord => record !== null);

  return { type: MESSAGE_TYPES.TELEMETRY, records, dropped: num(data.dropped) ?? 0 };
};

// Saniyede en fazla N mesaj; taşan mesajlar düşürülür.
export const createRateLimiter = (maxPerSecond = MAX_MESSAGES_PER_SECOND) => {
  let windowStart = 0;
  let count = 0;

  return (now: number): boolean => {
    if (now - windowStart >= 1000) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= maxPerSecond;
  };
};
