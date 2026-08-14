import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { LogEntry, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountLogList } from './log-list';
import type { ComponentContext } from './types';

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: '1',
  at: 1,
  method: 'POST',
  path: '/auth/refresh',
  url: 'https://api.x.com/auth/refresh',
  status: 503,
  durationMs: 4,
  outcome: 'fail',
  simulated: true,
  reason: 'default-block',
  routePath: '/home',
  frameId: 0,
  ...over,
});

const state = (failLog: LogEntry[] = [entry()], successLog: LogEntry[] = []): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS },
  session: {
    tabId: 1,
    documentId: 'doc',
    origin: 'https://app.x.com',
    routePath: '/home',
    title: '',
    inventory: {},
    successLog,
    failLog,
    outOfScopeCount: 0,
    droppedCount: 0,
    blockedSinceLoad: 0,
    loadedAt: 0,
    updatedAt: 0,
  },
});

const t = createTranslator('tr');

const setup = (kind: 'success' | 'fail') => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t, locale: 'tr' };
  return { root, ctx, component: mountLogList(root, ctx, kind) };
};

const quickAllow = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-test="dr-sim-quick-allow"]')!;

describe('ui/log-list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  // Revizyon 53: loglar her sayfa yüklemesinde kendiliğinden sıfırlandığı için
  // "Temizle" kaldırıldı; boşalan sağ taraf filtrelere gitti ve bölüm kısaldı.
  it('filtreler başlıkla aynı satırdadır, Temizle yoktur', () => {
    const { root, component } = setup('fail');
    component.update(state());

    const head = root.querySelector<HTMLElement>('.drsim-section__head')!;
    const filters = head.querySelector<HTMLElement>('.drsim-segmented')!;

    expect(filters).not.toBeNull();
    expect(filters.children).toHaveLength(3);

    // Revizyon 55: panel değiştiren sekme değil, tekli seçim grubu
    expect(filters.getAttribute('role')).toBe('radiogroup');
    expect(filters.getAttribute('aria-label')).toBe('Kaynak filtresi');
    expect([...filters.children].map((option) => option.getAttribute('aria-checked')))
      .toEqual(['true', 'false', 'false']);
    expect(root.querySelector('[data-test="dr-sim-clear-log"]')).toBeNull();
    expect(root.querySelector('[data-test="dr-sim-clear-success-log"]')).toBeNull();
  });

  it('satırda yalnızca EP seçilebilir, tıklama kopyalamaz (Revizyon 48)', () => {
    const { root, ctx, component } = setup('fail');
    component.update(state());

    const row = root.querySelector<HTMLElement>('.drsim-log__row')!;
    row.click();

    // Satırın tıklama davranışı yok; yalnızca hover'da ham URL gösterir
    expect(ctx.notify).not.toHaveBeenCalled();
    expect(row.title).toBe('https://api.x.com/auth/refresh');
    expect(row.querySelector('.drsim-log__ep')).not.toBeNull();
  });

  it('hızlı izin EP’yi path ile allow yapar', () => {
    const { root, ctx, component } = setup('fail');
    component.update(state());

    quickAllow(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.SET_RULE_STATE, {
      path: '/auth/refresh',
      state: 'allow',
    });
  });

  it('gerçek hata satırında hızlı izin görünmez', () => {
    const { root, component } = setup('fail');
    component.update(state([entry({ simulated: false, reason: 'real-error' })]));

    expect(quickAllow(root).hidden).toBe(true);
  });

  it('simüle ve gerçek kayıtları rozetle ayırır', () => {
    const { root, component } = setup('fail');
    component.update(state([entry({ id: 'a' }), entry({ id: 'b', simulated: false, reason: 'real-error' })]));

    const tags = [...root.querySelectorAll('.drsim-tag')].map((tag) => tag.textContent);
    expect(tags).toEqual(['simüle', 'gerçek']);
  });

  it('success listesinde hızlı izin hiç görünmez', () => {
    const { root, component } = setup('success');
    component.update(state([], [entry({ outcome: 'success', simulated: false, reason: 'allowed', status: 200 })]));

    expect(quickAllow(root).hidden).toBe(true);
  });

  it('sebep etiketini yazar', () => {
    const { root, component } = setup('fail');
    component.update(state());

    expect(root.textContent).toContain('izin listesinde yok');
  });
});
