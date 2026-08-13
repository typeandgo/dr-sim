import { COMMANDS } from '@/core/constants';
import { isInInjectionScope, validateDomainPattern } from '@/core/matcher';
import { describeMessage } from '@/core/i18n';
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

// Enjeksiyonun gerçek kapsamıyla aynı soruyu sorar (bkz. core/matcher.ts):
// domain `localhost:5175`, sayfa `localhost:5174` iken script GERÇEKTEN enjekte
// edilmiştir, çünkü izin/enjeksiyon pattern'i portsuzdur.
const isCoveredBy = (host: string, patterns: string[]): boolean => isInInjectionScope(host, patterns);

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
    placeholder: ctx.t('scope.domainPlaceholder'),
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

  const addButton = button(ctx.t('common.add'), () => void add(), {
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

  // İzin geri alınınca chip sarıya döner ve "İzin ver" görünür; bu satır nedenini
  // yazar. Arka plan `granted`'ı canlı doğruladığı için artık ulaşılabilir bir durum.
  const permissionLost = h('p', {
    class: 'drsim-hint drsim-hint--error',
    dataset: { test: 'dr-sim-permission-lost' },
  });
  permissionLost.hidden = true;
  const empty = h('p', {
    class: 'drsim-hint drsim-hint--error',
    dataset: { test: 'dr-sim-domain-empty' },
  });
  const route = h('button', {
    class: 'drsim-route',
    type: 'button',
    dataset: { test: 'dr-sim-route' },
    title: ctx.t('scope.copyAddress'),
    on: {
      click: () => {
        void navigator.clipboard?.writeText(route.textContent ?? '').then(() => ctx.notify(ctx.t('scope.addressCopied')));
      },
    },
  });

  // Enjeksiyon kapsamı domain kapsamından ayrıdır: uygulama panel.example.com'da
  // çalışırken API api.example.com olabilir. Sayfaya enjekte edilmezse hiçbir şey yakalanmaz.
  const coverage = h('p', { class: 'drsim-hint drsim-hint--error' });
  const enablePage = button(ctx.t('scope.runHere'), () => void addPageHost(), {
    class: 'drsim-button drsim-button--compact',
    dataset: { test: 'dr-sim-enable-page' },
  });
  const pageHostChips = h('ul', { class: 'drsim-chips' });

  root.append(
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        h('span', { class: 'drsim-section__title', text: ctx.t('scope.domain') }),
      ]),
      h('p', { class: 'drsim-hint', text: ctx.t('scope.domainHint') }),
      h('div', { class: 'drsim-row' }, [input, addButton]),
      error,
      empty,
      chips,
      permissionLost,
    ]),
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        h('span', { class: 'drsim-section__title', text: ctx.t('scope.activePage') }),
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
      const grant = button(ctx.t('common.allow'), () => void requestPermission(domain.pattern, domain.id), {
        class: 'drsim-button drsim-button--compact',
      });
      const remove = button('✕', () => void ctx.send(COMMANDS.REMOVE_DOMAIN, { id: domain.id }), {
        class: 'drsim-button drsim-button--compact drsim-button--bare',
        title: ctx.t('scope.removeDomain'),
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
      ctx.notify(ctx.t('scope.permissionDenied'), 'error');
      return;
    }

    const result = await ctx.send(COMMANDS.ADD_PAGE_HOST, { pattern: activeHost });
    if (result.ok) ctx.notify(ctx.t('scope.reloadHint'));
    else ctx.notify(result.error ?? ctx.t('scope.pageAddFailed'), 'error');
  }

  async function requestPermission(pattern: string, id: string): Promise<void> {
    if (!await requestOriginPermission(pattern)) {
      ctx.notify(ctx.t('scope.permissionDenied'), 'error');
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
        title: ctx.t('scope.stopRunningHere'),
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
      showError(describeMessage(validation.error, ctx.t));
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
      showError(ctx.t('scope.permissionDeniedDomain'));
      return;
    }

    const result = await ctx.send(COMMANDS.ADD_DOMAIN, { pattern: validation.pattern });
    if (!result.ok) {
      showError(result.error ? describeMessage(result.error, ctx.t) : ctx.t('scope.addFailed'));
      return;
    }

    input.value = '';
    if (alsoPage) await ctx.send(COMMANDS.ADD_PAGE_HOST, { pattern: alsoPage });
  }

  return {
    update: (state: UiState) => {
      list.render(state.settings.domains);
      const hasDomain = state.settings.domains.length > 0;
      setText(empty, hasDomain ? '' : ctx.t('scope.noDomains'));
      empty.hidden = hasDomain;
      chips.hidden = !hasDomain;

      const lost = state.settings.domains.some((domain) => domain.granted === false);
      setText(permissionLost, lost ? ctx.t('scope.permissionLost') : '');
      permissionLost.hidden = !lost;

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
        setText(coverage, ctx.t('scope.notInjected', { host: activeHost }));
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
