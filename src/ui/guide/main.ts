import { STORAGE_KEYS } from '@/core/constants';
import type { Locale, LocalePreference, Translate } from '@/core/i18n';
import { buildProfileFile } from '@/core/profile';
import { button, h, setText } from '../dom/h';
import { localeOf, translatorFor } from '../locale';
import { GUIDE, type GuideBlock } from './guide';
import { PROFILE_FIELDS, type FieldRow } from './profile-fields';
import { sampleProfile } from './sample-profile';
import '../styles/main.scss';
import '../styles/components.scss';

// Kılavuz sayfası — Ayarlar'dan ayrıldı (Revizyon 52).
//
// Gerekçe: kılavuz ve örnek profil OKUNACAK içerik, Ayarlar ise AYARLANACAK
// yüzey. İkisi aynı sayfadayken bir ayarı değiştirmek isteyen kullanıcı önce
// uzun bir metnin yanından geçmek zorunda kalıyordu.
//
// PORT AÇMAZ: Ayarlar ve panel `createConnection()` ile SW'ye bağlanır; açık
// bir port service worker'ı ayakta tutar. Bu sayfa saatlerce açık kalabilecek
// bir okuma yüzeyi olduğu için yalnızca dil tercihini storage'dan okur ve
// değişimi `storage.onChanged` ile izler.

const root = document.getElementById('drsim-root');
if (!root) throw new Error('drsim-root not found');

const download = (content: string, name: string): void => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url });
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

// Kılavuz bölüm bölüm açılır: kapsamlı bir metni tek blokta göstermek yerine
// başlıklar içindekiler gibi çalışsın, kullanıcı ihtiyacı olanı açsın (Revizyon 47).
const renderGuideBlock = (block: GuideBlock): HTMLElement => {
  if (block.kind === 'note') return h('p', { class: 'drsim-guide__note', text: block.text });
  if (block.kind === 'steps') {
    return h('ol', { class: 'drsim-guide__steps' }, block.items.map((item) => h('li', { text: item })));
  }
  if (block.kind === 'list') {
    return h('ul', { class: 'drsim-guide__list' }, block.items.map((item) => h('li', { text: item })));
  }
  if (block.kind === 'terms') {
    return h('ul', { class: 'drsim-guide__list' }, block.items.map((item) => h('li', {}, [
      h('span', { class: 'drsim-guide__term', text: item.term }),
      h('span', { text: ` — ${item.desc}` }),
    ])));
  }
  return h('p', { class: 'drsim-guide__text', text: block.text });
};

const renderGuide = (locale: Locale): HTMLElement => h('div', { class: 'drsim-guide' }, GUIDE[locale]
  .map((chapter) => h('details', { class: 'drsim-guide__chapter' }, [
    h('summary', { class: 'drsim-guide__summary', text: chapter.title }),
    h('div', { class: 'drsim-guide__body' }, chapter.blocks.map(renderGuideBlock)),
  ])));

// Profil JSON'ının alan sözlüğü — örnekle aynı kutuda, onun devamı olarak durur
const renderFieldRow = (row: FieldRow, t: Translate): HTMLElement => h('div', { class: 'drsim-schema__row' }, [
  h('div', { class: 'drsim-schema__head' }, [
    h('code', { class: 'drsim-schema__key', text: row.name }),
    h('span', {
      class: row.required ? 'drsim-tag drsim-tag--manual' : 'drsim-tag',
      text: t(row.required ? 'guide.schemaRequired' : 'guide.schemaOptional'),
    }),
    h('span', { class: 'drsim-schema__type', text: row.type }),
  ]),
  h('p', { class: 'drsim-schema__desc', text: row.desc }),
]);

const renderFields = (locale: Locale, t: Translate): HTMLElement => h('div', { class: 'drsim-guide' }, PROFILE_FIELDS[locale]
  .map((group) => h('details', { class: 'drsim-guide__chapter' }, [
    h('summary', { class: 'drsim-guide__summary' }, [
      h('code', { class: 'drsim-schema__path', text: group.path }),
      h('span', { text: ` ${group.title}` }),
    ]),
    h('div', { class: 'drsim-guide__body' }, [
      h('p', { class: 'drsim-guide__note', text: group.intro }),
      h('div', { class: 'drsim-schema' }, group.rows.map((row) => renderFieldRow(row, t))),
    ]),
  ])));

const section = (title: string, children: HTMLElement[]): HTMLElement => h('section', { class: 'drsim-section' }, [
  h('div', { class: 'drsim-section__head' }, [h('span', { class: 'drsim-section__title', text: title })]),
  ...children,
]);

const build = (t: Translate, locale: Locale): void => {
  const sampleFile = buildProfileFile(sampleProfile(t), t);
  const sampleStatus = h('span', { class: 'drsim-hint', aria: { live: 'polite' } });

  document.documentElement.lang = locale;
  document.title = t('guide.title');

  root.replaceChildren(
    h('h1', { class: 'drsim-header__title', text: t('guide.title') }),
    h('p', { class: 'drsim-hint', text: t('guide.pageHint') }),

    section(t('options.guide'), [renderGuide(locale)]),

    section(t('guide.sample'), [
      h('p', { class: 'drsim-hint', text: t('guide.sampleHint') }),
      h('pre', { class: 'drsim-code', text: sampleFile.content }),
      h('p', { class: 'drsim-hint', text: t('guide.sampleScenarios') }),
      h('div', { class: 'drsim-section__actions' }, [
        button(t('guide.sampleDownload'), () => download(sampleFile.content, `${sampleFile.name}.${sampleFile.extension}`), {
          class: 'drsim-button drsim-button--compact',
          dataset: { test: 'dr-sim-sample-download' },
        }),
        button(t('guide.sampleCopy'), () => {
          void navigator.clipboard?.writeText(sampleFile.content).then(() => {
            setText(sampleStatus, t('guide.sampleCopied'));
          });
        }, { class: 'drsim-button drsim-button--compact' }),
        sampleStatus,
      ]),
      // Alan sözlüğü örnekle AYNI kutuda: ikisi tek konu — yukarıdaki dosyanın
      // okunması. Ayrı kutu, sözlüğü bağımsız bir referans gibi gösteriyordu.
      h('p', { class: 'drsim-label drsim-section__subtitle', text: t('guide.schema') }),
      h('p', { class: 'drsim-hint', text: t('guide.schemaHint') }),
      renderFields(locale, t),
    ]),

    section(t('options.title'), [
      h('p', { class: 'drsim-hint', text: t('guide.toSettingsHint') }),
      h('div', { class: 'drsim-section__actions' }, [
        button(t('common.settings'), () => chrome.runtime.openOptionsPage(), {
          class: 'drsim-button drsim-button--compact',
        }),
      ]),
    ]),
  );
};

// Dil tercihini okur; bozuk/eksik değer 'auto'ya düşer (ayar şemasının tamamını
// buraya taşımaya gerek yok — bu sayfanın ihtiyacı olan tek alan bu).
const readLocalePreference = async (): Promise<LocalePreference> => {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = stored[STORAGE_KEYS.SETTINGS] as { locale?: unknown } | undefined;
    return settings?.locale === 'en' || settings?.locale === 'tr' ? settings.locale : 'auto';
  } catch {
    return 'auto';
  }
};

let current: Locale | null = null;

const render = (preference: LocalePreference): void => {
  const next = localeOf(preference);
  if (current === next) return;
  current = next;
  build(translatorFor(preference), next);
};

void readLocalePreference().then(render);

// Ayarlar'dan dil değiştirilirse bu sayfa da tazelenir
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
  void readLocalePreference().then(render);
});
