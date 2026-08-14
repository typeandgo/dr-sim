import { COMMANDS } from '@/core/constants';
import type { MessageKey } from '@/core/i18n';
import type { DefaultPolicy, UiState } from '@/core/types';
import { button, h, setText, toggleClass } from '../dom/h';
import { policyStatusLine } from '../policy-text';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.3 — varsayılan davranış anahtarı + tek satırlık durum + döngü eylemi.
//
// Revizyon 19'da Ayarlar'a taşınmıştı, Revizyon 44'te panele geri döndü ve Ayarlar'daki
// kopyası kaldırıldı (R-38: aynı iş iki yerde durmaz). Radyo çifti yerine segment
// anahtarı: dar panelde iki satır yer kaplamıyor ve seçeneklerin açıklaması zaten
// altındaki durum cümlesinde canlı yazıyor.

const OPTIONS: Array<{ value: DefaultPolicy; key: MessageKey }> = [
  { value: 'block', key: 'policy.optionBlock' },
  { value: 'pass', key: 'policy.optionPass' },
];

export const mountPolicy = (root: HTMLElement, ctx: ComponentContext): Component => {
  const status = h('p', {
    class: 'drsim-hint',
    dataset: { test: 'dr-sim-policy-status' },
    aria: { live: 'polite' },
  });
  status.id = 'drsim-policy-status';

  // Seçili parça anlam rengini taşır (Revizyon 55): blok turuncu, geç teal —
  // kural etiketlerinin sözlüğünün aynısı. Filtre grupları nötr gri kaldığı için
  // bu bölüm artık "listeyi süz" değil "davranışı seç" gibi okunuyor.
  const choices = OPTIONS.map((option) => button(ctx.t(option.key), () => {
    void ctx.send(COMMANDS.SET_DEFAULT_POLICY, { policy: option.value });
  }, {
    class: `drsim-segmented__option drsim-segmented__option--${option.value}`,
    role: 'radio',
    aria: { checked: 'false' },
  }));

  // DR döngüsü sayfa başına tekrarlanır: her yeni sayfaya temiz kural listesiyle
  // başlamak gerekir, bu yüzden sıfırlama panelde durur (Revizyon 21).
  const reset = button(ctx.t('policy.reset'), () => {
    if (!window.confirm(ctx.t('policy.resetConfirm'))) return;
    void ctx.send(COMMANDS.CLEAR_RULES);
  }, {
    class: 'drsim-button drsim-button--compact',
    title: ctx.t('policy.resetTitle'),
    dataset: { test: 'dr-sim-clear-rules' },
  });

  root.append(
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        h('span', { class: 'drsim-section__title', text: ctx.t('policy.title') }),
        h('div', {
          class: 'drsim-segmented',
          role: 'radiogroup',
          dataset: { test: 'dr-sim-default-policy' },
          aria: { label: ctx.t('policy.aria'), describedby: 'drsim-policy-status' },
        }, choices),
      ]),
      status,
      h('div', { class: 'drsim-section__actions' }, [reset]),
    ]),
  );

  return {
    update: (state: UiState) => {
      setText(status, policyStatusLine(state.settings, ctx.t));
      reset.disabled = !state.settings.rules.length;

      choices.forEach((element, index) => {
        const active = OPTIONS[index]?.value === state.settings.defaultPolicy;
        toggleClass(element, 'drsim-segmented__option--active', active);
        element.setAttribute('aria-checked', String(active));
      });
    },
    destroy: () => {
      root.replaceChildren();
    },
  };
};
