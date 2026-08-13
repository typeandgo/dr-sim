import type { Profile, Settings } from './types';

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

// Dosya adı profil adını taşır: paylaşılan dosyada hangi kurulum olduğu belli olsun
export const profileFileName = (profile: Profile): string => `dr-sim-profil-${slugify(profile.name) || 'adsiz'}`;

export const buildProfileFile = (profile: Profile): ProfileFile => ({
  content: JSON.stringify(profile, null, 2),
  extension: 'json',
  name: profileFileName(profile),
});

// Mevcut ayarların anlık görüntüsü — "Kaydet" ve seçili profil yokken "Dışa aktar"
// aynı yerden beslenir, iki yüzeyin içeriği ayrışamaz.
export const snapshotProfile = (settings: Settings, id: string, name: string, now: number): Profile => ({
  id,
  name,
  defaultPolicy: settings.defaultPolicy,
  domains: settings.domains,
  rules: settings.rules,
  fault: settings.fault,
  updatedAt: now,
});
