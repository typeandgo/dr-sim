import type { FaultConfig, Settings } from '@/core/types';

// Varsayılan politika metinleri — panel (kısa durum satırı) ve Ayarlar (detaylı özet)
// aynı kaynaktan beslensin diye tek yerde tutulur (Revizyon 19).

export const faultLabel = (fault: FaultConfig): string => {
  if (fault.kind === 'network') return 'network error';
  if (fault.kind === 'timeout') return `${Math.round(fault.timeoutMs / 1000)} sn sonra timeout`;
  return String(fault.status);
};

// Ayarlar'daki arıza seçicisinin FAULT_PRESETS.id karşılığı (Revizyon 23)
export const faultPresetId = (fault: FaultConfig): string => {
  if (fault.kind === 'network') return 'network';
  if (fault.kind === 'timeout') return 'timeout';
  return `http-${fault.status}`;
};

const ruleCounts = (settings: Settings): { total: number; allow: number; block: number } => ({
  total: settings.rules.length,
  allow: settings.rules.filter((rule) => rule.state === 'allow').length,
  block: settings.rules.filter((rule) => rule.state === 'block').length,
});

// Panelde görünen tek satır: ne olduğu + kural sayısı
export const policyStatusLine = (settings: Settings): string => {
  const { total } = ruleCounts(settings);
  const behaviour = settings.defaultPolicy === 'block'
    ? `Kural yazılmayan EP'ler bloklanıyor (${faultLabel(settings.fault)})`
    : "Kural yazılmayan EP'ler geçiyor";

  return `${behaviour} · ${total} kural`;
};

// Ayarlar sayfasındaki detaylı özet
export const policySummary = (settings: Settings): string => {
  const { total, allow, block } = ruleCounts(settings);
  const breakdown = total
    ? `${total} EP'ye kural yazılmış (${allow} izinli · ${block} engelli).`
    : 'Henüz hiçbir EP’ye kural yazılmamış.';

  return settings.defaultPolicy === 'block'
    ? `${breakdown} Domaine giden diğer tüm istekler ${faultLabel(settings.fault)} dönecek.`
    : `${breakdown} Diğer tüm istekler normal çalışacak.`;
};
