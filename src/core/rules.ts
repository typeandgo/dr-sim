import { nextRuleState } from './decision-engine';
import { normalizePath } from './path.util';
import type { DefaultPolicy, NormalizationRules, Rule, RuleState } from './types';

// Kural listesi mutasyonları — tek kaynak `Settings.rules` (01-architecture.md §3).
// "İzin Verilen EP'ler" paneli ile envanter rozeti aynı listeden türetilir.

export interface RuleInput {
  path: string;
  state: RuleState;
  now?: number;
}

export const findRule = (rules: Rule[], path: string): Rule | undefined => rules.find((rule) => rule.path === path);

// Joker kural desteklenmez (T-804 backlog); `*` içeren girdi reddedilir.
export const validateRulePath = (path: string): { ok: true; path: string } | { ok: false; error: string } => {
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return { ok: false, error: 'path-empty' };
  if (trimmed.includes('*')) return { ok: false, error: 'path-wildcard' };

  const normalized = normalizePath(trimmed);
  if (normalized === '/') return { ok: false, error: 'path-invalid' };

  return { ok: true, path: normalized };
};

export const upsertRule = (rules: Rule[], input: RuleInput, normalization?: NormalizationRules): Rule[] => {
  const path = normalizePath(input.path, normalization);
  const existing = findRule(rules, path);
  const rule: Rule = { path, state: input.state, createdAt: existing?.createdAt ?? input.now ?? 0 };

  return existing ? rules.map((item) => (item.path === path ? rule : item)) : [...rules, rule];
};

export const removeRule = (rules: Rule[], path: string): Rule[] => rules.filter((rule) => rule.path !== path);

// Toggle: efektif durumu tersine çevirir; kayıt yoksa varsayılan politikanın tersini yazar.
export const toggleRule = (
  rules: Rule[],
  input: { path: string; defaultPolicy: DefaultPolicy; now?: number },
  normalization?: NormalizationRules,
): Rule[] => {
  const path = normalizePath(input.path, normalization);
  const existing = findRule(rules, path);

  return upsertRule(rules, { path, state: nextRuleState(existing?.state, input.defaultPolicy), now: input.now }, normalization);
};

// İki kural aynı path'e indiğinde durumu çözer. Block kazanır: DR aracında bir
// EP'yi yanlışlıkla AÇIK bırakmak, yanlışlıkla kapatmaktan daha kötü bir teşhis
// hatası üretir — kapalı EP hemen görülür, açık kalan EP testi sessizce yalancı
// yeşile çevirir. Import, migration ve derleme aynı bu fonksiyonu kullanır.
export const resolveConflict = (a: RuleState, b: RuleState): RuleState => (a === 'block' || b === 'block' ? 'block' : 'allow');
