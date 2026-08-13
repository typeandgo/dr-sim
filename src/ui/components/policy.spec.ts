import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Rule, Settings, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountPolicy } from './policy';
import type { ComponentContext } from './types';

const rule = (key: string, state: 'allow' | 'block'): Rule => ({
  key,
  method: 'GET',
  path: key.split(' ')[1] ?? '/',
  state,
  source: 'inventory',
  createdAt: 0,
});

const state = (settings: Partial<Settings> = {}): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...settings },
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t };
  return { root, ctx, component: mountPolicy(root, ctx) };
};

const resetOf = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>('[data-test="dr-sim-clear-rules"]')!;

describe('ui/policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it('politika radio’ları panelde değildir (Revizyon 19)', () => {
    const { root, component } = setup();
    component.update(state());

    expect(root.querySelector('[data-test="dr-sim-default-policy"]')).toBeNull();
    expect(root.querySelector('[data-test="dr-sim-policy-status"]')).not.toBeNull();
  });

  it('durum satırı politikayı ve kural sayısını yazar', () => {
    const { root, component } = setup();
    component.update(state({ rules: [rule('GET /a', 'allow')] }));

    expect(root.querySelector('[data-test="dr-sim-policy-status"]')!.textContent)
      .toBe("Kural yazılmayan EP'ler bloklanıyor (503) · 1 kural");
  });

  it('kural yokken sıfırlama pasiftir', () => {
    const { root, component } = setup();
    component.update(state());

    expect(resetOf(root).disabled).toBe(true);
  });

  it('onay verilirse CLEAR_RULES gönderir', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, ctx, component } = setup();
    component.update(state({ rules: [rule('GET /a', 'allow')] }));

    resetOf(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.CLEAR_RULES);
  });

  it('onay verilmezse hiçbir komut gitmez', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { root, ctx, component } = setup();
    component.update(state({ rules: [rule('GET /a', 'allow')] }));

    resetOf(root).click();

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('İngilizce çevirmenle mount edilince metinler İngilizce olur (Revizyon 41)', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ctx: ComponentContext = {
      send: vi.fn(async () => ({ ok: true })),
      notify: vi.fn(),
      t: createTranslator('en'),
    };
    const component = mountPolicy(root, ctx);
    component.update(state({ rules: [rule('GET /a', 'allow')] }));

    expect(root.querySelector('[data-test="dr-sim-policy-status"]')!.textContent)
      .toBe('EPs without a rule are blocked (503) · 1 rules');
    expect(resetOf(root).textContent).toBe('Reset');
  });

  it('arıza alanları panelde değildir (Revizyon 23)', () => {
    const { root, component } = setup();
    component.update(state());

    expect(root.querySelector('[data-test="dr-sim-fault-kind"]')).toBeNull();
    expect(root.querySelectorAll('.drsim-field')).toHaveLength(0);
  });

  it('durum satırı arıza tipini yazmayı sürdürür', () => {
    const { root, component } = setup();
    component.update(state({ fault: { ...DEFAULT_SETTINGS.fault, kind: 'timeout', timeoutMs: 3000 } }));

    expect(root.querySelector('[data-test="dr-sim-policy-status"]')!.textContent)
      .toContain('3 sn sonra timeout');
  });
});
