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
import { hasOriginPermission, requestOriginPermission } from '../permissions';
import { faultPresetId, policySummary } from '../policy-text';
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

  // --- varsayılan davranış (Revizyon 19: panelden buraya taşındı)
  const policySummaryEl = h('p', { class: 'drsim-hint', aria: { live: 'polite' } });
  policySummaryEl.id = 'drsim-policy-summary';

  const policyRadio = (value: 'block' | 'pass', label: string): { row: HTMLElement; input: HTMLInputElement } => {
    const input = h('input', {
      type: 'radio',
      name: 'drsim-default-policy',
      value,
      on: {
        change: () => {
          void connection.send(COMMANDS.SET_DEFAULT_POLICY, { policy: value });
        },
      },
    });
    return { row: h('label', { class: 'drsim-radio' }, [input, h('span', { text: label })]), input };
  };

  const policyBlock = policyRadio('block', t('options.policyBlock'));
  const policyPass = policyRadio('pass', t('options.policyPass'));

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
  const captureBody = checkbox(t('options.captureBody'), (checked) => save({ captureBody: checked }));

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

  // --- dil (Revizyon 41)
  const languageSelect = h('select', {
    class: 'drsim-select',
    dataset: { test: 'dr-sim-language' },
    on: { change: () => save({ locale: languageSelect.value as LocalePreference }) },
  }, [
    h('option', { value: 'auto', text: t('options.languageAuto') }),
    ...LOCALES.map((locale) => h('option', { value: locale, text: LANGUAGE_NAMES[locale] })),
  ]);

  // --- site izinleri
  // Yedek yüzey: bazı Chrome sürümlerinde side panel'den izin dialogu açılmayabiliyor.
  const permissionList = h('ul', { class: 'drsim-list' });

  mount.replaceChildren(
    h('h1', { class: 'drsim-header__title', text: t('options.title') }),
    section(t('options.defaultBehaviour'), [
      h('div', {
        class: 'drsim-radio-group drsim-radio-group--stacked',
        role: 'radiogroup',
        dataset: { test: 'dr-sim-default-policy' },
        aria: { describedby: 'drsim-policy-summary', label: t('options.policyAria') },
      }, [policyBlock.row, policyPass.row]),
      policySummaryEl,
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
      captureBody.row,
      h('p', { class: 'drsim-hint', text: t('options.privacyHint') }),
    ]),
    section(t('options.limits'), [maxLogEntries.row, maxInventoryItems.row, keepInventory.row]),
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
    section(t('options.sitePermissions'), [
      h('p', { class: 'drsim-hint', text: t('options.permissionHint') }),
      permissionList,
    ]),
    section(t('options.shortcuts'), [
      button(t('options.editShortcuts'), () => {
        void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      }, { class: 'drsim-button drsim-button--compact' }),
    ]),
    section(t('options.contact'), [
      h('p', { class: 'drsim-hint' }, [
        h('span', { text: t('options.contactHint') }),
        h('a', { class: 'drsim-link', href: 'mailto:typeandgo@gmail.com', text: 'typeandgo@gmail.com' }),
      ]),
      h('p', { class: 'drsim-hint', text: `© ${new Date().getFullYear()} typeandgo` }),
    ]),
  );

  let renderedPermissions = '';
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

  const renderPermissions = (patterns: string[]): void => {
    const signature = patterns.join('|');
    if (signature === renderedPermissions) return;
    renderedPermissions = signature;

    if (!patterns.length) {
      permissionList.replaceChildren(h('li', { class: 'drsim-empty', text: t('options.permissionsEmpty') }));
      return;
    }

    permissionList.replaceChildren(...patterns.map((pattern) => {
      const status = h('span', { class: 'drsim-hint', text: t('options.permissionChecking') });

      const grant = button(t('common.allow'), () => {
        void requestOriginPermission(pattern).then((granted) => {
          setText(status, t(granted ? 'options.permissionGranted' : 'options.permissionRefused'));
          grant.hidden = granted;
        });
      }, { class: 'drsim-button drsim-button--compact' });

      void hasOriginPermission(pattern).then((granted) => {
        setText(status, t(granted ? 'options.permissionGranted' : 'options.permissionPending'));
        grant.hidden = granted;
      });

      return h('li', { class: 'drsim-item' }, [
        h('div', { class: 'drsim-item__main' }, [h('span', { class: 'drsim-ep', text: pattern }), grant]),
        status,
      ]);
    }));
  };

  return (state: UiState): void => {
    const { settings } = state;
    normalization = settings.normalization;

    policyBlock.input.checked = settings.defaultPolicy === 'block';
    policyPass.input.checked = settings.defaultPolicy === 'pass';
    setText(policySummaryEl, policySummary(settings, t));

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
    captureBody.input.checked = settings.captureBody;

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

    renderPermissions([
      ...settings.domains.map((domain) => domain.pattern),
      ...settings.pageHosts.map((host) => host.pattern),
    ]);
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
    sync = buildOptions(root, translatorFor(state.settings.locale));
  }

  sync(state);
});

window.addEventListener('pagehide', () => connection.destroy());
