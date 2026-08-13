import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MESSAGE_TYPES,
  byteLength,
  createRateLimiter,
  sanitizeKeys,
  validateInboundMessage,
} from './message.schema';

const TOKEN = 'tok-1';

const baseRecord: Record<string, unknown> = {
  method: 'GET',
  url: 'https://api.x.com/a',
  path: '/a',
  key: 'GET /a',
  at: 1,
  outcome: 'fail',
  reason: 'default-block',
  origin: 'fetch',
  status: 503,
  durationMs: 3,
  simulated: true,
  routePath: '/home',
};

const telemetry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  __drsim: TOKEN,
  type: MESSAGE_TYPES.TELEMETRY,
  records: [{ ...baseRecord }],
  ...over,
});

describe('core/message.schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateInboundMessage', () => {
    it('geçerli telemetri mesajını kabul eder', () => {
      const result = validateInboundMessage(telemetry(), TOKEN);
      expect(result).toMatchObject({ type: MESSAGE_TYPES.TELEMETRY, dropped: 0 });
      expect(result && 'records' in result && result.records).toHaveLength(1);
    });

    it('token yoksa reddeder (sayfa sahte telemetri gönderemez)', () => {
      expect(validateInboundMessage({ ...telemetry(), __drsim: 'wrong' }, TOKEN)).toBeNull();
    });

    it.each([
      ['obje olmayan', 'string'],
      ['null', null],
      ['tip whitelist dışı', { __drsim: TOKEN, type: 'DRSIM_EVIL' }],
      ['tipi eksik', { __drsim: TOKEN }],
      ['records dizi değil', { __drsim: TOKEN, type: MESSAGE_TYPES.TELEMETRY, records: {} }],
      ['route bozuk', { __drsim: TOKEN, type: MESSAGE_TYPES.ROUTE, route: { origin: 1 } }],
      ['route eksik', { __drsim: TOKEN, type: MESSAGE_TYPES.ROUTE }],
      ['href eksik', { __drsim: TOKEN, type: MESSAGE_TYPES.READY }],
    ])('%s mesajı reddedilir', (_name, payload) => {
      expect(validateInboundMessage(payload, TOKEN)).toBeNull();
    });

    it('boyut limitini aşan mesajı reddeder', () => {
      const big = telemetry({
        records: Array.from({ length: 500 }, () => ({ ...baseRecord, url: 'u'.repeat(4000) })),
      });
      expect(validateInboundMessage(big, TOKEN)).toBeNull();
    });

    it('şemaya uymayan kayıtları sessizce düşürür', () => {
      const result = validateInboundMessage(
        telemetry({ records: [{ method: 'GET' }, 'string-kayıt', null, { ...baseRecord }] }),
        TOKEN,
      );
      expect(result && 'records' in result && result.records).toHaveLength(1);
    });

    it('routePath eksikse köke düşer', () => {
      const rest = { ...baseRecord };
      delete rest.routePath;
      const result = validateInboundMessage(telemetry({ records: [rest] }), TOKEN);
      expect(result && 'records' in result && result.records[0]?.routePath).toBe('/');
    });

    it('opsiyonel alanları taşır', () => {
      const result = validateInboundMessage(
        telemetry({
          records: [{ ...baseRecord, faultKind: 'http', headers: { a: 'b' }, body: 'x' }],
        }),
        TOKEN,
      );
      expect(result && 'records' in result && result.records[0]).toMatchObject({
        faultKind: 'http',
        headers: { a: 'b' },
        body: 'x',
      });
    });

    it('geçersiz faultKind taşınmaz', () => {
      const result = validateInboundMessage(
        telemetry({ records: [{ ...baseRecord, faultKind: 'evil' }] }),
        TOKEN,
      );
      expect(result && 'records' in result && result.records[0]?.faultKind).toBeUndefined();
    });

    it('READY ve ROUTE mesajlarını kabul eder', () => {
      expect(validateInboundMessage({ __drsim: TOKEN, type: MESSAGE_TYPES.READY, href: 'https://x' }, TOKEN))
        .toMatchObject({ type: MESSAGE_TYPES.READY });
      expect(
        validateInboundMessage(
          { __drsim: TOKEN, type: MESSAGE_TYPES.ROUTE, route: { origin: 'https://x', pathname: '/a' } },
          TOKEN,
        ),
      ).toMatchObject({ type: MESSAGE_TYPES.ROUTE, route: { pathname: '/a', search: '', hash: '' } });
    });

    it('10.000 rastgele mesajda exception atmaz', () => {
      const shapes: unknown[] = [null, 0, 'x', [], {}, { type: 1 }, { __drsim: TOKEN, type: MESSAGE_TYPES.TELEMETRY }];
      for (let i = 0; i < 10_000; i += 1) {
        expect(() => validateInboundMessage(shapes[i % shapes.length], TOKEN)).not.toThrow();
      }
    });
  });

  describe('sanitizeKeys', () => {
    it('tehlikeli anahtarları düşürür', () => {
      const payload = JSON.parse('{"__proto__":{"admin":true},"ok":1}') as unknown;
      expect(sanitizeKeys(payload)).toEqual({ ok: 1 });
    });

    it('derinlik sınırında değeri olduğu gibi döner', () => {
      const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } };
      expect(() => sanitizeKeys(deep)).not.toThrow();
    });

    it('skaler değerleri değiştirmez', () => {
      expect(sanitizeKeys('x')).toBe('x');
    });

    it('dizileri gezer ve 500 öğeyle sınırlar', () => {
      expect(sanitizeKeys([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
      expect(sanitizeKeys(Array.from({ length: 600 }, (_unused, i) => i))).toHaveLength(500);
    });
  });

  describe('byteLength', () => {
    it('serileştirilemeyen değerde üst sınır döner', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(byteLength(circular)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('normal değerde uzunluk döner', () => {
      expect(byteLength({ a: 1 })).toBe(7);
    });

    it('undefined için 0 döner', () => {
      expect(byteLength(undefined)).toBe(0);
    });
  });

  describe('createRateLimiter', () => {
    it('limit aşılınca false döner ve pencere yenilenince sıfırlanır', () => {
      const allow = createRateLimiter(2);
      expect(allow(1000)).toBe(true);
      expect(allow(1001)).toBe(true);
      expect(allow(1002)).toBe(false);
      expect(allow(2100)).toBe(true);
    });
  });
});
