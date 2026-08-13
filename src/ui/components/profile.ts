import { COMMANDS } from '@/core/constants';
import type { UiState } from '@/core/types';
import { button, clear, h } from '../dom/h';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.4 — profil = kaydedilmiş kural listesi + domainler + politika + arıza.

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
  const remove = button('Kaldır', () => void removeProfile(), {
    class: 'drsim-button drsim-button--compact drsim-button--danger',
    title: 'Seçili profili listeden kaldır',
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
        h('span', { class: 'drsim-section__title', text: 'Profil' }),
        h('div', { class: 'drsim-section__actions' }, [
          button('⤓ İçe', () => fileInput.click(), { class: 'drsim-button drsim-button--compact' }),
          button('⤒ Dışa', () => void exportProfile(), { class: 'drsim-button drsim-button--compact' }),
          remove,
        ]),
      ]),
      select,
      fileInput,
    ]),
  );

  async function applyProfile(id: string): Promise<void> {
    if (!id) return;
    if (!window.confirm('Mevcut kural listesi bu profille değişecek. Devam edilsin mi?')) return;

    const result = await ctx.send(COMMANDS.APPLY_PROFILE, { id });
    if (!result.ok) ctx.notify(result.error ?? 'Profil uygulanamadı.', 'error');
  }

  // Listede seçili olan profil aynen dışa aktarılır (Revizyon 31); seçim yoksa
  // mevcut ayarların anlık görüntüsü iner.
  async function removeProfile(): Promise<void> {
    const id = select.value;
    if (!id) return;

    const name = select.selectedOptions[0]?.text ?? 'Profil';
    if (!window.confirm(`"${name}" profili listeden kaldırılacak. Kuralların değişmez. Devam edilsin mi?`)) return;

    const result = await ctx.send(COMMANDS.DELETE_PROFILE, { id });
    if (!result.ok) ctx.notify(result.error ?? 'Profil kaldırılamadı.', 'error');
  }

  async function exportProfile(): Promise<void> {
    const result = await ctx.send(COMMANDS.EXPORT_PROFILE, { id: select.value });
    const payload = result.data as { content?: string; extension?: string; name?: string } | undefined;
    if (!result.ok || !payload?.content) {
      ctx.notify('Profil dışa aktarılamadı.', 'error');
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
      ctx.notify(result.error ?? 'Profil içe aktarılamadı.', 'error');
      return;
    }

    // İçe aktarma dosyayı listeye kaydeder ama uygulamaz. Paylaşılan bir profili
    // alan kişi neredeyse her zaman hemen kullanmak ister; ayrıca listeden tekrar
    // seçmek zorunda kalmasın diye burada soruyoruz (Revizyon 31). Uygulamak mevcut
    // kural listesini değiştirdiği için sessizce yapılmaz.
    const id = (result.data as { id?: string } | undefined)?.id;
    ctx.notify('Profil listeye eklendi.');

    if (!id) return;
    if (!window.confirm('Profil listeye eklendi. Şimdi uygulansın mı? Mevcut kural listesi değişecek.')) return;

    const applied = await ctx.send(COMMANDS.APPLY_PROFILE, { id });
    if (!applied.ok) ctx.notify(applied.error ?? 'Profil uygulanamadı.', 'error');
  }

  let renderedIds = '';

  return {
    update: (state: UiState) => {
      // Hazır preset listeye gömülmez (Revizyon 34); `src/presets/` altındaki
      // senaryo dosyaları `⤓ İçe` ile elle alınır.
      const options = [
        { id: '', name: state.settings.profiles.length ? 'Seçiniz' : 'Profil yok — ⤓ İçe ile ekle' },
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
