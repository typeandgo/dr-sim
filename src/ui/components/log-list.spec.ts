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

  it('başlık satırında yalnızca Temizle vardır, filtreler alt satırda kalır (Revizyon 29)', () => {
    const { root, component } = setup('fail');
    component.update(state());

    const head = root.querySelector<HTMLElement>('.drsim-section__head')!;
    expect(head.querySelector('.drsim-filters')).toBeNull();
    expect(head.lastElementChild?.getAttribute('data-test')).toBe('dr-sim-clear-log');

    const filters = root.querySelector<HTMLElement>('.drsim-filters')!;
    expect(filters.children).toHaveLength(3);
    expect(head.contains(filters)).toBe(false);
    expect(head.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('hızlı izin EP’yi allow yapar ve kaynağı quick-allow olur', () => {
    const { root, ctx, component } = setup('fail');
    component.update(state());

    quickAllow(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.SET_RULE_STATE, {
      method: 'POST',
      path: '/auth/refresh',
      state: 'allow',
      source: 'quick-allow',
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

  it('temizle komutu doğru listeyi hedefler', () => {
    const { root, ctx, component } = setup('fail');
    component.update(state());

    root.querySelector<HTMLElement>('[data-test="dr-sim-clear-log"]')!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.CLEAR_LOGS, { which: 'fail' });
  });

  it('sebep etiketini yazar', () => {
    const { root, component } = setup('fail');
    component.update(state());

    expect(root.textContent).toContain('izin listesinde yok');
  });
});
