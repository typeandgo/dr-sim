import { COMMANDS, FAULT_PRESETS } from '@/core/constants';
import {
  LOCALES,
  type Locale,
  type LocalePreference,
  type Translate,
} from '@/core/i18n';
import { normalizePath } from '@/core/path.util';
import type { FaultConfig, NormalizationRules, Settings, UiState } from '@/core/types';
import { button, h, setText } from '../dom/h';
import { localeOf, translatorFor } from '../locale';
import { openGuide } from '../open-guide';
import { faultPresetId } from '../policy-text';
import { createConnection } from '../state/connection';
import '../styles/main.scss';
import '../styles/components.scss';

// 02-ui-spec.md §4 — options page bölümleri.
//
// Sayfa, ilk state gelene kadar KURULMAZ (Revizyon 41): dil tercihi ayarlarda
// tutulduğu için DOM'u kurmadan önce hangi dilde kuracağımızı bilmemiz gerekir.

const root = document.getElementById('drsim-root');
if (!root) throw new Error('drsim-root not found');

const connection = createConnection();
const save = (patch: Partial<Settings>): void => {
  void connection.send(COMMANDS.UPDATE_SETTINGS, { settings: patch });
};

// Dil adları çevrilmez: kullanıcı kendi dilini kendi dilinde arar
const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', tr: 'Türkçe' };

