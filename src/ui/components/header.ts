import { COMMANDS } from '@/core/constants';
import type { UiState } from '@/core/types';
import { h, setText, toggleClass } from '../dom/h';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.1 — header, ON/OFF rozeti, master toggle, gözlem modu bilgisi.
// UI görünürlüğü ile simülasyon durumu tamamen bağımsızdır (as-is kusuru A-1 giderildi).

const remainingText = (autoOffAt: number | null): string => {
  if (!autoOffAt) return '';
  const minutes = Math.max(0, Math.round((autoOffAt - Date.now()) / 60_000));
  return `${minutes} dk sonra otomatik kapanır`;
};

export const mountHeader = (root: HTMLElement, ctx: ComponentContext): Component => {
  const title = h('span', { class: 'drsim-header__title', text: 'DR-SIM' });

  // Tek kontrol: durum rozeti ve master toggle birleşiktir (Revizyon 2).
  const switchText = h('span', { class: 'drsim-switch__text', text: 'OFF' });
  const switchTrack = h('span', { class: 'drsim-switch__track' }, [
    h('span', { class: 'drsim-switch__knob' }),
    switchText,
  ]);

  const toggle = h('button', {
    class: 'drsim-switch',
    type: 'button',
    role: 'switch',
    dataset: { test: 'dr-sim-toggle' },
    aria: { checked: 'false', label: 'Simülasyonu aç' },
    on: {
      click: () => {
        void toggleSimulation();
      },
    },
  }, [switchTrack]);

  const mode = h('p', { class: 'drsim-hint drsim-header__mode' });
  const autoOff = h('p', { class: 'drsim-hint drsim-header__auto-off' });

  root.appendChild(
    h('header', { class: 'drsim-header', dataset: { test: 'dr-sim-panel-header' } }, [
      h('div', { class: 'drsim-header__row' }, [title, toggle]),
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
      const confirmed = window.confirm(
        `Bu domainler production görünüyor:\n${domains.join('\n')}\n\n`
        + 'Politika "Bloklansın" iken domaine giden HER istek kesilir. Devam edilsin mi?',
      );
      if (!confirmed) return;

      const retry = await ctx.send(COMMANDS.SET_ENABLED, { enabled: next, confirmProduction: true });
      if (!retry.ok) ctx.notify(retry.error ?? 'Simülasyon açılamadı.', 'error');
      return;
    }

    ctx.notify(result.error ?? 'Simülasyon durumu değiştirilemedi.', 'error');
  }

  return {
    update: (state: UiState) => {
      enabled = state.settings.enabled;

      setText(switchText, enabled ? 'ON' : 'OFF');
      toggleClass(toggle, 'drsim-switch--on', enabled);
      toggle.setAttribute('aria-checked', String(enabled));
      toggle.setAttribute('aria-label', enabled ? 'Simülasyonu kapat' : 'Simülasyonu aç');
      toggle.title = enabled ? 'Simülasyonu kapat' : 'Simülasyonu aç';

      setText(
        mode,
        enabled
          ? 'Simülasyon açık — bu sekmedeki istekler değiştiriliyor'
          : 'Gözlem modu — istekler kaydediliyor, bloklanmıyor',
      );
      toggleClass(mode, 'drsim-header__mode--on', enabled);

      const remaining = enabled ? remainingText(state.autoOffAt) : '';
      setText(autoOff, remaining);
      autoOff.hidden = !remaining;
    },
    destroy: () => {
      root.replaceChildren();
    },
  };
};
