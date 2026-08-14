import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Profile, Settings, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountProfile } from './profile';
import type { ComponentContext } from './types';

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  name: 'Ödeme kapalı',
  defaultPolicy: 'block',
  domains: [],
  allow: [],
  block: [],
  fault: DEFAULT_SETTINGS.fault,
  updatedAt: 0,
  ...over,
});

const state = (over: Partial<Settings> = {}): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, profiles: [profile()], ...over },
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t, locale: 'tr' };
  return { root, ctx, component: mountProfile(root, ctx) };
};

const removeOf = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>('[data-test="dr-sim-profile-remove"]')!;
const selectOf = (root: HTMLElement): HTMLSelectElement => root.querySelector<HTMLSelectElement>('[data-test="dr-sim-profile-select"]')!;

describe('ui/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it('Kaydet butonu yoktur (Revizyon 32)', () => {
    const { root, component } = setup();
    component.update(state());

    expect([...root.querySelectorAll('button')].map((element) => element.textContent))
      .toEqual(['⤓ İçe', '⤒ Dışa', 'Kaldır']);
  });

  it('seçim yokken Kaldır pasiftir', () => {
    const { root, component } = setup();
    component.update(state());

    expect(removeOf(root).disabled).toBe(true);
  });

  it('hazır preset listede yoktur (Revizyon 34)', () => {
    const { root, component } = setup();
    component.update(state());

    const options = [...selectOf(root).options].map((option) => option.value);
    expect(options).toEqual(['', 'p1']);
  });

  it('profil yokken seçim satırı içe aktarmaya yönlendirir', () => {
    const { root, component } = setup();
    component.update(state({ profiles: [] }));

    expect(selectOf(root).options[0]!.text).toBe('Profil yok — ⤓ İçe ile ekle');
    expect(removeOf(root).disabled).toBe(true);
  });

  it('içe aktarılmış profil seçiliyken Kaldır aktiftir', () => {
    const { root, component } = setup();
    component.update(state({ activeProfileId: 'p1' }));

    expect(removeOf(root).disabled).toBe(false);
  });

  it('onay verilirse DELETE_PROFILE gönderir', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, ctx, component } = setup();
    component.update(state({ activeProfileId: 'p1' }));

    removeOf(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.DELETE_PROFILE, { id: 'p1' });
  });

  it('onay verilmezse hiçbir komut gitmez (Revizyon 33)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { root, ctx, component } = setup();
    component.update(state({ activeProfileId: 'p1' }));

    removeOf(root).click();

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('seçim değişince Kaldır’ın durumu anında güncellenir', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { root, component } = setup();
    component.update(state());

    const select = selectOf(root);
    select.value = 'p1';
    select.dispatchEvent(new Event('change'));

    expect(removeOf(root).disabled).toBe(false);
  });

  it('dışa aktarma seçili profilin id’sini gönderir (Revizyon 31)', () => {
    const { root, ctx, component } = setup();
    component.update(state({ activeProfileId: 'p1' }));

    [...root.querySelectorAll('button')].find((element) => element.textContent === '⤒ Dışa')!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.EXPORT_PROFILE, { id: 'p1' });
  });
});
