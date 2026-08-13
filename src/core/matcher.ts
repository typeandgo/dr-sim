// Domain scope eşleşmesi — 01-architecture.md §8 (derlenmiş RegExp cache).
// Fail-safe ilke: scope listesi boşsa hiçbir URL kapsamda değildir.

export interface ParsedDomain {
  host: string;
  isWildcard: boolean;
  basePath: string;
}

interface CompiledScope {
  hostRegExp: RegExp;
  basePath: string;
}

const HOST_PATTERN = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/i;

const compiledCache = new Map<string, CompiledScope | null>();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resetScopeCache = (): void => {
  compiledCache.clear();
};

// Kullanıcı girdisini pattern'e çevirir: protokol, boşluk ve sondaki / temizlenir
export const normalizeDomainInput = (input: string): string => {
  const trimmed = String(input ?? '').trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const withoutQuery = withoutProtocol.replace(/[?#].*$/, '');
  return withoutQuery.replace(/\/+$/, '');
};

// `api.example.com/gw` → { host, isWildcard, basePath }. Geçersizse null.
export const parseDomainPattern = (pattern: string): ParsedDomain | null => {
  const normalized = normalizeDomainInput(pattern);
  if (!normalized) return null;

  const slashIndex = normalized.indexOf('/');
  const host = slashIndex === -1 ? normalized : normalized.slice(0, slashIndex);
  const basePath = slashIndex === -1 ? '' : normalized.slice(slashIndex);

  if (!HOST_PATTERN.test(host)) return null;
  if (basePath && !/^\/[\w\-./:%]*$/.test(basePath)) return null;

  return {
    host,
    isWildcard: host.startsWith('*.'),
    basePath: basePath.replace(/\/+$/, ''),
  };
};

// Kullanıcıya gösterilecek doğrulama sonucu
export const validateDomainPattern = (
  pattern: string,
): { ok: true; pattern: string } | { ok: false; error: string } => {
  const normalized = normalizeDomainInput(pattern);
  if (!normalized) return { ok: false, error: 'Domain boş olamaz.' };

  const parsed = parseDomainPattern(normalized);
  if (!parsed) return { ok: false, error: 'Geçersiz domain. Örnek: api.example.com veya *.example.com/gw' };

  return { ok: true, pattern: normalized };
};

const compileScope = (pattern: string): CompiledScope | null => {
  if (compiledCache.has(pattern)) return compiledCache.get(pattern) ?? null;

  const parsed = parseDomainPattern(pattern);
  let compiled: CompiledScope | null = null;

  if (parsed) {
    const bareHost = parsed.isWildcard ? parsed.host.slice(2) : parsed.host;
    const source = parsed.isWildcard
      ? `^(?:[a-z0-9_-]+\\.)*${escapeRegExp(bareHost)}$`
      : `^${escapeRegExp(bareHost)}$`;
    compiled = { hostRegExp: new RegExp(source, 'i'), basePath: parsed.basePath };
  }

  compiledCache.set(pattern, compiled);
  return compiled;
};

// Aynı pattern için her zaman aynı derlenmiş nesneyi döner (cache doğrulaması bunun üzerinden yapılır)
export const getCompiledScope = (pattern: string): CompiledScope | null => compileScope(pattern);

// Chrome match pattern'leri port KABUL ETMEZ; `localhost:5175` → `*://localhost/*`.
// Kapsam eşleşmesi (isInScope) portu korur, yalnızca izin/enjeksiyon pattern'i portsuzdur.
const withoutPort = (host: string): string => host.replace(/:\d+$/, '');

// `chrome.permissions` için origin pattern'i üretir
export const toOriginPattern = (pattern: string): string | null => {
  const parsed = parseDomainPattern(pattern);
  if (!parsed) return null;
  return `*://${withoutPort(parsed.host)}/*`;
};

// `chrome.scripting` match pattern'i üretir
export const toMatchPattern = (pattern: string): string | null => toOriginPattern(pattern);

const matchesScope = (host: string, pathname: string, scope: CompiledScope): boolean => {
  if (!scope.hostRegExp.test(host)) return false;
  if (!scope.basePath) return true;
  return pathname === scope.basePath || pathname.startsWith(`${scope.basePath}/`);
};

// URL, verilen scope listesinden herhangi biriyle eşleşiyor mu?
export const isInScope = (url: string, patterns: string[]): boolean => {
  if (!patterns.length) return false;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;

  return patterns.some((pattern) => {
    const scope = compileScope(pattern);
    return scope ? matchesScope(parsedUrl.host, parsedUrl.pathname, scope) : false;
  });
};
