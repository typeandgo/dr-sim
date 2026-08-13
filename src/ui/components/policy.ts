import { COMMANDS } from '@/core/constants';
import type { UiState } from '@/core/types';
import { button, h, setText } from '../dom/h';
import { policyStatusLine } from '../policy-text';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.3 — panelde yalnızca tek satırlık durum + döngü eylemi kalır.
// Politika anahtarı (Revizyon 19) ve arıza ayarı (Revizyon 23) Ayarlar sayfasındadır:
// ikisi de bir kez kurulur, DR turu boyunca değişmez. Durum satırı seçili arıza
// tipini yazdığı için ayar panelde görünmese de ne olacağı belirsiz kalmaz.

export const mountPolicy = (root: HTMLElement, ctx: ComponentContext): Component => {
  const status = h('p', {
    class: 'drsim-hint',
    dataset: { test: 'dr-sim-policy-status' },
    aria: { live: 'polite' },
  });

  // DR döngüsü sayfa başına tekrarlanır: her yeni sayfaya temiz kural listesiyle
  // başlamak gerekir, bu yüzden sıfırlama panelde durur (Revizyon 21).
  const reset = button('Sıfırla', () => {
    if (!window.confirm('Tüm kurallar silinecek ve her EP varsayılan davranışa dönecek. Devam edilsin mi?')) return;
    void ctx.send(COMMANDS.CLEAR_RULES);
  }, {
    class: 'drsim-button drsim-button--compact',
    title: 'Kural listesini temizle — yeni bir DR turuna temiz başla',
    dataset: { test: 'dr-sim-clear-rules' },
  });

  root.append(
    h('section', { class: 'drsim-section drsim-section--row' }, [
      status,
      h('div', { class: 'drsim-section__actions' }, [
        reset,
        button('Ayarlar', () => chrome.runtime.openOptionsPage(), {
          class: 'drsim-button drsim-button--compact',
          title: 'Varsayılan davranışı ve arıza tipini Ayarlar’dan değiştir',
        }),
      ]),
    ]),
  );

  return {
    update: (state: UiState) => {
      setText(status, policyStatusLine(state.settings));
      reset.disabled = !state.settings.rules.length;
    },
    destroy: () => {
      root.replaceChildren();
    },
  };
};
