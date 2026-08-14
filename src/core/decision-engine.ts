import { isInScope } from './matcher';
import { normalizeMethod, normalizePath } from './path.util';
import type { Decision, RequestInfo, RuntimeConfig } from './types';

// Karar motoru — 01-architecture.md §2.3.
//
// KRİTİK SÖZLEŞME: allow/block önceliği hesaplayan bir dal YOKTUR. Her EP'nin
// tek bir durumu vardır; kayıt yoksa varsayılan politika uygulanır. Bu dosyaya
// öncelik/çakışma mantığı eklenmesi tasarım ihlalidir.
//
// Sıralama notu: kapsam kontrolü `enabled` kontrolünden önce gelir. Gözlem ve
// simülasyon ayrıdır (§2.3): kapsam dışı istek hiç kaydedilmez, simülasyon
// kapalıyken kapsamdaki istek kaydedilir ama bloklanmaz.
//
// Bir EP = bir PATH'tir. Method eşleşmeye girmez; /orders için yazılan kural
// GET, POST ve DELETE için aynı anda geçerlidir.
export const decide = (req: RequestInfo, config: RuntimeConfig): Decision => {
  const method = normalizeMethod(req.method);
  const path = normalizePath(req.url, config.normalization);
  const key = `${method} ${path}`;
  const base = { key, method, path };

  if (!isInScope(req.url, config.domains)) {
    return { ...base, block: false, reason: 'out-of-scope', inScope: false };
  }

  if (!config.enabled) {
    return { ...base, block: false, reason: 'disabled', inScope: true };
  }

  // Lookup PATH ile yapılır (Revizyon 59): method karara girmez. `key` yalnızca
  // gözlem tarafı için üretilir — envanter satırı, loglar ve rapor method'u
  // göstermeye devam ediyor.
  const state = config.rulesByKey[path];

  if (state === 'allow') return { ...base, block: false, reason: 'allowed', inScope: true };
  if (state === 'block') return { ...base, block: true, reason: 'blocked', inScope: true };

  return config.defaultPolicy === 'block'
    ? { ...base, block: true, reason: 'default-block', inScope: true }
    : { ...base, block: false, reason: 'default-pass', inScope: true };
};

// Kapsamdaki her istek envantere/loglara yazılır; kapsam dışı hiç yazılmaz.
export const shouldRecord = (decision: Decision): boolean => decision.inScope;

// Toggle semantiği: efektif durumun tersini yazar (01-architecture.md §4.3).
// Kayıt yokken `block` politikada `allow`, `pass` politikada `block` üretir.
export const nextRuleState = (
  current: 'allow' | 'block' | undefined,
  defaultPolicy: RuntimeConfig['defaultPolicy'],
): 'allow' | 'block' => {
  if (current === 'allow') return 'block';
  if (current === 'block') return 'allow';
  return defaultPolicy === 'block' ? 'allow' : 'block';
};

// Bir EP'nin, açık kaydı yokken varsayılan politikaya göre efektif durumu
export const effectiveState = (
  current: 'allow' | 'block' | undefined,
  defaultPolicy: RuntimeConfig['defaultPolicy'],
): 'allow' | 'block' => current ?? (defaultPolicy === 'block' ? 'block' : 'allow');
