import { toOriginPattern } from '@/core/matcher';

// `chrome.permissions.request()` YALNIZCA kullanıcı hareketi bağlamında çalışır.
// Service worker'da gesture yoktur; oradan çağrılırsa Chrome
// "This function must be called during a user gesture" ile fırlatır ve izin
// dialogu hiç açılmaz. Bu yüzden istek her zaman UI'daki tıklama handler'ından,
// await zincirine girmeden ÖNCE yapılır.
export const requestOriginPermission = async (pattern: string): Promise<boolean> => requestOriginPermissions([pattern]);

// Birden fazla origin tek dialogda istenir: domain eklerken hem API host'u hem de
// aktif sayfanın host'u aynı anda sorulur, kullanıcı iki ayrı adıma zorlanmaz.
export const requestOriginPermissions = async (patterns: string[]): Promise<boolean> => {
  const origins = [...new Set(
    patterns.map(toOriginPattern).filter((origin): origin is string => origin !== null),
  )];
  if (!origins.length) return false;

  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
};

export const hasOriginPermission = async (pattern: string): Promise<boolean> => {
  const origin = toOriginPattern(pattern);
  if (!origin) return false;

  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
};
