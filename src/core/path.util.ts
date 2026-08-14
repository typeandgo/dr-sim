import { DEFAULT_NORMALIZATION } from './constants';
import type { HttpMethod, NormalizationRules } from './types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_PATTERN = /^\d+$/;
const LONG_HEX_PATTERN = /^[0-9a-f]{8,}$/i;

const customRegexCache = new Map<string, RegExp | null>();

// Kullanıcı regex'ini derler; geçersizse null döner ve segment ham kalır (fail-safe)
const compileCustom = (source: string): RegExp | null => {
  if (customRegexCache.has(source)) return customRegexCache.get(source) ?? null;

  let compiled: RegExp | null = null;
  try {
    compiled = new RegExp(source);
  } catch {
    compiled = null;
  }

  customRegexCache.set(source, compiled);
  return compiled;
};

export const resetPathCaches = (): void => {
  customRegexCache.clear();
};

// URL'den pathname çıkarır (query, hash ve origin temizlenir)
export const extractPathname = (url = ''): string => {
  if (!url) return '/';

  let pathname = String(url).replace(/[?#].*$/, '');

  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      // geçersiz absolute URL durumunda ham path ile devam et
    }
  }

  if (!pathname) return '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  return pathname;
};

// Bir segmentin dinamik id olup olmadığını kurallara göre belirler
const isDynamicSegment = (segment: string, rules: NormalizationRules): boolean => {
  if (rules.numericId && NUMERIC_PATTERN.test(segment)) return true;
  if (rules.uuid && UUID_PATTERN.test(segment)) return true;
  if (rules.longHex && LONG_HEX_PATTERN.test(segment)) return true;

  return rules.customPatterns.some((source) => compileCustom(source)?.test(segment) ?? false);
};

// Dinamik segmentleri :id ile normalize eder (envanter/kural anahtarı için)
export const normalizePath = (url = '', rules: NormalizationRules = DEFAULT_NORMALIZATION): string => {
  const pathname = extractPathname(url);

  return pathname
    .split('/')
    .map((segment, index) => {
      if (index === 0 || segment === '') return segment;
      if (segment === ':id') return segment;
      return isDynamicSegment(segment, rules) ? ':id' : segment;
    })
    .join('/');
};

// Method'u normalize eder; bilinmeyen değer büyük harfe çevrilir
export const normalizeMethod = (method = 'GET'): HttpMethod => String(method || 'GET').toUpperCase() as HttpMethod;
