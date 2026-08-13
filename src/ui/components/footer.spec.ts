import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator, type Locale } from '@/core/i18n';
import type { Settings, UiState } from '@/core/types';
import { installChromeMock } from '@/test/chrome-mock';
import { emptyState } from '../state/connection';
import { mountFooter } from './footer';
import type { ComponentContext } from './types';

const state = (over: Partial<Settings> = {}): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...over },
});

const setup = (locale: Locale = 'tr') => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = {
    send: vi.fn(async () => ({ ok: true })),
    notify: vi.fn(),
    t: createTranslator(locale),
    locale,
  };
  return { root, ctx, component: mountFooter(root, ctx) };
};

const langButton = (root: HTMLElement, locale: Locale): HTMLButtonElement => root
  .querySelector<HTMLButtonElement>(`[data-test="dr-sim-language-${locale}"]`)!;

describe('ui/footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
    installChromeMock();
  });

  it('etkin dil işaretlidir, diğeri değildir (Revizyon 42)', () => {
    const { root, component } = setup('tr');
    component.update(state());

    expect(langButton(root, 'tr').className).toContain('drsim-chip-button--active');
    expect(langButton(root, 'tr').getAttribute('aria-pressed')).toBe('true');
    expect(langButton(root, 'en').className).not.toContain('drsim-chip-button--active');
  });

  it('diğer dile basınca açık tercih yazılır — kalıcıdır', () => {
    const { root, ctx, component } = setup('tr');
    component.update(state());

    langButton(root, 'en').click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.UPDATE_SETTINGS, { settings: { locale: 'en' } });
  });

  it('“auto” tercihinde de çözülmüş dil işaretlenir', () => {
    const { root, component } = setup('en');
    component.update(state({ locale: 'auto' }));

    expect(langButton(root, 'en').className).toContain('drsim-chip-button--active');
  });

  it('zaten etkin olan dile basmak komut göndermez', () => {
    const { root, ctx, component } = setup('tr');
    component.update(state());

    langButton(root, 'tr').click();

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('rapor butonları dile göre yazılır', () => {
    const { root, component } = setup('en');
    component.update(state());

    expect(root.querySelector('[data-test="dr-sim-report-export"]')!.textContent).toContain('Report MD');
  });
});
