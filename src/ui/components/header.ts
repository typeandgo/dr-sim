import { COMMANDS } from '@/core/constants';
import type { UiState } from '@/core/types';
import { button, h, setText, toggleClass } from '../dom/h';
import { openGuide } from '../open-guide';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.1 — header, ON/OFF rozeti, master toggle, gözlem modu bilgisi.
// UI görünürlüğü ile simülasyon durumu tamamen bağımsızdır (as-is kusuru A-1 giderildi).

const remainingText = (autoOffAt: number | null, ctx: ComponentContext): string => {
  if (!autoOffAt) return '';
  const minutes = Math.max(0, Math.round((autoOffAt - Date.now()) / 60_000));
  return ctx.t('header.autoOff', { minutes });
};

export const mountHeader = (root: HTMLElement, ctx: ComponentContext): Component => {
  const title = h('span', { class: 'drsim-header__title', text: 'DR-SIM' });

  // Tek kontrol: durum rozeti ve master toggle birleşiktir (Revizyon 2).
  const switchText = h('span', { class: 'drsim-switch__text', text: ctx.t('header.off') });
  const switchTrack = h('span', { class: 'drsim-switch__track' }, [
    h('span', { class: 'drsim-switch__knob' }),
    switchText,
  ]);

  const toggle = h('button', {
    class: 'drsim-switch',
    type: 'button',
    role: 'switch',
    dataset: { test: 'dr-sim-toggle' },
    aria: { checked: 'false', label: ctx.t('header.enable') },
    on: {
      click: () => {
        void toggleSimulation();
      },
    },
  }, [switchTrack]);

  const mode = h('p', { class: 'drsim-hint drsim-header__mode' });
  const autoOff = h('p', { class: 'drsim-hint drsim-header__auto-off' });

  // Kılavuz başlığın yanında (Revizyon 52): ilk kez açan kullanıcının ihtiyacı
  // olan tek şey bu ve panelin en üstünde. Yeni sekmede açılır — panelde
  // gezinmek çalışma yüzeyini kaybettirirdi.
  const guide = button(ctx.t('guide.open'), () => void openGuide(), {
    class: 'drsim-header__link',
    title: ctx.t('guide.openTitle'),
    dataset: { test: 'dr-sim-open-guide' },
  });

  root.appendChild(
    h('header', { class: 'drsim-header', dataset: { test: 'dr-sim-panel-header' } }, [
      h('div', { class: 'drsim-header__row' }, [title, guide, toggle]),
      mode,
      autoOff,
    ]),
  );

  let enabled = false;

  async function toggleSimulation(): Promise<void> {
    const next = !enabled;
    const result = await ctx.send(COMMANDS.SET_ENABLED, { enabled: next });

    if (result.ok) return;

    if (result.error === 'production-guard') {
      const domains = (result.data as { domains?: string[] })?.domains ?? [];
      const confirmed = window.confirm(ctx.t('header.productionGuard', { domains: domains.join('\n') }));
      if (!confirmed) return;

      const retry = await ctx.send(COMMANDS.SET_ENABLED, { enabled: next, confirmProduction: true });
      if (!retry.ok) ctx.notify(retry.error ?? ctx.t('header.enableFailed'), 'error');
      return;
    }

    ctx.notify(result.error ?? ctx.t('header.toggleFailed'), 'error');
  }

  return {
    update: (state: UiState) => {
      enabled = state.settings.enabled;

      setText(switchText, ctx.t(enabled ? 'header.on' : 'header.off'));
      toggleClass(toggle, 'drsim-switch--on', enabled);
      toggle.setAttribute('aria-checked', String(enabled));
      const toggleLabel = ctx.t(enabled ? 'header.disable' : 'header.enable');
      toggle.setAttribute('aria-label', toggleLabel);
      toggle.title = toggleLabel;

      setText(mode, ctx.t(enabled ? 'header.modeOn' : 'header.modeOff'));
      toggleClass(mode, 'drsim-header__mode--on', enabled);

      const remaining = enabled ? remainingText(state.autoOffAt, ctx) : '';
      setText(autoOff, remaining);
      autoOff.hidden = !remaining;
    },
    destroy: () => {
      root.replaceChildren();
    },
  };
};
