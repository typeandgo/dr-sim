import { COMMANDS, FAULT_PRESETS } from '@/core/constants';
import { normalizePath } from '@/core/path.util';
import type { FaultConfig, NormalizationRules, Settings } from '@/core/types';
import { button, h, setText } from '../dom/h';
import { hasOriginPermission, requestOriginPermission } from '../permissions';
import { faultPresetId, policySummary } from '../policy-text';
import { createConnection } from '../state/connection';
import '../styles/main.scss';
import '../styles/components.scss';

// 02-ui-spec.md §4 — options page bölümleri.

const root = document.getElementById('drsim-root');
if (!root) throw new Error('drsim-root bulunamadı');

const connection = createConnection();
const save = (patch: Partial<Settings>): void => {
  void connection.send(COMMANDS.UPDATE_SETTINGS, { settings: patch });
};

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

const policyBlock = policyRadio('block', 'Bloklansın — kural yazmadığım EP’ler arıza döner');
const policyPass = policyRadio('pass', 'Geçsin — kural yazmadığım EP’ler normal çalışır');

// --- arıza (Revizyon 23: panelden buraya taşındı)
// Bir DR turunda arıza tipi bir kez seçilir ve sabit kalır; panelde yer kaplamasın.
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

const faultDelay = numberField('Gecikme (ms)', (value) => setFault({ delayMs: value }));
const faultTimeout = numberField('Timeout (ms)', (value) => setFault({ timeoutMs: value || 30000 }));
const faultBodyRow = h('label', { class: 'drsim-field' }, [
  h('span', { class: 'drsim-label', text: 'Gövde (JSON)' }),
  faultBody,
]);
const faultHint = h('p', {
  class: 'drsim-hint',
  text: 'Bloklanan her istek bu şekilde başarısız olur. Paneldeki durum satırı seçili tipi yazar.',
});

// --- kurallar (Revizyon 20)
// DR senaryosu tekrarlanabilir olmalı: hangi EP'lere kural yazdığını görebilmeli,
// yanlış bir kaydı geri alabilmeli ve yeni bir tur için temiz sayfadan başlayabilmelisin.
const ruleSummary = h('p', { class: 'drsim-hint' });
const ruleList = h('ul', { class: 'drsim-list' });
// Panelde yapılabilen hiçbir iş burada tekrarlanmaz (Revizyon 38). Bu liste
// panelin ulaşamadığı şeyi gösterir: envanter yalnızca bu sayfada tetiklenen
// EP'leri bilir, buradaki kural listesi ise globaldir.
const ruleHint = h('p', {
  class: 'drsim-hint',
  text: 'Kural listesi globaldir: bir sayfada verdiğin izin diğer sayfalarda da geçerlidir. Toplu sıfırlama panelde.',
});
// --- normalizasyon
const numericId = checkbox('Sayısal id (/123 → /:id)', (checked) => saveNormalization({ numericId: checked }));
const uuid = checkbox('UUID', (checked) => saveNormalization({ uuid: checked }));
const longHex = checkbox('Uzun hex (8+ karakter)', (checked) => saveNormalization({ longHex: checked }));
const customPatterns = h('textarea', {
  class: 'drsim-textarea',
  rows: '3',
  placeholder: 'Her satıra bir regex — örn. ^u_[a-z0-9]+$',
  on: {
    change: () => saveNormalization({
      customPatterns: customPatterns.value.split('\n').map((line) => line.trim()).filter(Boolean),
    }),
  },
});
const preview = h('p', { class: 'drsim-hint' });

let normalization: NormalizationRules | null = null;

function saveNormalization(patch: Partial<NormalizationRules>): void {
  if (!normalization) return;
  const next = { ...normalization, ...patch };
  normalization = next;
  save({ normalization: next });
  updatePreview();
}

function updatePreview(): void {
  if (!normalization) return;
  setText(preview, `/items/8842/summary → ${normalizePath('/items/8842/summary', normalization)}`);
}

// --- gizlilik
const captureHeaders = checkbox('Header yakala', (checked) => save({ captureHeaders: checked }));
const captureBody = checkbox('Body yakala', (checked) => save({ captureBody: checked }));
const privacyHint = h('p', {
  class: 'drsim-hint',
  text: 'Yakalama açıkken authorization, cookie, token gibi alanlar maskelenir. Veri cihazdan çıkmaz.',
});

// --- limitler
const maxLogEntries = numberField('Max log kaydı', (value) => save({ maxLogEntries: value }));
const maxInventoryItems = numberField('Max envanter satırı', (value) => save({ maxInventoryItems: value }));
const keepInventory = checkbox('Navigasyonda envanteri koru', (checked) => save({ keepInventoryOnNavigate: checked }));

// --- güvenlik
const autoOffMinutes = numberField('Auto-off (dk) — 0 = kapalı', (value) => save({ autoOffMinutes: value || null }));
const autoOffHint = h('p', {
  class: 'drsim-hint',
  text: 'Varsayılan kapalı: simülasyon sen kapatana kadar açık kalır. Bir süre girersen o süre sonunda otomatik kapanır.',
});
const productionGuard = checkbox('Production guard', (checked) => save({ productionGuard: checked }));
const showPageBanner = checkbox('Sayfa bandını göster', (checked) => save({ showPageBanner: checked }));
const productionHostPatterns = h('textarea', {
  class: 'drsim-textarea',
  rows: '3',
  placeholder: 'Her satıra bir host pattern — örn. *.prod.*',
  on: {
    change: () => save({
      productionHostPatterns: productionHostPatterns.value.split('\n').map((line) => line.trim()).filter(Boolean),
    }),
  },
});

