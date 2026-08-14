import { COMMANDS } from '@/core/constants';
import { reasonLabel } from '@/core/report.builder';
import type { Locale, MessageKey } from '@/core/i18n';
import type { LogEntry, UiState } from '@/core/types';
import { button, h, setText, toggleClass } from '../dom/h';
import { createList } from '../dom/list';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.8 / §3.9 — Son Success'ler (yeşil) ve Son Fail'ler (kırmızı).
// Fail satırındaki "İzin ver" ürünün ana çalışma döngüsüdür: blokla → çöken yeri gör → izin ver → yenile.

type Kind = 'success' | 'fail';
type SourceFilter = 'all' | 'real' | 'simulated';

const FILTERS: Array<{ id: SourceFilter; key: MessageKey }> = [
  { id: 'all', key: 'common.all' },
  { id: 'real', key: 'log.filterReal' },
  { id: 'simulated', key: 'log.filterSimulated' },
];

// Saat biçimi de arayüz dilini izler; `tr-TR`'ye sabitlenmişti (Y1)
const timeOf = (at: number, locale: Locale): string => new Date(at).toLocaleTimeString(locale, { hour12: false });

export const mountLogList = (root: HTMLElement, ctx: ComponentContext, kind: Kind): Component => {
  const isFail = kind === 'fail';
  const title = h('span', { class: 'drsim-section__title' });

  const list = h('ul', {
    class: `drsim-list drsim-log drsim-log--${kind}`,
    aria: { live: 'polite' },
    dataset: { test: isFail ? 'dr-sim-failed-log' : 'dr-sim-success-log' },
  });

  const empty = h('p', { class: 'drsim-empty', text: ctx.t(isFail ? 'log.failEmpty' : 'log.successEmpty') });

  let filter: SourceFilter = 'all';
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

  root.appendChild(
    h('section', { class: 'drsim-section' }, [
      // Filtreler başlıkla aynı satırda (Revizyon 53). "Temizle" kaldırıldı:
      // loglar artık her sayfa yüklemesinde kendiliğinden sıfırlanıyor, elle
      // temizlemenin bir karşılığı kalmadı. Boşalan sağ taraf filtrelere gitti
      // ve bölüm bir satır kısaldı — politika bölümü de aynı düzeni kullanıyor.
      // Rol `tablist` değil `radiogroup` (Revizyon 55): bunlar panel değiştiren
      // sekmeler değil, aynı listeyi süzen tekli seçim — ekran okuyucuya
      // olmayan bir sekme yapısı vadetmemeli.
      h('div', { class: 'drsim-section__head' }, [
        title,
        h('div', {
          class: 'drsim-segmented',
          role: 'radiogroup',
          aria: { label: ctx.t('log.filterAria') },
        }, filterButtons),
      ]),
      list,
      empty,
    ]),
  );

  let state: UiState | null = null;

  const renderer = createList<LogEntry>(
    list,
    (entry) => entry.id,
    (entry) => {
      const ep = h('span', { class: 'drsim-log__ep' });
      const meta = h('span', { class: 'drsim-log__label' });
      const tag = h('span', { class: 'drsim-tag' });

      const quickAllow = button(ctx.t('common.allow'), () => {
        void ctx.send(COMMANDS.SET_RULE_STATE, {
          method: entry.method,
          path: entry.path,
          state: 'allow',
          source: 'quick-allow',
        });
      }, { class: 'drsim-button drsim-button--compact', dataset: { test: 'dr-sim-quick-allow' } });

      // Satır tıklaması yok (Revizyon 48): tıklayınca URL kopyalanıyordu, ama satır
      // artık metin seçmek içindir — seçim yapmak da tıklama üretir ve kullanıcının
      // az önce seçtiği metnin yerine URL panoya yazılırdı. Ham URL hover'da (title).
      const row = h('li', {
        class: 'drsim-log__row',
        title: entry.url,
      }, [ep, meta, tag, quickAllow]);

      return row;
    },
    (element, entry) => {
      const [ep, meta, tag, quickAllow] = [...element.children] as HTMLElement[];

      setText(ep!, `${entry.method} ${entry.path}`);
      setText(
        meta!,
        [
          entry.status ?? '—',
          entry.durationMs === null ? null : `${Math.round(entry.durationMs)} ms`,
          timeOf(entry.at, ctx.locale),
          `— ${reasonLabel(entry.reason, ctx.t)}`,
        ].filter(Boolean).join(' · '),
      );

      setText(tag!, ctx.t(entry.simulated ? 'log.tagSimulated' : 'log.tagReal'));
      toggleClass(tag!, 'drsim-tag--simulated', entry.simulated);

      // Gerçek hata satırlarında hızlı izin görünmez (izin vermek bir şeyi düzeltmez)
      if (quickAllow) quickAllow.hidden = !isFail || !entry.simulated;
    },
  );

  function entries(): LogEntry[] {
    const source = isFail ? state?.session?.failLog : state?.session?.successLog;
    return (source ?? []).filter((entry) => {
      if (filter === 'all') return true;
      return filter === 'simulated' ? entry.simulated : !entry.simulated;
    });
  }

  function render(): void {
    const items = entries();
    const total = (isFail ? state?.session?.failLog : state?.session?.successLog)?.length ?? 0;

    setText(title, ctx.t(isFail ? 'log.failTitle' : 'log.successTitle', { count: total }));
    renderer.render(items);
    empty.hidden = items.length > 0;
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