// `locale` parametresi kalktı: dile bağlı tek içerik (kılavuz + örnek profil)
// kendi sayfasına taşındı, burada kalan her metin `t` üzerinden geliyor.
const buildOptions = (mount: HTMLElement, t: Translate) => {
  const section = (title: string, children: HTMLElement[]): HTMLElement => h('section', { class: 'drsim-section' }, [
    h('div', { class: 'drsim-section__head' }, [h('span', { class: 'drsim-section__title', text: title })]),
    ...children,
  ]);

  const checkbox = (label: string, onChange: (checked: boolean) => void): { row: HTMLElement; input: HTMLInputElement } => {
    const input = h('input', { type: 'checkbox', on: { change: () => onChange(input.checked) } });
    return { row: h('label', { class: 'drsim-radio' }, [input, h('span', { text: label })]), input };
  };

  const numberField = (label: string, onChange: (value: number) => void): { row: HTMLElement; input: HTMLInputElement } => {
    const input = h('input', {
      class: 'drsim-input drsim-input--number',
      type: 'number',
      min: '0',
      on: { change: () => onChange(Number(input.value) || 0) },
    });
    return { row: h('label', { class: 'drsim-field' }, [h('span', { class: 'drsim-label', text: label }), input]), input };
  };

  // --- arıza (Revizyon 23: panelden buraya taşındı)
  const setFault = (patch: Partial<FaultConfig>): void => {
    void connection.send(COMMANDS.SET_FAULT, { fault: patch });
  };

  const faultSelect = h('select', {
    class: 'drsim-select',
    dataset: { test: 'dr-sim-fault-kind' },
    on: {
      change: () => {
        const chosen = FAULT_PRESETS.find((entry) => entry.id === faultSelect.value);
        if (!chosen) return;
        setFault({ kind: chosen.kind, status: chosen.status, statusText: chosen.statusText });
      },
    },
  }, FAULT_PRESETS.map((entry) => h('option', { value: entry.id, text: entry.label })));

  const faultBody = h('textarea', {
    class: 'drsim-textarea',
    rows: '2',
    on: { change: () => setFault({ body: faultBody.value }) },
  });

  const faultDelay = numberField(t('options.faultDelay'), (value) => setFault({ delayMs: value }));
  const faultTimeout = numberField(t('options.faultTimeout'), (value) => setFault({ timeoutMs: value || 30000 }));
  const faultBodyRow = h('label', { class: 'drsim-field' }, [
    h('span', { class: 'drsim-label', text: t('options.faultBody') }),
    faultBody,
  ]);

  // --- kurallar (Revizyon 20)
  // Panelde yapılabilen hiçbir iş burada tekrarlanmaz (Revizyon 38). Bu liste
  // panelin ulaşamadığı şeyi gösterir: envanter yalnızca bu sayfada tetiklenen
  // EP'leri bilir, buradaki kural listesi ise globaldir.
  const ruleSummary = h('p', { class: 'drsim-hint' });
  const ruleList = h('ul', { class: 'drsim-list' });

  // --- normalizasyon
  let normalization: NormalizationRules | null = null;
  const preview = h('p', { class: 'drsim-hint' });

  const updatePreview = (): void => {
    if (!normalization) return;
    setText(preview, `/items/8842/summary → ${normalizePath('/items/8842/summary', normalization)}`);
  };

  const saveNormalization = (patch: Partial<NormalizationRules>): void => {
    if (!normalization) return;
    const next = { ...normalization, ...patch };
    normalization = next;
    save({ normalization: next });
    updatePreview();
  };

  const numericId = checkbox(t('options.numericId'), (checked) => saveNormalization({ numericId: checked }));
  const uuid = checkbox(t('options.uuid'), (checked) => saveNormalization({ uuid: checked }));
  const longHex = checkbox(t('options.longHex'), (checked) => saveNormalization({ longHex: checked }));
  const customPatterns = h('textarea', {
    class: 'drsim-textarea',
    rows: '3',
    placeholder: t('options.customPatterns'),
    on: {
      change: () => saveNormalization({
        customPatterns: customPatterns.value.split('\n').map((line) => line.trim()).filter(Boolean),
      }),
    },
  });

  // --- gizlilik
  const captureHeaders = checkbox(t('options.captureHeaders'), (checked) => save({ captureHeaders: checked }));

  // --- limitler
  const maxLogEntries = numberField(t('options.maxLogEntries'), (value) => save({ maxLogEntries: value }));
  const maxInventoryItems = numberField(t('options.maxInventoryItems'), (value) => save({ maxInventoryItems: value }));
  const keepInventory = checkbox(t('options.keepInventory'), (checked) => save({ keepInventoryOnNavigate: checked }));

  // --- güvenlik
  const autoOffMinutes = numberField(t('options.autoOff'), (value) => save({ autoOffMinutes: value || null }));
  const productionGuard = checkbox(t('options.productionGuard'), (checked) => save({ productionGuard: checked }));
  const showPageBanner = checkbox(t('options.showPageBanner'), (checked) => save({ showPageBanner: checked }));
  const productionHostPatterns = h('textarea', {
    class: 'drsim-textarea',
    rows: '3',
    placeholder: t('options.productionHosts'),
    on: {
      change: () => save({
        productionHostPatterns: productionHostPatterns.value.split('\n').map((line) => line.trim()).filter(Boolean),
      }),
    },
  });

  // --- hard reset
  // Geri alınamaz olduğu için tek onay yeterli değil gibi görünebilir, ama
  // metin ne silineceğini kalem kalem sayıyor ve buton sayfanın en altında,
  // ayrı ve kırmızı duruyor — kazara tıklanacak bir yerde değil.
  const resetStatus = h('span', { class: 'drsim-hint', aria: { live: 'polite' } });

  const hardReset = async (): Promise<void> => {
    if (!window.confirm(t('options.resetConfirm'))) return;

    const result = await connection.send(COMMANDS.HARD_RESET);
    if (!result.ok) {
      setText(resetStatus, t('options.resetFailed'));
      return;
    }

    // Chrome bazı origin'lerin iznini bırakmayabilir; sessiz geçmek kullanıcıyı
    // "sıfırladım ama izin penceresi açılmıyor" çıkmazına sokuyordu
    const remaining = (result.data as { remainingOrigins?: string[] } | undefined)?.remainingOrigins ?? [];
    setText(
      resetStatus,
      remaining.length
        ? t('options.resetPartial', { origins: remaining.join(', ') })
        : t('options.resetDone'),
    );
  };

  // --- dil (Revizyon 41)
  const languageSelect = h('select', {
    class: 'drsim-select',
    dataset: { test: 'dr-sim-language' },
    on: { change: () => save({ locale: languageSelect.value as LocalePreference }) },
  }, [
    h('option', { value: 'auto', text: t('options.languageAuto') }),
    ...LOCALES.map((locale) => h('option', { value: locale, text: LANGUAGE_NAMES[locale] })),
  ]);

  mount.replaceChildren(
    h('h1', { class: 'drsim-header__title', text: t('options.title') }),
    // Kılavuz ve örnek profil ayrı sayfada (Revizyon 52): burası ayarlanacak
    // yüzey, orası okunacak içerik. Burada yalnızca kapı duruyor.
    section(t('options.guide'), [
      h('p', { class: 'drsim-hint', text: t('options.guideHint') }),
      h('div', { class: 'drsim-section__actions' }, [
        button(t('guide.open'), () => void openGuide(), {
          class: 'drsim-button drsim-button--compact',
          dataset: { test: 'dr-sim-open-guide' },
        }),
      ]),
    ]),
    section(t('options.fault'), [
      faultSelect,
      faultBodyRow,
      faultDelay.row,
      faultTimeout.row,
      h('p', { class: 'drsim-hint', text: t('options.faultHint') }),
    ]),
    section(t('options.rules'), [
      ruleSummary,
      ruleList,
      h('p', { class: 'drsim-hint', text: t('options.rulesHint') }),
    ]),
    section(t('options.normalization'), [numericId.row, uuid.row, longHex.row, customPatterns, preview]),
    section(t('options.capture'), [
      captureHeaders.row,
      h('p', { class: 'drsim-hint', text: t('options.privacyHint') }),
    ]),
    // Envanteri koruma seçeneği panelde bir düğme AÇIYOR (Revizyon 56); bunu
    // yazmazsak kullanıcı düğmenin nereden geldiğini bilmiyor.
    section(t('options.limits'), [
      maxLogEntries.row,
      maxInventoryItems.row,
      keepInventory.row,
      h('p', { class: 'drsim-hint', text: t('options.keepInventoryHint') }),
    ]),
    section(t('options.security'), [
      autoOffMinutes.row,
      h('p', { class: 'drsim-hint', text: t('options.autoOffHint') }),
      productionGuard.row,
      showPageBanner.row,
      productionHostPatterns,
    ]),
    section(t('options.language'), [
      h('label', { class: 'drsim-field' }, [
        h('span', { class: 'drsim-label', text: t('options.languageLabel') }),
        languageSelect,
      ]),
      h('p', { class: 'drsim-hint', text: t('options.languageHint') }),
    ]),
    section(t('options.shortcuts'), [
      button(t('options.editShortcuts'), () => {
        void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      }, { class: 'drsim-button drsim-button--compact' }),
    ]),
    // En altta ve tek kırmızı buton: yanlışlıkla tıklanacak bir yerde durmamalı
    section(t('options.reset'), [
      h('p', { class: 'drsim-hint', text: t('options.resetHint') }),
      h('div', { class: 'drsim-section__actions' }, [
        button(t('options.resetButton'), () => void hardReset(), {
          class: 'drsim-button drsim-button--compact drsim-button--danger',
          dataset: { test: 'dr-sim-hard-reset' },
        }),
        resetStatus,
      ]),
    ]),
    section(t('options.contact'), [
      h('p', { class: 'drsim-hint' }, [
        h('span', { text: t('options.contactHint') }),
        h('a', { class: 'drsim-link', href: 'mailto:typeandgo07@gmail.com', text: 'typeandgo07@gmail.com' }),
      ]),
      h('p', { class: 'drsim-hint', text: `© ${new Date().getFullYear()} typeandgo` }),
    ]),
  );

  let renderedRules = '';

  const renderRules = (rules: Settings['rules']): void => {
    const signature = rules.map((rule) => `${rule.key}:${rule.state}`).join('|');
    if (signature === renderedRules) return;
    renderedRules = signature;

    if (!rules.length) {
      ruleList.replaceChildren(h('li', { class: 'drsim-empty', text: t('options.rulesEmpty') }));
      return;
    }

    const sorted = [...rules].sort((a, b) => a.key.localeCompare(b.key));
    ruleList.replaceChildren(...sorted.map((rule) => h('li', { class: 'drsim-item' }, [
      h('div', { class: 'drsim-item__main' }, [
        h('span', { class: 'drsim-ep', text: rule.key }),
        h('div', { class: 'drsim-item__actions' }, [
          h('span', {
            class: rule.state === 'allow' ? 'drsim-tag drsim-tag--allow' : 'drsim-tag drsim-tag--block',
            text: t(rule.state === 'allow' ? 'common.allowed' : 'common.blocked'),
          }),
          button('✕', () => void connection.send(COMMANDS.REMOVE_RULE, { key: rule.key }), {
            class: 'drsim-button drsim-button--compact drsim-button--bare',
            title: t('options.ruleRemove'),
          }),
        ]),
      ]),
    ])));
  };

  return (state: UiState): void => {
    const { settings } = state;
    normalization = settings.normalization;

    if (faultSelect.value !== faultPresetId(settings.fault)) faultSelect.value = faultPresetId(settings.fault);
    if (document.activeElement !== faultBody && faultBody.value !== settings.fault.body) {
      faultBody.value = settings.fault.body;
    }
    if (document.activeElement !== faultDelay.input) faultDelay.input.value = String(settings.fault.delayMs);
    if (document.activeElement !== faultTimeout.input) faultTimeout.input.value = String(settings.fault.timeoutMs);
    faultBodyRow.hidden = settings.fault.kind !== 'http';
    faultTimeout.row.hidden = settings.fault.kind !== 'timeout';

    const allow = settings.rules.filter((rule) => rule.state === 'allow').length;
    const block = settings.rules.filter((rule) => rule.state === 'block').length;
    setText(ruleSummary, t('options.rulesSummary', { total: settings.rules.length, allow, block }));
    renderRules(settings.rules);

    numericId.input.checked = settings.normalization.numericId;
    uuid.input.checked = settings.normalization.uuid;
    longHex.input.checked = settings.normalization.longHex;
    if (document.activeElement !== customPatterns) {
      customPatterns.value = settings.normalization.customPatterns.join('\n');
    }
    updatePreview();

    captureHeaders.input.checked = settings.captureHeaders;

    maxLogEntries.input.value = String(settings.maxLogEntries);
    maxInventoryItems.input.value = String(settings.maxInventoryItems);
    keepInventory.input.checked = settings.keepInventoryOnNavigate;

    autoOffMinutes.input.value = String(settings.autoOffMinutes ?? 0);
    productionGuard.input.checked = settings.productionGuard;
    showPageBanner.input.checked = settings.showPageBanner;
    if (document.activeElement !== productionHostPatterns) {
      productionHostPatterns.value = settings.productionHostPatterns.join('\n');
    }

    if (languageSelect.value !== settings.locale) languageSelect.value = settings.locale;

  };
};

let sync: ((state: UiState) => void) | null = null;
let locale: Locale | null = null;

connection.store.subscribe((state) => {
  const next = localeOf(state.settings.locale);

  // Dil değişince tüm sayfa yeniden kurulur: etiketler mount anında yazıldığı için
  // tek tek güncellemek yerine DOM'u baştan üretmek hem daha kısa hem daha güvenli.
  if (!sync || locale !== next) {
    locale = next;
    // Belge dili ve sekme başlığı da çözülen dili izler (Y1)
    const t = translatorFor(state.settings.locale);
    document.documentElement.lang = next;
    document.title = t('options.title');
    sync = buildOptions(root, t);
  }

  sync(state);
});

window.addEventListener('pagehide', () => connection.destroy());
