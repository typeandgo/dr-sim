import { COMMANDS } from '@/core/constants';
import type { UiState } from '@/core/types';
import { button, h, setText } from '../dom/h';
import type { Component, ComponentContext } from './types';

// 02-ui-spec.md §3.10 — motor, sürüm, rapor export, budama bilgisi.

const download = (content: string, extension: string, name: string): void => {
  const blob = new Blob([content], { type: extension === 'json' ? 'application/json' : 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url });
  link.download = `${name}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
};

// İkon, etiketten ayrı bir span'de taşınır (Revizyon 39): buton yazısıyla aynı
// boyutta bir glif okunmuyordu. `\uFE0E` (VS15) metin sunumunu zorlar — onsuz `⚙`
// bazı platformlarda küçük renkli emoji olarak çiziliyor ve bulanık görünüyordu.
const iconButton = (
  icon: string,
  label: string,
  onClick: () => void,
  dataset?: Record<string, string>,
): HTMLButtonElement => {
  const element = button('', onClick, { class: 'drsim-button drsim-button--icon', dataset });
  element.append(
    h('span', { class: 'drsim-button__icon', text: `${icon}\uFE0E`, aria: { hidden: 'true' } }),
    h('span', { text: label }),
  );
  return element;
};

export const mountFooter = (root: HTMLElement, ctx: ComponentContext): Component => {
  const info = h('span', { class: 'drsim-hint' });
  const pruned = h('span', { class: 'drsim-hint' });
  const copyright = h('span', {
    class: 'drsim-hint drsim-footer__copyright',
    text: `© ${new Date().getFullYear()} typeandgo`,
  });

  const exportReport = async (format: string): Promise<void> => {
    const result = await ctx.send(COMMANDS.EXPORT_REPORT, { format });
    const payload = result.data as { content?: string; extension?: string; name?: string } | undefined;

    if (!result.ok || !payload?.content) {
      ctx.notify(ctx.t('footer.reportFailed'), 'error');
      return;
    }

    download(payload.content, payload.extension ?? 'md', payload.name ?? 'dr-sim-rapor');
  };

  root.appendChild(
    h('footer', { class: 'drsim-footer' }, [
      h('div', { class: 'drsim-section__actions drsim-footer__actions' }, [
        // Footer aksiyonları tam boy (Revizyon 36): satır içi aksiyon değil, bölüm
        // sonu eylemleri. İkonlar `⤓` / `⚙` — profil bölümündeki sözlüğün aynısı,
        // dışarıdan varlık yüklenmez (CSP).
        iconButton('⤓', ctx.t('footer.reportMd'), () => void exportReport('markdown'), { test: 'dr-sim-report-export' }),
        iconButton('⤓', ctx.t('footer.reportJson'), () => void exportReport('json')),
        iconButton('⚙', ctx.t('common.settings'), () => chrome.runtime.openOptionsPage()),
      ]),
      info,
      pruned,
      copyright,
    ]),
  );

  return {
    update: (state: UiState) => {
      setText(info, ctx.t('footer.engine', { engine: state.settings.engine, version: chrome.runtime.getManifest().version }));

      const dropped = state.session?.droppedCount ?? 0;
      setText(
        pruned,
        dropped
          ? ctx.t('footer.pruned', { max: state.settings.maxLogEntries, dropped })
          : ctx.t('footer.showing', { max: state.settings.maxLogEntries }),
      );
    },
    destroy: () => {
      root.replaceChildren();
    },
  };
};