// --- site izinleri
// Yedek yüzey: bazı Chrome sürümlerinde side panel'den izin dialogu açılmayabiliyor.
// Options normal bir eklenti sekmesidir; kullanıcı hareketi burada her zaman geçerlidir.
const permissionList = h('ul', { class: 'drsim-list' });
const permissionHint = h('p', {
  class: 'drsim-hint',
  text: 'Panelden izin veremediysen buradan verebilirsin. İzin verdikten sonra hedef sayfayı yenile.',
});

// --- iletişim
const contact = h('p', { class: 'drsim-hint' }, [
  h('span', { text: 'Soru, öneri ve hata bildirimi için: ' }),
  h('a', { class: 'drsim-link', href: 'mailto:typeandgo@gmail.com', text: 'typeandgo@gmail.com' }),
]);

root.append(
  h('h1', { class: 'drsim-header__title', text: 'DR-SIM — Ayarlar' }),
  section('Varsayılan davranış', [
    h('div', {
      class: 'drsim-radio-group drsim-radio-group--stacked',
      role: 'radiogroup',
      dataset: { test: 'dr-sim-default-policy' },
      aria: { describedby: 'drsim-policy-summary', label: 'Varsayılan politika' },
    }, [policyBlock.row, policyPass.row]),
    policySummaryEl,
  ]),
  section('Arıza', [faultSelect, faultBodyRow, faultDelay.row, faultTimeout.row, faultHint]),
  section('Kurallar', [ruleSummary, ruleList, ruleHint]),
  section('Path normalizasyonu', [numericId.row, uuid.row, longHex.row, customPatterns, preview]),
  section('Yakalama ve gizlilik', [captureHeaders.row, captureBody.row, privacyHint]),
  section('Limitler', [maxLogEntries.row, maxInventoryItems.row, keepInventory.row]),
  section('Güvenlik', [autoOffMinutes.row, autoOffHint, productionGuard.row, showPageBanner.row, productionHostPatterns]),
  section('Site izinleri', [permissionHint, permissionList]),
  section('Kısayollar', [
    button('Kısayolları düzenle', () => {
      void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }, { class: 'drsim-button drsim-button--compact' }),
  ]),
  section('İletişim', [
    contact,
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
    ruleList.replaceChildren(h('li', { class: 'drsim-empty', text: 'Henüz kural yok.' }));
    return;
  }

  const sorted = [...rules].sort((a, b) => a.key.localeCompare(b.key));
  ruleList.replaceChildren(...sorted.map((rule) => h('li', { class: 'drsim-item' }, [
    h('div', { class: 'drsim-item__main' }, [
      h('span', { class: 'drsim-ep', text: rule.key }),
      h('div', { class: 'drsim-item__actions' }, [
        h('span', {
          class: rule.state === 'allow' ? 'drsim-tag drsim-tag--allow' : 'drsim-tag drsim-tag--block',
          text: rule.state === 'allow' ? 'izinli' : 'engelli',
        }),
        button('✕', () => void connection.send(COMMANDS.REMOVE_RULE, { key: rule.key }), {
          class: 'drsim-button drsim-button--compact drsim-button--bare',
          title: 'Kaydı sil — EP varsayılan davranışa döner',
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
    permissionList.replaceChildren(h('li', { class: 'drsim-empty', text: 'Henüz domain veya sayfa eklenmedi.' }));
    return;
  }

  permissionList.replaceChildren(...patterns.map((pattern) => {
    const status = h('span', { class: 'drsim-hint', text: 'kontrol ediliyor…' });

    const grant = button('İzin ver', () => {
      void requestOriginPermission(pattern).then((granted) => {
        setText(status, granted ? 'izinli' : 'izin verilmedi');
        grant.hidden = granted;
      });
    }, { class: 'drsim-button drsim-button--compact' });

    void hasOriginPermission(pattern).then((granted) => {
      setText(status, granted ? 'izinli' : 'izin bekliyor');
      grant.hidden = granted;
    });

    return h('li', { class: 'drsim-item' }, [
      h('div', { class: 'drsim-item__main' }, [h('span', { class: 'drsim-ep', text: pattern }), grant]),
      status,
    ]);
  }));
};

connection.store.subscribe((state) => {
  const { settings } = state;
  normalization = settings.normalization;

  policyBlock.input.checked = settings.defaultPolicy === 'block';
  policyPass.input.checked = settings.defaultPolicy === 'pass';
  setText(policySummaryEl, policySummary(settings));

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
  setText(ruleSummary, `${settings.rules.length} kural · ${allow} izinli · ${block} engelli`);
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

  renderPermissions([
    ...settings.domains.map((domain) => domain.pattern),
    ...settings.pageHosts.map((host) => host.pattern),
  ]);
});

window.addEventListener('pagehide', () => connection.destroy());
