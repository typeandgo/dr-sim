import { describeMessage, type Locale, type Translate } from '@/core/i18n';
import type { UiState } from '@/core/types';
import { mountFooter } from '../components/footer';
import { mountHeader } from '../components/header';
import { mountInventory } from '../components/inventory';
import { mountLogList } from '../components/log-list';
import { mountPolicy } from '../components/policy';
import { mountProfile } from '../components/profile';
import { mountScope } from '../components/scope';
import type { Component, ComponentContext } from '../components/types';
import { h, setText } from '../dom/h';
import { localeOf, translatorFor } from '../locale';
import { createConnection } from '../state/connection';
import '../styles/main.scss';
import '../styles/components.scss';

const root = document.getElementById('drsim-root');
if (!root) throw new Error('drsim-root not found');

const connection = createConnection();

const notice = h('div', { class: 'drsim-notice', role: 'status' });
notice.hidden = true;

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

const headerSlot = h('div');
const body = h('div', { class: 'drsim-body' });
const unsupported = h('p', {
  class: 'drsim-empty drsim-empty--error',
  role: 'alert',
});
unsupported.hidden = true;

root.append(headerSlot, notice, unsupported, body);

// Bileşenler etiketlerini mount anında yazar; dil değişince tek tek güncellemek
// yerine hepsi yeniden kurulur (Revizyon 41). Panel küçük ve mount ucuz olduğu
// için bu, her bileşene "dili de tazele" kodu eklemekten hem kısa hem güvenli.
const mountAll = (t: Translate, locale: Locale): Component[] => {
  headerSlot.replaceChildren();
  body.replaceChildren();
  setText(unsupported, t('header.unsupported'));

  const ctx: ComponentContext = {
    send: connection.send,
    // Bileşenler hazır metin de, arka plandan gelen hata kodu da gönderebilir
    notify: (message, kind = 'info') => {
      setText(notice, describeMessage(message, t));
      notice.classList.toggle('drsim-notice--error', kind === 'error');
      notice.hidden = false;

      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        notice.hidden = true;
      }, 4000);
    },
    t,
    locale,
  };

  const slot = (): HTMLElement => {
    const element = h('div', { class: 'drsim-slot' });
    body.appendChild(element);
    return element;
  };

  return [
    mountHeader(headerSlot, ctx),
    mountScope(slot(), ctx),
    mountPolicy(slot(), ctx),
    mountProfile(slot(), ctx),
    mountInventory(slot(), ctx),
    mountLogList(slot(), ctx, 'success'),
    mountLogList(slot(), ctx, 'fail'),
    mountFooter(slot(), ctx),
  ];
};

let components: Component[] = [];
let locale: Locale | null = null;
let lastNotice: string | null = null;

connection.store.subscribe((state: UiState) => {
  const next = localeOf(state.settings.locale);

  if (locale !== next) {
    locale = next;
    // Belge dili çözülen dille aynı olmalı: sabit `lang="tr"` iken ekran okuyucu
    // İngilizce metni Türkçe telaffuz kurallarıyla okuyordu (Y1).
    document.documentElement.lang = next;
    components.forEach((component) => component.destroy());
    components = mountAll(translatorFor(state.settings.locale), next);
  }

  unsupported.hidden = state.supported;
  body.hidden = !state.supported;

  components.forEach((component) => {
    try {
      component.update(state);
    } catch {
      // bir bölümün hatası paneli komple bozmasın
    }
  });

  if (state.notice && state.notice !== lastNotice) {
    lastNotice = state.notice;
    setText(notice, describeMessage(state.notice, translatorFor(state.settings.locale)));
    notice.classList.add('drsim-notice--error');
    notice.hidden = false;

    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 4000);
  }
});

// Auto-off geri sayımı dakikada bir tazelenir
setInterval(() => {
  const state = connection.store.getState();
  if (state.autoOffAt) components[0]?.update(state);
}, 30_000);

window.addEventListener('pagehide', () => {
  components.forEach((component) => component.destroy());
  connection.destroy();
});
