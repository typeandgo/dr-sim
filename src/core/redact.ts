import { REDACTED_FIELDS } from './constants';

// Gizlilik. Yakalama varsayılan kapalıdır;
// açıldığında bu modülden geçmeden hiçbir header kaydedilmez.
//
// Gövde yakalama üründen kaldırıldı: interceptor hiçbir zaman gövde toplamıyordu,
// `captureBody` ayarı da olmayan bir yeteneği var gösteren ölü bir anahtardı.
// Geriye yalnızca gerçekten çalışan header yolu kaldı.

export const MASK = '***';
export const MAX_HEADER_VALUE_BYTES = 1024;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isSensitive = (key: string, fields: string[]): boolean => {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return fields.some((field) => normalized.includes(field.toLowerCase().replace(/[-_\s]/g, '')));
};

// Kırpma işareti dilden bağımsız tutulur: bu değer hem panelde hem raporda,
// kullanıcının seçtiği dilden bağımsız olarak görünebilir.
export const truncate = (value: string, maxBytes = MAX_HEADER_VALUE_BYTES): string => (value.length > maxBytes ? `${value.slice(0, maxBytes)}…` : value);

export const redactHeaders = (
  headers: Record<string, string>,
  fields: string[] = REDACTED_FIELDS,
): Record<string, string> => {
  const result: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (DANGEROUS_KEYS.has(key)) return;
    result[key.toLowerCase()] = isSensitive(key, fields) ? MASK : truncate(String(value));
  });
  return result;
};
