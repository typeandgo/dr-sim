import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Settings, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountHeader } from './header';
import type { ComponentContext } from './types';

const state = (settings: Partial<Settings> = {}, autoOffAt: number | null = null): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...settings },
  autoOffAt,
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t, locale: 'tr' };
  return { root, ctx, component: mountHeader(root, ctx) };
};

const toggleOf = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-test="dr-sim-toggle"]')!;

describe('ui/header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it('tek bir toggle vardır; ayrı ON rozeti yoktur', () => {
    const { root, component } = setup();
    component.update(state());

    expect(root.querySelectorAll('[data-test="dr-sim-toggle"]')).toHaveLength(1);
    expect(root.querySelector('.drsim-header__badge')).toBeNull();
  });

  it('kapalıyken OFF, açıkken ON gösterir', () => {
    const { root, component } = setup();

    component.update(state({ enabled: false }));
    expect(toggleOf(root).textContent).toBe('OFF');
    expect(toggleOf(root).className).not.toContain('drsim-switch--on');

    component.update(state({ enabled: true }));
    expect(toggleOf(root).textContent).toBe('ON');
    expect(toggleOf(root).className).toContain('drsim-switch--on');
  });

  it('erişilebilir switch sözleşmesini uygular', () => {
    const { root, component } = setup();
    component.update(state({ enabled: true }));

    const toggle = toggleOf(root);
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Simülasyonu kapat');
  });

  it('tıklama SET_ENABLED komutunu tersine çevirir', () => {
    const { root, ctx, component } = setup();
    component.update(state({ enabled: false }));

    toggleOf(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.SET_ENABLED, { enabled: true });
  });

  it('gözlem modu ve aktif uyarı metinlerini değiştirir', () => {
    const { root, component } = setup();

    component.update(state({ enabled: false }));
    expect(root.textContent).toContain('Gözlem modu');

    component.update(state({ enabled: true }));
    expect(root.textContent).toContain('istekler değiştiriliyor');
  });

  it('auto-off geri sayımı yalnızca simülasyon açıkken görünür', () => {
    const { root, component } = setup();
    const deadline = Date.now() + 28 * 60_000;

    component.update(state({ enabled: true }, deadline));
    expect(root.textContent).toContain('dk sonra otomatik kapanır');

    component.update(state({ enabled: false }, deadline));
    expect(root.querySelector<HTMLElement>('.drsim-header__auto-off')!.hidden).toBe(true);
  });
});
