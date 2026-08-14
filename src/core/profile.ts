import type { Translate } from './i18n';
import { resolveConflict, validateRulePath } from './rules';
import type { Profile, Rule, RuleState, Settings } from './types';

// Profil = paylaşılabilir DR kurulumu: kural listesi + domainler + varsayılan politika + arıza.
// Anlık görüntü üretimi ve dosya kimliği burada; SW yalnızca hangi profilin
// dışa aktarılacağına karar verir (Revizyon 31).

export interface ProfileFile {
  content: string;
  extension: string;
  name: string;
}

// Türkçe karakterler dosya adında sorun çıkarmasın: "Ödeme kapalı" → "odeme-kapali"
const TR: ReadonlyArray<readonly [string, string]> = [
  ['ç', 'c'], ['ğ', 'g'], ['ı', 'i'], ['ö', 'o'], ['ş', 's'], ['ü', 'u'],
];

export const slugify = (value: string): string => TR
  .reduce((acc, [from, to]) => acc.replaceAll(from, to), value.toLowerCase())
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40);

// Dosya adı profil adını taşır: paylaşılan dosyada hangi kurulum olduğu belli olsun.
// Ön ek ve yedek ad sözlükten gelir — İngilizce arayüzde Türkçe dosya adı inmesin.
export const profileFileName = (profile: Profile, t: Translate): string => `${t('file.profile')}-${slugify(profile.name) || t('file.untitled')}`;

// Dosyaya yazılan biçim: yerel defter alanları (`id`, `updatedAt`) ayıklanır. Nesne
// açıkça kurulur — destructuring ile ayıklamak `ignoreRestSiblings` kapalıyken lint'i
// kırar, ayrıca alan sırasını sabitler: aynı profil her dışa aktarımda byte-byte aynı çıkar.
export const buildProfileFile = (profile: Profile, t: Translate): ProfileFile => ({
  content: JSON.stringify({
    name: profile.name,
    defaultPolicy: profile.defaultPolicy,
    domains: profile.domains,
    allow: profile.allow,
    block: profile.block,
    fault: profile.fault,
  }, null, 2),
  extension: 'json',
  name: profileFileName(profile, t),
});

// Mevcut ayarların anlık görüntüsü — "Kaydet" ve seçili profil yokken "Dışa aktar"
// aynı yerden beslenir, iki yüzeyin içeriği ayrışamaz.
export const snapshotProfile = (settings: Settings, id: string, name: string, now: number): Profile => ({
  id,
  name,
  defaultPolicy: settings.defaultPolicy,
  domains: settings.domains.map((domain) => domain.pattern),
  allow: settings.rules.filter((rule) => rule.state === 'allow').map((rule) => rule.path),
  block: settings.rules.filter((rule) => rule.state === 'block').map((rule) => rule.path),
  fault: settings.fault,
  updatedAt: now,
});

// Profil listeleri kural listesine çevrilir. Bir path iki listede birden geçerse
// `resolveConflict` karar verir — block kazanır.
export const profileToRules = (profile: Profile, now: number): Rule[] => {
  const merged = new Map<string, RuleState>();

  const add = (paths: string[], state: RuleState): void => paths.forEach((raw) => {
    const validation = validateRulePath(raw);
    if (!validation.ok) return;
    const existing = merged.get(validation.path);
    merged.set(validation.path, existing === undefined ? state : resolveConflict(existing, state));
  });

  // Listeler savunmacı okunur: göçü kaçırmış eski bir kayıt (v4 profili
  // `rules[]` taşırdı) buraya kadar gelirse boş liste gibi davranır. Alternatifi
  // ham bir TypeError'ın panelde İngilizce metin olarak görünmesiydi.
  add(profile.allow, 'allow');
  add(profile.block, 'block');

  return [...merged].map(([path, state]) => ({ path, state, createdAt: now }));
};
