import type { Translate } from '@/core/i18n';
import type { FaultConfig, Settings } from '@/core/types';

// Varsayılan politika metinleri — panel (kısa durum satırı) ve Ayarlar (detaylı özet)
// aynı kaynaktan beslensin diye tek yerde tutulur (Revizyon 19).

export const faultLabel = (fault: FaultConfig, t: Translate): string => {
  if (fault.kind === 'network') return t('fault.networkError');
  if (fault.kind === 'timeout') return t('fault.timeout', { seconds: Math.round(fault.timeoutMs / 1000) });
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
export const policyStatusLine = (settings: Settings, t: Translate): string => {
  const { total } = ruleCounts(settings);
  const behaviour = settings.defaultPolicy === 'block'
    ? t('policy.statusBlock', { fault: faultLabel(settings.fault, t) })
    : t('policy.statusPass');

  return `${behaviour} · ${t('policy.ruleCount', { count: total })}`;
};

// Ayarlar sayfasındaki detaylı özet
export const policySummary = (settings: Settings, t: Translate): string => {
  const { total, allow, block } = ruleCounts(settings);
  const breakdown = total
    ? t('policy.summaryRules', { total, allow, block })
    : t('policy.summaryNoRules');

  return settings.defaultPolicy === 'block'
    ? t('policy.summaryBlock', { breakdown, fault: faultLabel(settings.fault, t) })
    : t('policy.summaryPass', { breakdown });
};
