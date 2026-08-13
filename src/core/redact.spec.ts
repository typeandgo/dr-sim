import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MASK, MAX_BODY_BYTES, redactBody, redactHeaders, redactValue, truncate } from './redact';

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
      expect(redactHeaders({ 'x-long': 'a'.repeat(2000) })['x-long']).toContain('[kırpıldı]');
    });
  });

  describe('redactValue', () => {
    it('iç içe objelerde hassas alanları maskeler', () => {
      expect(redactValue({ user: { password: 'p', name: 'ada' } })).toEqual({
        user: { password: MASK, name: 'ada' },
      });
    });

    it('dizileri gezer', () => {
      expect(redactValue([{ token: 't' }, { id: 1 }])).toEqual([{ token: MASK }, { id: 1 }]);
    });

    it('döngüsel referansta sonsuz döngüye girmez', () => {
      const node: Record<string, unknown> = { name: 'root' };
      node.self = node;
      expect(redactValue(node)).toEqual({ name: 'root', self: '[circular]' });
    });

    it.each([
      [null, null],
      ['metin', 'metin'],
      [42, 42],
    ])('skaler değer (%s) değişmez', (input, expected) => {
      expect(redactValue(input)).toBe(expected);
    });

    it('tehlikeli anahtarları düşürür', () => {
      const payload = JSON.parse('{"__proto__":{"admin":true},"ok":1}') as unknown;
      expect(redactValue(payload)).toEqual({ ok: 1 });
    });
  });

  describe('redactBody', () => {
    it('JSON gövdede hassas alanları maskeler', () => {
      expect(redactBody('{"accessToken":"a","q":"b"}')).toBe('{"accessToken":"***","q":"b"}');
    });

    it('JSON olmayan gövdeyi olduğu gibi döner', () => {
      expect(redactBody('plain body')).toBe('plain body');
    });

    it('JSON olmayan uzun gövdeyi kırpar', () => {
      expect(redactBody('x'.repeat(MAX_BODY_BYTES + 10))).toContain('[kırpıldı]');
    });
  });

  describe('truncate', () => {
    it('sınır altındaki değeri değiştirmez', () => {
      expect(truncate('kısa', 10)).toBe('kısa');
    });
  });
});
