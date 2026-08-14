import { compileRules } from '@/core/compile-config';
import { COMMANDS } from '@/core/constants';
import { effectiveState } from '@/core/decision-engine';
import type { Locale, MessageKey } from '@/core/i18n';
import type { InventoryItem, RuleState, UiState } from '@/core/types';
import { button, h, setText, toggleClass } from '../dom/h';
import { createList } from '../dom/list';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.6 — satır anatomisi + TEK durum toggle'ı.
// Toggle her zaman efektif durumu tersine çevirir; kullanıcı kayıt var mı diye düşünmez.

type Filter = 'all' | 'blocked' | 'allowed';

const FILTERS: Array<{ id: Filter; key: MessageKey }> = [
  { id: 'all', key: 'common.all' },
  { id: 'blocked', key: 'common.blocked' },
  { id: 'allowed', key: 'common.allowed' },
];

// Saat biçimi de arayüz dilini izler; `tr-TR`'ye sabitlenmişti (Y1)
const timeOf = (at: number, locale: Locale): string => new Date(at).toLocaleTimeString(locale, { hour12: false });

export const mountInventory = (root: HTMLElement, ctx: ComponentContext): Component => {
  const title = h('span', { class: 'drsim-section__title' });
  const list = h('ul', { class: 'drsim-list drsim-list--tall', dataset: { test: 'dr-sim-inventory' } });
  const empty = h('p', { class: 'drsim-empty', text: ctx.t('inventory.empty') });

  const search = h('input', {
    class: 'drsim-input',
    placeholder: ctx.t('inventory.searchPlaceholder'),
    on: { input: () => render() },
  });

  let filter: Filter = 'all';
  const filterButtons = FILTERS.map((entry) => button(ctx.t(entry.key), () => {
    filter = entry.id;
    syncFilters();
    render();
  }, { class: 'drsim-segmented__option', role: 'radio' }));

  const syncFilters = (): void => {
    filterButtons.forEach((element, index) => {
      const active = FILTERS[index]?.id === filter;
      toggleClass(element, 'drsim-segmented__option--active', active);
      element.setAttribute('aria-checked', String(active));
    });
  };
  syncFilters();

  // "Temizle" yalnızca "navigasyonda envanteri koru" AÇIKKEN görünür
  // (Revizyon 56). Ayar kapalıyken envanter her sayfa yüklemesinde kendiliğinden
  // sıfırlanıyor ve buton hiçbir işe yaramıyordu — loglarda Revizyon 53'te
  // kaldırılma gerekçesinin aynısı. Ayar açıkken ise sıfırlama yapılmadığı için
  // envanteri boşaltmanın tek yolu bu düğme; o yüzden büsbütün silinmedi.
  const clear = button(ctx.t('common.clear'), () => void ctx.send(COMMANDS.CLEAR_INVENTORY), {
    class: 'drsim-button drsim-button--compact',
    dataset: { test: 'dr-sim-clear-inventory' },
  });
  clear.hidden = true;

  root.appendChild(
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [title, clear]),
      h('div', { class: 'drsim-row' }, [search, h('div', {
        class: 'drsim-segmented',
        role: 'radiogroup',
        aria: { label: ctx.t('inventory.filterAria') },
      }, filterButtons)]),
      list,
      empty,
    ]),
  );

  let state: UiState | null = null;

  // Envanter YALNIZCA sayfa trafiğinden dolar — profil satır üretmez. "profil"
  // etiketi bu yüzden "bu EP etkin profilde TANIMLI" demektir (Revizyon 57):
  // liste artık "profilimin kapsadığı EP'ler" ile "sayfada bulunan ama profilde
  // olmayan EP'ler" diye okunuyor. DR turunda profili tamamlamak zaten tam
  // olarak bu farkı kapatmak demek.
  let profileKeys = new Set<string>();

  const syncProfileKeys = (): void => {
    const settings = state?.settings;
    const active = settings?.profiles.find((entry) => entry.id === settings.activeProfileId);
    profileKeys = new Set(active?.rules.map((rule) => rule.path));
  };

  // Panelin gördüğü tablo ile karar motorunun gördüğü tablo AYNI fonksiyondan
  // gelir (Revizyon 59): ikisi ayrı kurulsaydı çakışma çözümü iki yerde yaşar ve
  // panel "İzinli" derken motor bloklayabilirdi.
  const rulesByPath = (): Record<string, RuleState> => compileRules(state?.settings.rules ?? []);

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
            void ctx.send(COMMANDS.TOGGLE_RULE_STATE, { path: item.path });
          },
        },
      });

      // "Bu satırı varsayılan davranışa döndür" — her satırda, çerçeveli (Revizyon 26).
      // Kaydı olmayan satırda basılması zararsızdır: `removeRule` saf bir filtre,
      // satır zaten varsayılandaysa hiçbir şey değişmez.
      const remove = button('✕', () => void ctx.send(COMMANDS.REMOVE_RULE, { path: item.path }), {
        class: 'drsim-button drsim-button--compact',
        title: ctx.t('inventory.removeRule'),
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

      const explicit = rulesByPath()[item.path];
      const effective = effectiveState(explicit, state?.settings.defaultPolicy ?? 'block');
      const blocked = effective === 'block';

      setText(ep, `${item.method} ${item.path}`);
      setText(count, `x${item.count}`);
      setText(
        status!,
        [
          item.lastStatus ?? '—',
          item.lastDurationMs === null ? null : `${Math.round(item.lastDurationMs)} ms`,
          timeOf(item.lastAt, ctx.locale),
          item.simulatedCount > 0 ? ctx.t('tag.simulated') : null,
        ].filter(Boolean).join(' · '),
      );
      // Ham örnek URL artık satırda yazılmıyor; `:id` normalizasyonunun neyi
      // grupladığı hover ile görülebilsin diye title'da tutulur (Revizyon 17).
      element.title = item.sampleUrl;

      setText(toggle, ctx.t(blocked ? 'common.blocked' : 'common.allowed'));
      toggle.setAttribute('aria-checked', String(!blocked));
      toggle.setAttribute('aria-label', `${item.method} ${item.path} — ${ctx.t(blocked ? 'common.blocked' : 'common.allowed')}`);
      toggleClass(toggle, 'drsim-toggle--blocked', blocked);

      // Açık kayıt: düz çubuk. Kayıt yok (varsayılana tabi): kesikli çubuk.
      toggleClass(element, 'drsim-item--blocked', blocked && explicit !== undefined);
      toggleClass(element, 'drsim-item--allowed', !blocked && explicit !== undefined);
      toggleClass(element, 'drsim-item--default-blocked', blocked && explicit === undefined);
      toggleClass(element, 'drsim-item--default-allowed', !blocked && explicit === undefined);

      // "simüle fail" etiketi kaldırıldı (Revizyon 57): koşulu (`simulatedCount > 0`)
      // hemen üstteki durum satırında yazan "simüle" ile BİREBİR aynıydı — aynı
      // bilgi aynı satırda iki kez duruyordu.
      const wanted = [
        ctx.t(profileKeys.has(item.path) ? 'tag.profile' : 'tag.page'),
        item.origin === 'xhr' ? ctx.t('tag.xhr') : null,
        item.lastReason === 'sync-xhr' ? ctx.t('tag.syncXhr') : null,
      ].filter((label): label is string => label !== null);

      if (tags && tags.dataset.tags !== wanted.join(',')) {
        tags.dataset.tags = wanted.join(',');
        tags.replaceChildren(...wanted.map((label) => h('span', { class: 'drsim-tag', text: label })));
      }
    },
  );

  function visibleItems(): InventoryItem[] {
    const items = Object.values(state?.session?.inventory ?? {});
    const query = search.value.trim().toLowerCase();
    const rules = rulesByPath();
    const policy = state?.settings.defaultPolicy ?? 'block';

    return items
      .filter((item) => {
        if (query && !item.key.toLowerCase().includes(query)) return false;
        if (filter === 'all') return true;
        const blocked = effectiveState(rules[item.path], policy) === 'block';
        return filter === 'blocked' ? blocked : !blocked;
      })
      .sort((a, b) => b.lastAt - a.lastAt);
  }

  function render(): void {
    const items = visibleItems();
    const all = Object.values(state?.session?.inventory ?? {});
    const rules = rulesByPath();
    const policy = state?.settings.defaultPolicy ?? 'block';
    const blockedCount = all.filter((item) => effectiveState(rules[item.path], policy) === 'block').length;

    setText(title, ctx.t('inventory.title', { blocked: blockedCount, total: all.length }));
    // Boş envanteri temizlemek de anlamsız: buton yalnızca silinecek bir şey
    // VARKEN ve otomatik sıfırlama kapalıyken görünür.
    clear.hidden = !state?.settings.keepInventoryOnNavigate || !all.length;

    // Satır başına profil araması yapmamak için render başına bir kez kurulur
    syncProfileKeys();
    renderer.render(items);

    empty.hidden = items.length > 0;
    setText(empty, ctx.t(all.length ? 'inventory.noMatch' : 'inventory.empty'));
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
