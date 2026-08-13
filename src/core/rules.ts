import { nextRuleState } from './decision-engine';
import { normalizeMethod, normalizePath, toEndpointKey } from './path.util';
import type { DefaultPolicy, NormalizationRules, Rule, RuleSource, RuleState } from './types';

// Kural listesi mutasyonları — tek kaynak `Settings.rules` (01-architecture.md §3).
// "İzin Verilen EP'ler" paneli ile envanter rozeti aynı listeden türetilir.

export interface RuleInput {
  method: string;
  path: string;
  state: RuleState;
  source?: RuleSource;
  note?: string;
  now?: number;
}

export const findRule = (rules: Rule[], key: string): Rule | undefined => rules.find((rule) => rule.key === key);

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
  const method = normalizeMethod(input.method);
  const path = normalizePath(input.path, normalization);
  const key = toEndpointKey(method, path, normalization);
  const existing = findRule(rules, key);

  const rule: Rule = {
    key,
    method,
    path,
    state: input.state,
    source: input.source ?? existing?.source ?? 'manual',
    createdAt: existing?.createdAt ?? input.now ?? 0,
  };
  if (input.note ?? existing?.note) rule.note = input.note ?? existing?.note;

  return existing ? rules.map((item) => (item.key === key ? rule : item)) : [...rules, rule];
};

export const removeRule = (rules: Rule[], key: string): Rule[] => rules.filter((rule) => rule.key !== key);

// Toggle: efektif durumu tersine çevirir; kayıt yoksa varsayılan politikanın tersini yazar.
export const toggleRule = (
  rules: Rule[],
  input: { key: string; method: string; path: string; defaultPolicy: DefaultPolicy; source?: RuleSource; now?: number },
): Rule[] => {
  const existing = findRule(rules, input.key);
  const state = nextRuleState(existing?.state, input.defaultPolicy);

  return upsertRule(rules, {
    method: input.method,
    path: input.path,
    state,
    source: existing?.source ?? input.source ?? 'inventory',
    now: input.now,
  });
};

export const bulkSetRuleState = (
  rules: Rule[],
  entries: Array<{ method: string; path: string }>,
  state: RuleState,
  source: RuleSource = 'inventory',
  now = 0,
): Rule[] => entries.reduce((acc, entry) => upsertRule(acc, { ...entry, state, source, now }), rules);
