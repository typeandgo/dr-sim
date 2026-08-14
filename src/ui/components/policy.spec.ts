import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Rule, Settings, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountPolicy } from './policy';
import type { ComponentContext } from './types';

const rule = (path: string, state: 'allow' | 'block'): Rule => ({ path, state, createdAt: 0 });

const state = (settings: Partial<Settings> = {}): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...settings },
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t, locale: 'tr' };
  return { root, ctx, component: mountPolicy(root, ctx) };
};

const resetOf = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>('[data-test="dr-sim-clear-rules"]')!;

describe('ui/policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it('politika anahtarı paneldedir ve etkin seçenek işaretlidir (Revizyon 44)', () => {
    const { root, component } = setup();
    component.update(state({ defaultPolicy: 'block' }));

    const group = root.querySelector<HTMLElement>('[data-test="dr-sim-default-policy"]')!;
    const [blockOption, passOption] = [...group.children] as HTMLElement[];

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(blockOption!.getAttribute('aria-checked')).toBe('true');
    expect(passOption!.getAttribute('aria-checked')).toBe('false');
    expect(blockOption!.className).toContain('drsim-segmented__option--active');
  });

  // Revizyon 55: filtrelerle aynı nötr çipleri kullandığı için bu bölüm "listeyi
  // süz" gibi okunuyordu. Segment yapısı ortak, anlam rengi bu bölüme özel.
  it('seçenekler filtrelerden ayrışsın diye anlam rengi taşır', () => {
    const { root, component } = setup();
    component.update(state({ defaultPolicy: 'block' }));

    const [blockOption, passOption] = [
      ...root.querySelector<HTMLElement>('[data-test="dr-sim-default-policy"]')!.children,
    ] as HTMLElement[];

    expect(blockOption!.className).toContain('drsim-segmented__option--block');
    expect(passOption!.className).toContain('drsim-segmented__option--pass');
  });

  it('seçeneğe basınca SET_DEFAULT_POLICY gider', () => {
    const { root, ctx, component } = setup();
    component.update(state({ defaultPolicy: 'block' }));

    ([...root.querySelector('[data-test="dr-sim-default-policy"]')!.children] as HTMLElement[])[1]!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.SET_DEFAULT_POLICY, { policy: 'pass' });
  });

  it('durum satırı politika anahtarını açıklar (aria-describedby)', () => {
    const { root, component } = setup();
    component.update(state());

    const group = root.querySelector<HTMLElement>('[data-test="dr-sim-default-policy"]')!;
    const status = root.querySelector<HTMLElement>('[data-test="dr-sim-policy-status"]')!;

    expect(group.getAttribute('aria-describedby')).toBe(status.id);
  });

  it('durum satırı politikayı ve kural sayısını yazar', () => {
    const { root, component } = setup();
    component.update(state({ rules: [rule('/a', 'allow')] }));

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
    component.update(state({ rules: [rule('/a', 'allow')] }));

    resetOf(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.CLEAR_RULES);
  });

  it('onay verilmezse hiçbir komut gitmez', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { root, ctx, component } = setup();
    component.update(state({ rules: [rule('/a', 'allow')] }));

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
      locale: 'en',
    };
    const component = mountPolicy(root, ctx);
    component.update(state({ rules: [rule('/a', 'allow')] }));

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
