import { COMMANDS } from '@/core/constants';
import { effectiveState } from '@/core/decision-engine';
import type { InventoryItem, RuleState, UiState } from '@/core/types';
import { button, h, setText, toggleClass } from '../dom/h';
import { createList } from '../dom/list';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.6 — satır anatomisi + TEK durum toggle'ı.
// Toggle her zaman efektif durumu tersine çevirir; kullanıcı kayıt var mı diye düşünmez.

type Filter = 'all' | 'blocked' | 'allowed';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'blocked', label: 'Engelli' },
  { id: 'allowed', label: 'İzinli' },
];

const timeOf = (at: number): string => new Date(at).toLocaleTimeString('tr-TR', { hour12: false });

export const mountInventory = (root: HTMLElement, ctx: ComponentContext): Component => {
  const title = h('span', { class: 'drsim-section__title', text: 'Sayfa EP Envanteri (0 / 0)' });
  const list = h('ul', { class: 'drsim-list drsim-list--tall', dataset: { test: 'dr-sim-inventory' } });
  const empty = h('p', { class: 'drsim-empty', text: 'Henüz istek yok. Sayfayı yenile veya etkileşim yap.' });

  const search = h('input', {
    class: 'drsim-input',
    placeholder: 'ara…',
    on: { input: () => render() },
  });

  let filter: Filter = 'all';
  const filterButtons = FILTERS.map((entry) => button(entry.label, () => {
    filter = entry.id;
    syncFilters();
    render();
  }, { class: 'drsim-chip-button', role: 'tab' }));

  const syncFilters = (): void => {
    filterButtons.forEach((element, index) => {
      const active = FILTERS[index]?.id === filter;
      toggleClass(element, 'drsim-chip-button--active', active);
      element.setAttribute('aria-selected', String(active));
    });
  };
  syncFilters();

  root.appendChild(
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        title,
        button('Temizle', () => void ctx.send(COMMANDS.CLEAR_INVENTORY), {
          class: 'drsim-button drsim-button--compact',
          dataset: { test: 'dr-sim-clear-inventory' },
        }),
      ]),
      h('div', { class: 'drsim-row' }, [search, h('div', { class: 'drsim-filters', role: 'tablist' }, filterButtons)]),
      list,
      empty,
    ]),
  );

  let state: UiState | null = null;

  const rulesByKey = (): Record<string, RuleState> => {
    const map: Record<string, RuleState> = {};
    state?.settings.rules.forEach((rule) => {
      map[rule.key] = rule.state;
    });
    return map;
  };

  const renderer = createList<InventoryItem>(
    list,
    (item) => item.key,
    (item) => {
      const ep = h('span', { class: 'drsim-ep' });
      const count = h('span', { class: 'drsim-item__count' });
      const status = h('p', { class: 'drsim-hint drsim-item__status' });
      const tags = h('span', { class: 'drsim-tags' });

      const toggle = h('button', {
        class: 'drsim-toggle',
        type: 'button',
        role: 'switch',
        dataset: { test: 'dr-sim-state-toggle' },
        on: {
          click: () => {
            void ctx.send(COMMANDS.TOGGLE_RULE_STATE, { key: item.key, source: 'inventory' });
          },
        },
      });

      // "Bu satırı varsayılan davranışa döndür" — her satırda, çerçeveli (Revizyon 26).
      // Kaydı olmayan satırda basılması zararsızdır: `removeRule` saf bir filtre,
      // satır zaten varsayılandaysa hiçbir şey değişmez.
      const remove = button('✕', () => void ctx.send(COMMANDS.REMOVE_RULE, { key: item.key }), {
        class: 'drsim-button drsim-button--compact',
        title: 'Kuralı sil — EP varsayılan davranışa döner',
        dataset: { test: 'dr-sim-rule-remove' },
      });

      return h('li', { class: 'drsim-item', dataset: { test: 'dr-sim-inventory-item' } }, [
        h('div', { class: 'drsim-item__main' }, [ep, count]),
        status,
        h('div', { class: 'drsim-item__footer' }, [tags, h('div', { class: 'drsim-item__actions' }, [toggle, remove])]),
      ]);
    },
    (element, item) => {
      const [main, status, footer] = [...element.children] as HTMLElement[];
      const ep = main?.firstElementChild as HTMLElement;
      const count = main?.lastElementChild as HTMLElement;
      const tags = footer?.firstElementChild as HTMLElement;
      const actions = footer?.lastElementChild as HTMLElement;
      const toggle = actions?.firstElementChild as HTMLElement;

      const explicit = rulesByKey()[item.key];
      const effective = effectiveState(explicit, state?.settings.defaultPolicy ?? 'block');
      const blocked = effective === 'block';

      setText(ep, `${item.method} ${item.path}`);
      setText(count, `x${item.count}`);
      setText(
        status!,
        [
          item.lastStatus ?? '—',
          item.lastDurationMs === null ? null : `${Math.round(item.lastDurationMs)} ms`,
          timeOf(item.lastAt),
          item.simulatedCount > 0 ? 'simüle' : null,
        ].filter(Boolean).join(' · '),
      );
      // Ham örnek URL artık satırda yazılmıyor; `:id` normalizasyonunun neyi
      // grupladığı hover ile görülebilsin diye title'da tutulur (Revizyon 17).
      element.title = item.sampleUrl;

      setText(toggle, blocked ? 'Engelli' : 'İzinli');
      toggle.setAttribute('aria-checked', String(!blocked));
      toggle.setAttribute('aria-label', `${item.method} ${item.path} — ${blocked ? 'engelli' : 'izinli'}`);
      toggleClass(toggle, 'drsim-toggle--blocked', blocked);

      // Açık kayıt: düz çubuk. Kayıt yok (varsayılana tabi): kesikli çubuk.
      toggleClass(element, 'drsim-item--blocked', blocked && explicit !== undefined);
      toggleClass(element, 'drsim-item--allowed', !blocked && explicit !== undefined);
      toggleClass(element, 'drsim-item--default-blocked', blocked && explicit === undefined);
      toggleClass(element, 'drsim-item--default-allowed', !blocked && explicit === undefined);

      const wanted = [
        item.manual ? 'manuel' : 'envanter',
        item.origin === 'xhr' ? 'xhr' : null,
        item.lastReason === 'sync-xhr' ? 'sync XHR' : null,
        item.simulatedCount > 0 ? 'simüle fail' : null,
      ].filter((label): label is string => label !== null);

      if (tags && tags.dataset.tags !== wanted.join(',')) {
        tags.dataset.tags = wanted.join(',');
        tags.replaceChildren(...wanted.map((label) => h('span', {
          class: label === 'simüle fail' ? 'drsim-tag drsim-tag--simulated' : 'drsim-tag',
          text: label,
        })));
      }
    },
  );

  function visibleItems(): InventoryItem[] {
    const items = Object.values(state?.session?.inventory ?? {});
    const query = search.value.trim().toLowerCase();
    const rules = rulesByKey();
    const policy = state?.settings.defaultPolicy ?? 'block';

    return items
      .filter((item) => {
        if (query && !item.key.toLowerCase().includes(query)) return false;
        if (filter === 'all') return true;
        const blocked = effectiveState(rules[item.key], policy) === 'block';
        return filter === 'blocked' ? blocked : !blocked;
      })
      .sort((a, b) => b.lastAt - a.lastAt);
  }

  function render(): void {
    const items = visibleItems();
    const all = Object.values(state?.session?.inventory ?? {});
    const rules = rulesByKey();
    const policy = state?.settings.defaultPolicy ?? 'block';
    const blockedCount = all.filter((item) => effectiveState(rules[item.key], policy) === 'block').length;

    setText(title, `Sayfa EP Envanteri (${blockedCount} engelli / ${all.length})`);
    renderer.render(items);

    empty.hidden = items.length > 0;
    setText(
      empty,
      all.length ? 'Filtreyle eşleşen EP yok.' : 'Henüz istek yok. Sayfayı yenile veya etkileşim yap.',
    );
  }

  return {
    update: (next: UiState) => {
      state = next;
      render();
    },
    destroy: () => {
      renderer.destroy();
      root.replaceChildren();
    },
  };
};
