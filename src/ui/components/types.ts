import type { UiState } from '@/core/types';
import type { CommandResponse } from '../state/connection';

// Component sözleşmesi — 01-architecture.md §7.1: mount(root, ctx) → { update, destroy }
// `update` idempotent olmalıdır: DOM'u baştan kurmaz, değişen alanı yazar.

export interface ComponentContext {
  send: (command: string, payload?: Record<string, unknown>) => Promise<CommandResponse>;
  notify: (message: string, kind?: 'info' | 'error') => void;
}

export interface Component {
  update: (state: UiState) => void;
  destroy: () => void;
}

export type Mount = (root: HTMLElement, ctx: ComponentContext) => Component;
