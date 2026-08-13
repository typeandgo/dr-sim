import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { InventoryItem, Settings, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountInventory } from './inventory';
import type { ComponentContext } from './types';

// Kural 400: DOM ağacı değil, gönderilen komut ve payload doğrulanır.

const item = (over: Partial<InventoryItem> = {}): InventoryItem => ({
  key: 'GET /offers',
  method: 'GET',
  path: '/offers',
  sampleUrl: 'https://api.x.com/offers',
  count: 2,
  lastAt: 1,
  lastStatus: 200,
  lastDurationMs: 10,
  successCount: 2,
  failCount: 0,
  simulatedCount: 0,
  lastReason: 'allowed',
  origin: 'fetch',
  frameId: 0,
  manual: false,
  ...over,
});

const state = (settings: Partial<Settings> = {}, items: InventoryItem[] = [item()]): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...settings },
  session: {
    ...emptyState().session!,
    tabId: 1,
    origin: 'https://app.x.com',
    routePath: '/home',
    title: '',
    inventory: Object.fromEntries(items.map((entry) => [entry.key, entry])),
    successLog: [],
    failLog: [],
    outOfScopeCount: 0,
    droppedCount: 0,
    blockedSinceLoad: 0,
    loadedAt: 0,
    updatedAt: 0,
  },
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t };
  return { root, ctx, component: mountInventory(root, ctx) };
};

const toggleOf = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-test="dr-sim-state-toggle"]')!;

describe('ui/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it('toggle TOGGLE_RULE_STATE komutunu EP anahtarıyla gönderir', () => {
    const { root, ctx, component } = setup();
    component.update(state());

    toggleOf(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.TOGGLE_RULE_STATE, { key: 'GET /offers', source: 'inventory' });
  });

  it('varsayılan politikaya göre efektif durumu gösterir', () => {
    const { root, component } = setup();

    component.update(state({ defaultPolicy: 'block' }));
    expect(toggleOf(root).textContent).toBe('Engelli');
    expect(toggleOf(root).getAttribute('aria-checked')).toBe('false');

    component.update(state({ defaultPolicy: 'pass' }));
    expect(toggleOf(root).textContent).toBe('İzinli');
  });

  it('açık kayıt ile varsayılana tabi satırı görsel olarak ayırır', () => {
    const { root, component } = setup();

    component.update(state({ defaultPolicy: 'block' }));
    const row = root.querySelector<HTMLElement>('[data-test="dr-sim-inventory-item"]')!;
    expect(row.className).toContain('drsim-item--default-blocked');

    component.update(state({
      defaultPolicy: 'block',
      rules: [{ key: 'GET /offers', method: 'GET', path: '/offers', state: 'block', source: 'inventory', createdAt: 0 }],
    }));
    expect(row.className).toContain('drsim-item--blocked');
    expect(row.className).not.toContain('drsim-item--default-blocked');
  });

  it('engelli / toplam sayacını yazar', () => {
    const { root, component } = setup();
    component.update(state({ defaultPolicy: 'block' }, [item(), item({ key: 'GET /b', path: '/b' })]));

    expect(root.textContent).toContain('Sayfa EP Envanteri (2 engelli / 2)');
  });

  it('kopyala butonu yoktur (Revizyon 18)', () => {
    const { root, component } = setup();
    component.update(state());

    const actions = root.querySelector<HTMLElement>('.drsim-item__actions')!;
    expect([...actions.children].map((el) => el.getAttribute('data-test')))
      .toEqual(['dr-sim-state-toggle', 'dr-sim-rule-remove']);
  });

  it('✕ kaydı olmayan satırda da görünür ve çerçevelidir (Revizyon 26)', () => {
    const { root, component } = setup();

    component.update(state());
    const remove = root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!;
    expect(remove.hidden).toBe(false);
    expect(remove.className).not.toContain('drsim-button--bare');

    component.update(state({
      rules: [{ key: 'GET /offers', method: 'GET', path: '/offers', state: 'allow', source: 'inventory', createdAt: 0 }],
    }));
    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!.hidden).toBe(false);
  });

  it('kaydı olmayan satırda ✕ etkisizdir — komut gitse de satır varsayılanda kalır', () => {
    const { root, ctx, component } = setup();
    component.update(state({ defaultPolicy: 'block' }));

    root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.REMOVE_RULE, { key: 'GET /offers' });
    const row = root.querySelector<HTMLElement>('[data-test="dr-sim-inventory-item"]')!;
    expect(row.className).toContain('drsim-item--default-blocked');
  });

  it('✕ kaydı siler, EP varsayılan davranışa döner', () => {
    const { root, ctx, component } = setup();
    component.update(state({
      rules: [{ key: 'GET /offers', method: 'GET', path: '/offers', state: 'allow', source: 'inventory', createdAt: 0 }],
    }));

    root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.REMOVE_RULE, { key: 'GET /offers' });
  });

  it('ham örnek URL satırda yazılmaz, hover’da kalır (Revizyon 17)', () => {
    const { root, component } = setup();
    component.update(state());

    const row = root.querySelector<HTMLElement>('[data-test="dr-sim-inventory-item"]')!;
    expect(row.textContent).not.toContain('https://api.x.com/offers');
    expect(row.title).toBe('https://api.x.com/offers');
  });

  it('boş envanterde mevcut metni korur', () => {
    const { root, component } = setup();
    component.update(state({}, []));

    expect(root.textContent).toContain('Henüz istek yok. Sayfayı yenile veya etkileşim yap.');
  });

  it('update iki kez aynı state ile çağrılınca satır düğümü korunur (idempotent)', () => {
    const { root, component } = setup();
    component.update(state());
    const first = root.querySelector('[data-test="dr-sim-inventory-item"]');
    component.update(state());

    expect(root.querySelector('[data-test="dr-sim-inventory-item"]')).toBe(first);
  });

  it('destroy DOM’u bırakır', () => {
    const { root, component } = setup();
    component.update(state());
    component.destroy();

    expect(root.children).toHaveLength(0);
  });
});
