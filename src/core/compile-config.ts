import type { Translate } from './i18n';
import type { Rule, RuleState, RuntimeConfig, Settings } from './types';

// Kurallar SW'de bir kez derlenir; MAIN world karar anında yalnızca tek lookup yapar (01 §8).
export const compileRules = (rules: Rule[]): Record<string, RuleState> => {
  const compiled: Record<string, RuleState> = Object.create(null) as Record<string, RuleState>;
  rules.forEach((rule) => {
    compiled[rule.key] = rule.state;
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
