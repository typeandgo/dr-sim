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
import { createConnection } from '../state/connection';
import '../styles/main.scss';
import '../styles/components.scss';

const root = document.getElementById('drsim-root');
if (!root) throw new Error('drsim-root bulunamadı');

const connection = createConnection();

const notice = h('div', { class: 'drsim-notice', role: 'status' });
notice.hidden = true;

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

const ctx: ComponentContext = {
  send: connection.send,
  notify: (message, kind = 'info') => {
    setText(notice, message);
    notice.classList.toggle('drsim-notice--error', kind === 'error');
    notice.hidden = false;

    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 4000);
  },
};

const headerSlot = h('div');
const body = h('div', { class: 'drsim-body' });
const unsupported = h('p', {
  class: 'drsim-empty drsim-empty--error',
  role: 'alert',
  text: 'Bu sayfa türünde eklenti çalışamaz.',
});
unsupported.hidden = true;

root.append(headerSlot, notice, unsupported, body);

const slot = (): HTMLElement => {
  const element = h('div', { class: 'drsim-slot' });
  body.appendChild(element);
  return element;
};

const components: Component[] = [
  mountHeader(headerSlot, ctx),
  mountScope(slot(), ctx),
  mountPolicy(slot(), ctx),
  mountProfile(slot(), ctx),
  mountInventory(slot(), ctx),
  mountLogList(slot(), ctx, 'success'),
  mountLogList(slot(), ctx, 'fail'),
  mountFooter(slot(), ctx),
];

let lastNotice: string | null = null;

connection.store.subscribe((state: UiState) => {
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
    ctx.notify(state.notice, 'error');
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
