import { COMMANDS } from '@/core/constants';
import { isInScope, validateDomainPattern } from '@/core/matcher';
import type { DomainScope, UiState } from '@/core/types';
import { button, h, setText } from '../dom/h';
import { createList } from '../dom/list';
import { requestOriginPermission, requestOriginPermissions } from '../permissions';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.2 — domain chip listesi, izin akışı, aktif sayfa path'i.

const hostOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Yalnızca yönetilebilir sayfalar; chrome:// gibi şemalar host üretmemeli
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host : '';
  } catch {
    return '';
  }
};

const isCoveredBy = (host: string, patterns: string[]): boolean => (host ? isInScope(`https://${host}/`, patterns) : false);

// Sayfa, domain listesi veya sayfa host listesi tarafından kapsanıyor mu?
const isPageCovered = (host: string, state: UiState): boolean => isCoveredBy(
  host,
  [...state.settings.domains, ...state.settings.pageHosts]
    .filter((entry) => entry.granted !== false)
    .map((entry) => entry.pattern),
);

export const mountScope = (root: HTMLElement, ctx: ComponentContext): Component => {
  const input = h('input', {
    class: 'drsim-input',
    placeholder: 'api.example.com',
    dataset: { test: 'dr-sim-domain-input' },
    on: {
      keydown: (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void add();
        }
      },
    },
  });

  const addButton = button('Ekle', () => void add(), {
    class: 'drsim-button',
    dataset: { test: 'dr-sim-domain-add' },
  });

  const error = h('p', { class: 'drsim-hint drsim-hint--error' });
  error.hidden = true;

  // Boş elemanlar flex gap'i tüketip mesajı input'tan uzaklaştırmasın diye
  // metin yokken akıştan tamamen çıkarılır (Revizyon 10).
  const showError = (message: string): void => {
    setText(error, message);
    error.hidden = !message;
  };

  const chips = h('ul', { class: 'drsim-chips', dataset: { test: 'dr-sim-domain-chips' } });
  const empty = h('p', {
    class: 'drsim-hint drsim-hint--error',
    dataset: { test: 'dr-sim-domain-empty' },
  });
  const route = h('button', {
    class: 'drsim-route',
    type: 'button',
    dataset: { test: 'dr-sim-route' },
    title: 'Panoya kopyala',
    on: {
      click: () => {
        void navigator.clipboard?.writeText(route.textContent ?? '').then(() => ctx.notify('Adres kopyalandı'));
      },
    },
  });

  // Enjeksiyon kapsamı domain kapsamından ayrıdır: uygulama panel.example.com'da
  // çalışırken API api.example.com olabilir. Sayfaya enjekte edilmezse hiçbir şey yakalanmaz.
  const coverage = h('p', { class: 'drsim-hint drsim-hint--error' });
  const enablePage = button('Bu sayfada çalıştır', () => void addPageHost(), {
    class: 'drsim-button drsim-button--compact',
    dataset: { test: 'dr-sim-enable-page' },
  });
  const pageHostChips = h('ul', { class: 'drsim-chips' });

  root.append(
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        h('span', { class: 'drsim-section__title', text: 'Domain' }),
      ]),
      h('p', { class: 'drsim-hint', text: 'Hangi isteklerin yönetileceği (API host’u).' }),
      h('div', { class: 'drsim-row' }, [input, addButton]),
      error,
      empty,
      chips,
    ]),
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        h('span', { class: 'drsim-section__title', text: 'Aktif sayfa' }),
        enablePage,
      ]),
      route,
      coverage,
      pageHostChips,
    ]),
  );

  const list = createList<DomainScope>(
    chips,
    (domain) => domain.id,
    (domain) => {
      const label = h('span', { class: 'drsim-chip__label' });
      const grant = button('İzin ver', () => void requestPermission(domain.pattern, domain.id), {
        class: 'drsim-button drsim-button--compact',
      });
      const remove = button('✕', () => void ctx.send(COMMANDS.REMOVE_DOMAIN, { id: domain.id }), {
        class: 'drsim-button drsim-button--compact drsim-button--bare',
        title: 'Domaini kaldır',
      });

      return h('li', { class: 'drsim-chip', dataset: { test: 'dr-sim-domain-chip' } }, [label, grant, remove]);
    },
    (element, domain) => {
      const [label, grant] = [...element.children] as HTMLElement[];
      if (label) setText(label, domain.pattern);
      element.classList.toggle('drsim-chip--pending', domain.granted === false);
      if (grant) grant.hidden = domain.granted !== false;
    },
  );

  let activeHost = '';
  let pageCovered = false;

  async function addPageHost(): Promise<void> {
    if (!activeHost) return;

    // İzin, komuttan ÖNCE ve tıklama bağlamında istenir (bkz. ui/permissions.ts)
    if (!await requestOriginPermission(activeHost)) {
      ctx.notify('Bu site için izin verilmedi. Eklenti bu sayfada çalışamaz.', 'error');
      return;
    }

    const result = await ctx.send(COMMANDS.ADD_PAGE_HOST, { pattern: activeHost });
    if (result.ok) ctx.notify('Sayfayı yenile — interceptor bu sekmeye enjekte edilecek.');
    else ctx.notify(result.error ?? 'Sayfa eklenemedi.', 'error');
  }

  async function requestPermission(pattern: string, id: string): Promise<void> {
    if (!await requestOriginPermission(pattern)) {
      ctx.notify('Bu site için izin verilmedi. Eklenti bu sayfada çalışamaz.', 'error');
      return;
    }
    await ctx.send(COMMANDS.REQUEST_DOMAIN_PERMISSION, { id });
  }

  const pageHostList = createList<DomainScope>(
    pageHostChips,
    (host) => host.id,
    (host) => {
      const label = h('span', { class: 'drsim-chip__label' });
      const remove = button('✕', () => void ctx.send(COMMANDS.REMOVE_PAGE_HOST, { id: host.id }), {
        class: 'drsim-button drsim-button--compact drsim-button--bare',
        title: 'Bu sayfada çalıştırmayı bırak',
      });
      return h('li', { class: 'drsim-chip' }, [label, remove]);
    },
    (element, host) => {
      setText(element.firstElementChild as HTMLElement, host.pattern);
    },
  );

  async function add(): Promise<void> {
    showError('');
    const validation = validateDomainPattern(input.value);

    if (!validation.ok) {
      showError(validation.error);
      return;
    }

    // Aktif sayfa henüz kapsamda değilse enjeksiyon izni de AYNI dialoga eklenir;
    // böylece kullanıcı ayrıca "Bu sayfada çalıştır" demek zorunda kalmaz (Revizyon 8).
    const alsoPage = activeHost && !isCoveredBy(activeHost, [validation.pattern]) && !pageCovered
      ? activeHost
      : '';

    // İzin, komuttan ÖNCE ve tıklama bağlamında istenir (bkz. ui/permissions.ts)
    const patterns = alsoPage ? [validation.pattern, alsoPage] : [validation.pattern];
    if (!await requestOriginPermissions(patterns)) {
      showError('Bu site için izin verilmedi. Domain eklenmedi — Ayarlar → Site izinleri’nden de verebilirsin.');
      return;
    }

    const result = await ctx.send(COMMANDS.ADD_DOMAIN, { pattern: validation.pattern });
    if (!result.ok) {
      showError(result.error ?? 'Domain eklenemedi.');
      return;
    }

    input.value = '';
    if (alsoPage) await ctx.send(COMMANDS.ADD_PAGE_HOST, { pattern: alsoPage });
  }

  return {
    update: (state: UiState) => {
      list.render(state.settings.domains);
      const hasDomain = state.settings.domains.length > 0;
      setText(empty, hasDomain ? '' : 'Domain girilmeden hiçbir istek yönetilmez. Yukarıdan bir domain ekle.');
      empty.hidden = hasDomain;
      chips.hidden = !hasDomain;

      // Tek satır, tam adres (Revizyon 9). Oturum varsa SPA gezinmesinde canlı
      // güncellenen kendi route bilgimizi kullanırız; yoksa sekmenin URL'i.
      const session = state.session;
      setText(route, session ? `${session.origin}${session.routePath}` : state.tabUrl || '—');

      activeHost = hostOf(state.tabUrl || state.session?.origin || '');
      pageCovered = isPageCovered(activeHost, state);
      const covered = pageCovered;

      enablePage.hidden = !activeHost || covered;
      coverage.hidden = !activeHost || covered;
      if (!covered && activeHost) {
        setText(
          coverage,
          `Bu sayfaya (${activeHost}) enjekte edilmiyor — istekler yakalanamaz. `
          + '"Bu sayfada çalıştır" ile izin ver, sonra sayfayı yenile.',
        );
      }

      pageHostList.render(state.settings.pageHosts);
      pageHostChips.hidden = !state.settings.pageHosts.length;
    },
    destroy: () => {
      list.destroy();
      pageHostList.destroy();
      root.replaceChildren();
    },
  };
};
