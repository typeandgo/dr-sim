import type { Translate } from '@/core/i18n';
import type { FaultConfig, Settings } from '@/core/types';

// Politika ve arıza metinleri. Revizyon 44'te Ayarlar'daki detaylı özet kaldırıldı
// (politika anahtarı panele döndü, özetin kırılımı Kurallar bölümünde zaten var);
// geriye paneldeki durum satırı ile arıza etiketleri kaldı.

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

// Panelde görünen tek satır: ne olduğu + kural sayısı
export const policyStatusLine = (settings: Settings, t: Translate): string => {
  const total = settings.rules.length;
  const behaviour = settings.defaultPolicy === 'block'
    ? t('policy.statusBlock', { fault: faultLabel(settings.fault, t) })
    : t('policy.statusPass');

  return `${behaviour} · ${t('policy.ruleCount', { count: total })}`;
};
