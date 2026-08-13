import { ALARM_AUTO_OFF } from '@/core/constants';
import { parseDomainPattern } from '@/core/matcher';
import type { DomainScope } from '@/core/types';

// Yanlışlıkla açık kalma koruması — 00-scope-and-gaps.md §6.1.
// `chrome.alarms` kullanılır: SW terminate olsa bile zamanlayıcı çalışır.

let autoOffAt: number | null = null;

export const scheduleAutoOff = async (minutes: number | null, now = Date.now()): Promise<number | null> => {
  try {
    await chrome.alarms.clear(ALARM_AUTO_OFF);
  } catch {
    // alarm yoksa yok say
  }

  if (!minutes || minutes <= 0) {
    autoOffAt = null;
    return null;
  }

  autoOffAt = now + minutes * 60_000;
  try {
    chrome.alarms.create(ALARM_AUTO_OFF, { delayInMinutes: minutes });
  } catch {
    autoOffAt = null;
  }

  return autoOffAt;
};

export const cancelAutoOff = async (): Promise<void> => {
  autoOffAt = null;
  try {
    await chrome.alarms.clear(ALARM_AUTO_OFF);
  } catch {
    // yok say
  }
};

export const autoOffDeadline = (): number | null => autoOffAt;

// Production guard: eklenen domain prod pattern'lerinden biriyle eşleşiyor mu?
export const matchesProductionPattern = (pattern: string, productionPatterns: string[]): boolean => {
  const parsed = parseDomainPattern(pattern);
  if (!parsed) return false;

  const host = parsed.isWildcard ? parsed.host.slice(2) : parsed.host;

  return productionPatterns.some((raw) => {
    const source = raw
      .trim()
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    if (!source) return false;
    try {
      return new RegExp(`^${source}$`, 'i').test(host);
    } catch {
      return false;
    }
  });
};

export const productionDomains = (domains: DomainScope[], productionPatterns: string[]): string[] => domains
  .filter((domain) => matchesProductionPattern(domain.pattern, productionPatterns))
  .map((domain) => domain.pattern);
