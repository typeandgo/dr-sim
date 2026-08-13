import type { Locale, Translate } from '@/core/i18n';
import type { UiState } from '@/core/types';
import type { CommandResponse } from '../state/connection';

// Component sözleşmesi — 01-architecture.md §7.1: mount(root, ctx) → { update, destroy }
// `update` idempotent olmalıdır: DOM'u baştan kurmaz, değişen alanı yazar.

export interface ComponentContext {
  send: (command: string, payload?: Record<string, unknown>) => Promise<CommandResponse>;
  // Arka plandan gelen hata KODU da verilebilir; notify sözlükte karşılığı varsa çevirir
  notify: (message: string, kind?: 'info' | 'error') => void;
  // Dil değişince bileşenler yeniden mount edilir (Revizyon 41), bu yüzden `t`
  // mount anında sabitlenebilir — update içinde tazelemeye gerek yok.
  t: Translate;
  // Çözülmüş dil ('auto' tercihi zaten karara bağlanmış hâliyle). Dil anahtarının
  // hangi seçeneği işaretleyeceğini bilmesi için gerekir (Revizyon 42).
  locale: Locale;
}

export interface Component {
  update: (state: UiState) => void;
  destroy: () => void;
}

export type Mount = (root: HTMLElement, ctx: ComponentContext) => Component;
