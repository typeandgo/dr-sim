import { REDACTED_FIELDS } from './constants';

// Gizlilik — 04-test-release-security.md §4.3. Yakalama varsayılan kapalıdır;
// açıldığında bu modülden geçmeden hiçbir header/body kaydedilmez.

export const MASK = '***';
export const MAX_BODY_BYTES = 32 * 1024;
const CIRCULAR = '[circular]';
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isSensitive = (key: string, fields: string[]): boolean => {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return fields.some((field) => normalized.includes(field.toLowerCase().replace(/[-_\s]/g, '')));
};

export const truncate = (value: string, maxBytes = MAX_BODY_BYTES): string => (value.length > maxBytes ? `${value.slice(0, maxBytes)}…[kırpıldı]` : value);

// Derin obje/dizi taraması; döngüsel referansta güvenle durur.
export const redactValue = (value: unknown, fields: string[] = REDACTED_FIELDS, seen = new WeakSet<object>()): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return CIRCULAR;
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((item) => redactValue(item, fields, seen));

  const result: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (DANGEROUS_KEYS.has(key)) return;
    result[key] = isSensitive(key, fields) ? MASK : redactValue(item, fields, seen);
  });

  return result;
};

export const redactHeaders = (
  headers: Record<string, string>,
  fields: string[] = REDACTED_FIELDS,
): Record<string, string> => {
  const result: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (DANGEROUS_KEYS.has(key)) return;
    result[key.toLowerCase()] = isSensitive(key, fields) ? MASK : truncate(String(value), 1024);
  });
  return result;
};

// JSON gövdeyi maskeler; JSON değilse yalnızca boyut sınırı uygulanır.
export const redactBody = (body: string, fields: string[] = REDACTED_FIELDS): string => {
  const limited = truncate(body);

  try {
    const parsed: unknown = JSON.parse(body);
    return JSON.stringify(redactValue(parsed, fields));
  } catch {
    return limited;
  }
};
