import { COMMANDS } from '@/core/constants';
import type { UiState } from '@/core/types';
import { button, clear, h } from '../dom/h';
import type { Component, ComponentContext } from './types';

// Profil = kaydedilmiş kural listesi + domainler + politika + arıza.

const download = (content: string, extension: string, name: string): void => {
  const blob = new Blob([content], { type: extension === 'json' ? 'application/json' : 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url });
  link.download = `${name}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
};

export const mountProfile = (root: HTMLElement, ctx: ComponentContext): Component => {
  const select = h('select', {
    class: 'drsim-select',
    dataset: { test: 'dr-sim-profile-select' },
    on: {
      change: () => {
        syncRemove();
        void applyProfile(select.value);
      },
    },
  });

  // Seçili profili listeden kaldırır (Revizyon 33). Ayarlar'daki liste denetim
  // görünümü; yanlış bir dosyayı içe aktardığında paneli bırakmak zorunda kalma.
  const remove = button(ctx.t('common.remove'), () => void removeProfile(), {
    class: 'drsim-button drsim-button--compact drsim-button--danger',
    title: ctx.t('profile.removeTitle'),
    dataset: { test: 'dr-sim-profile-remove' },
  });

  // Seçim yokken kaldırılacak bir şey yok.
  const syncRemove = (): void => {
    remove.disabled = !select.value;
  };
  syncRemove();

  const fileInput = h('input', { type: 'file' });
  fileInput.accept = 'application/json';
  fileInput.hidden = true;
  fileInput.addEventListener('change', () => {
    void importFile();
  });

  root.appendChild(
    h('section', { class: 'drsim-section' }, [
      h('div', { class: 'drsim-section__head' }, [
        h('span', { class: 'drsim-section__title', text: ctx.t('profile.title') }),
        h('div', { class: 'drsim-section__actions' }, [
          button(ctx.t('profile.import'), () => fileInput.click(), { class: 'drsim-button drsim-button--compact' }),
          button(ctx.t('profile.export'), () => void exportProfile(), { class: 'drsim-button drsim-button--compact' }),
          remove,
        ]),
      ]),
      select,
      fileInput,
    ]),
  );

  async function applyProfile(id: string): Promise<void> {
    if (!id) return;
    if (!window.confirm(ctx.t('profile.applyConfirm'))) return;

    const result = await ctx.send(COMMANDS.APPLY_PROFILE, { id });
    if (!result.ok) ctx.notify(result.error ?? ctx.t('profile.applyFailed'), 'error');
  }

  // Listede seçili olan profil aynen dışa aktarılır (Revizyon 31); seçim yoksa
  // mevcut ayarların anlık görüntüsü iner.
  async function removeProfile(): Promise<void> {
    const id = select.value;
    if (!id) return;

    const name = select.selectedOptions[0]?.text ?? ctx.t('profile.title');
    if (!window.confirm(ctx.t('profile.removeConfirm', { name }))) return;

    const result = await ctx.send(COMMANDS.DELETE_PROFILE, { id });
    if (!result.ok) ctx.notify(result.error ?? ctx.t('profile.removeFailed'), 'error');
  }

  async function exportProfile(): Promise<void> {
    const result = await ctx.send(COMMANDS.EXPORT_PROFILE, { id: select.value });
    const payload = result.data as { content?: string; extension?: string; name?: string } | undefined;
    if (!result.ok || !payload?.content) {
      ctx.notify(ctx.t('profile.exportFailed'), 'error');
      return;
    }
    download(payload.content, payload.extension ?? 'json', payload.name ?? 'dr-sim-profil');
  }

  async function importFile(): Promise<void> {
    const file = fileInput.files?.[0];
    if (!file) return;

    const json = await file.text();
    fileInput.value = '';

    const result = await ctx.send(COMMANDS.IMPORT_PROFILE, { json });
    if (!result.ok) {
      ctx.notify(result.error ?? ctx.t('profile.importFailed'), 'error');
      return;
    }

    // İçe aktarma dosyayı listeye kaydeder ama uygulamaz. Paylaşılan bir profili
    // alan kişi neredeyse her zaman hemen kullanmak ister; ayrıca listeden tekrar
    // seçmek zorunda kalmasın diye burada soruyoruz (Revizyon 31). Uygulamak mevcut
    // kural listesini değiştirdiği için sessizce yapılmaz.
    const id = (result.data as { id?: string } | undefined)?.id;
    ctx.notify(ctx.t('profile.imported'));

    if (!id) return;
    if (!window.confirm(ctx.t('profile.importApplyConfirm'))) return;

    const applied = await ctx.send(COMMANDS.APPLY_PROFILE, { id });
    if (!applied.ok) ctx.notify(applied.error ?? ctx.t('profile.applyFailed'), 'error');
  }

  let renderedIds = '';

  return {
    update: (state: UiState) => {
      // Hazır preset listeye gömülmez (Revizyon 34); `src/presets/` altındaki
      // senaryo dosyaları `⤓ İçe` ile elle alınır.
      const options = [
        { id: '', name: ctx.t(state.settings.profiles.length ? 'profile.select' : 'profile.emptyOption') },
        ...state.settings.profiles.map((profile) => ({ id: profile.id, name: profile.name })),
      ];
      const signature = options.map((option) => `${option.id}:${option.name}`).join('|');

      if (signature !== renderedIds) {
        renderedIds = signature;
        clear(select);
        options.forEach((option) => select.appendChild(h('option', { value: option.id, text: option.name })));
      }

      const active = state.settings.activeProfileId ?? '';
      if (select.value !== active) select.value = active;
      syncRemove();
    },
    destroy: () => {
      root.replaceChildren();
    },
  };
};
