import type { Translate } from './i18n';
import { resolveConflict } from './rules';
import type { Rule, RuleState, RuntimeConfig, Settings } from './types';

// Kurallar SW'de bir kez derlenir; MAIN world karar anında yalnızca tek lookup yapar (01 §8).
// Anahtar PATH'tir (Revizyon 59): bir EP'nin tek durumu vardır ve o durum path'in
// bütün method'ları için geçerlidir.
export const compileRules = (rules: Rule[]): Record<string, RuleState> => {
  const compiled: Record<string, RuleState> = Object.create(null) as Record<string, RuleState>;
  rules.forEach((rule) => {
    const existing = compiled[rule.path];
    compiled[rule.path] = existing === undefined ? rule.state : resolveConflict(existing, rule.state);
  });
  return compiled;
};

// Yalnızca host izni verilmiş domainler enjekte edilen config'e girer.
export const activeDomainPatterns = (settings: Settings): string[] => settings.domains
  .filter((domain) => domain.granted !== false)
  .map((domain) => domain.pattern);

export const compileConfig = (settings: Settings, revision: number, t: Translate): RuntimeConfig => ({
  enabled: settings.enabled,
  defaultPolicy: settings.defaultPolicy,
  domains: activeDomainPatterns(settings),
  rulesByKey: compileRules(settings.rules),
  fault: settings.fault,
  normalization: settings.normalization,
  captureHeaders: settings.captureHeaders,
  showPageBanner: settings.showPageBanner,
  bannerText: t('banner.active'),
  revision,
});
