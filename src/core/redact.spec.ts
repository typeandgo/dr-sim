import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MASK, MAX_HEADER_VALUE_BYTES, redactHeaders, truncate } from './redact';

describe('core/redact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('redactHeaders', () => {
    it('hassas header’ları maskeler, diğerlerini korur', () => {
      expect(
        redactHeaders({ Authorization: 'Bearer abc', Cookie: 'a=1', 'X-Trace-Id': 'trace-1' }),
      ).toEqual({ authorization: MASK, cookie: MASK, 'x-trace-id': 'trace-1' });
    });

    it('ayraçlardan bağımsız eşleşir', () => {
      expect(redactHeaders({ 'X-Api-Key': 'k', refresh_token: 't' })).toEqual({
        'x-api-key': MASK,
        refresh_token: MASK,
      });
    });

    it('özel alan listesi verilebilir', () => {
      expect(redactHeaders({ 'x-trace-id': 'v' }, ['trace'])).toEqual({ 'x-trace-id': MASK });
    });

    it('__proto__ anahtarı düşürülür', () => {
      const headers = JSON.parse('{"__proto__":"x","a":"1"}') as Record<string, string>;
      expect(redactHeaders(headers)).toEqual({ a: '1' });
    });

    it('çok uzun header değeri kırpılır', () => {
      const value = redactHeaders({ 'x-long': 'a'.repeat(MAX_HEADER_VALUE_BYTES + 500) })['x-long'];
      expect(value).toHaveLength(MAX_HEADER_VALUE_BYTES + 1);
      expect(value?.endsWith('…')).toBe(true);
    });
  });

  describe('truncate', () => {
    it('sınır altındaki değeri değiştirmez', () => {
      expect(truncate('kısa', 10)).toBe('kısa');
    });

    // Kırpma işareti dile bağlı olmamalı (Y1): İngilizce arayüzde de aynı görünür
    it('kırpma işareti dilden bağımsızdır', () => {
      expect(truncate('abcdef', 3)).toBe('abc…');
    });
  });
});
