import { COMMANDS } from '@/core/constants';
import { LOCALES, type Locale } from '@/core/i18n';
import type { UiState } from '@/core/types';
import { button, h, setText } from '../dom/h';
import type { Component, ComponentContext } from './types';

// Motor, sürüm, rapor export, budama bilgisi.

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

// Dil adları çevrilmez: kullanıcı kendi dilini kendi dilinde arar
const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', tr: 'Türkçe' };
const LANGUAGE_SHORT: Record<Locale, string> = { en: 'EN', tr: 'TR' };

export const mountFooter = (root: HTMLElement, ctx: ComponentContext): Component => {
  const info = h('span', { class: 'drsim-hint' });
  const pruned = h('span', { class: 'drsim-hint' });
  // Telif satırı yalnızca Ayarlar sayfasında (İletişim bölümü) durur: panel çalışma
  // yüzeyidir, her açılışta okunan bir şey değil.

  const exportReport = async (format: string): Promise<void> => {
    const result = await ctx.send(COMMANDS.EXPORT_REPORT, { format });
    const payload = result.data as { content?: string; extension?: string; name?: string } | undefined;

    if (!result.ok || !payload?.content) {
      ctx.notify(ctx.t('footer.reportFailed'), 'error');
      return;
    }

    download(payload.content, payload.extension ?? 'md', payload.name ?? 'dr-sim-rapor');
  };

  // Dil anahtarı footer'da (Revizyon 42): header sürekli kullanılan ON/OFF içindir,
  // dil ise bir kez seçilip unutulan bir tercih — Ayarlar kısayolunun yanı doğru yer.
  // Panelden seçim AÇIK tercih yazar ('auto' değil): kullanıcı görünen dili seçti.
  // Tercih ayarlarda saklandığı için sonraki oturumlarda da geçerli kalır.
  const languageButtons = LOCALES.map((locale) => button(LANGUAGE_SHORT[locale], () => {
    if (locale === ctx.locale) return;
    void ctx.send(COMMANDS.UPDATE_SETTINGS, { settings: { locale } });
  }, {
    class: ctx.locale === locale
      ? 'drsim-segmented__option drsim-segmented__option--active'
      : 'drsim-segmented__option',
    title: ctx.t('footer.switchTo', { language: LANGUAGE_NAMES[locale] }),
    // `pressed` değil `checked` (Revizyon 55): iki dilden tam olarak biri
    // seçilidir, bunlar birbirinden bağımsız basılı düğmeler değil.
    role: 'radio',
    aria: { checked: String(ctx.locale === locale) },
    dataset: { test: `dr-sim-language-${locale}` },
  }));

  const language = h('div', {
    class: 'drsim-segmented',
    role: 'radiogroup',
    aria: { label: ctx.t('footer.language') },
  }, languageButtons);

  root.appendChild(
    h('footer', { class: 'drsim-footer' }, [
      h('div', { class: 'drsim-section__actions drsim-footer__actions' }, [
        // Footer aksiyonları tam boy (Revizyon 36): satır içi aksiyon değil, bölüm
        // sonu eylemleri. İkonlar `⤓` / `⚙` — profil bölümündeki sözlüğün aynısı,
        // dışarıdan varlık yüklenmez (CSP).
        iconButton('⤓', ctx.t('footer.reportMd'), () => void exportReport('markdown'), { test: 'dr-sim-report-export' }),
        iconButton('⤓', ctx.t('footer.reportJson'), () => void exportReport('json')),
        iconButton('⚙', ctx.t('common.settings'), () => chrome.runtime.openOptionsPage()),
        language,
      ]),
      info,
      pruned,
    ]),
  );

  return {
    update: (state: UiState) => {
      setText(info, ctx.t('footer.version', { version: chrome.runtime.getManifest().version }));

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
