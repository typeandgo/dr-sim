import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SW_MESSAGES } from '@/core/constants';
import type { RuntimeConfig } from '@/core/types';
import { createEvent, installChromeMock, type ChromeMock } from '@/test/chrome-mock';

// Sayfa bandı, `closed` shadow root içinde durur; dışarıdan sorgulanamaz.
// Bu yüzden testler bandın metnini modülün kendi davranışı üzerinden doğrular:
// SW yeni config gönderdiğinde metin tazeleniyor mu?

const BANNER_ID = 'drsim-page-banner';

const config = (over: Partial<RuntimeConfig> = {}): RuntimeConfig => ({
  enabled: true,
  defaultPolicy: 'block',
  domains: ['api.example.com'],
  rulesByKey: {},
  fault: DEFAULT_SETTINGS.fault,
  normalization: DEFAULT_SETTINGS.normalization,
  captureHeaders: false,
  showPageBanner: true,
  bannerText: 'DR-SIM aktif',
  revision: 1,
  ...over,
});

let chromeMock: ChromeMock;
let onMessage: ReturnType<typeof createEvent>;

// `closed` shadow root'a dışarıdan erişilemez (jsdom'da da). Bandın metnini
// doğrulayabilmek için `attachShadow` sarmalanır ve üretilen kök yakalanır.
let shadowRoots: ShadowRoot[] = [];
const nativeAttachShadow = Element.prototype.attachShadow;

const bannerText = (): string | null => {
  if (!document.getElementById(BANNER_ID)) return null;
  return shadowRoots.at(-1)?.textContent ?? null;
};

const load = async (): Promise<void> => {
  vi.resetModules();
  await import('./bridge.content');
};

const push = (next: RuntimeConfig): void => {
  onMessage.emit({ type: SW_MESSAGES.CONFIG_UPDATED, config: next } as never);
};

describe('content/bridge — sayfa bandı', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.getElementById(BANNER_ID)?.remove();

    shadowRoots = [];
    Element.prototype.attachShadow = function attachShadow(this: Element, init: ShadowRootInit) {
      const root = nativeAttachShadow.call(this, init);
      shadowRoots.push(root);
      return root;
    };

    chromeMock = installChromeMock();
    onMessage = createEvent();
    chromeMock.runtime.connect.mockReturnValue({
      name: 'drsim-content',
      onMessage,
      onDisconnect: createEvent(),
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    } as never);
  });

  afterEach(() => {
    Element.prototype.attachShadow = nativeAttachShadow;
    document.getElementById(BANNER_ID)?.remove();
  });

  it('simülasyon açıkken band basılır', async () => {
    await load();
    push(config());

    expect(bannerText()).toBe('DR-SIM aktif');
  });

  it('kapalıyken band basılmaz', async () => {
    await load();
    push(config({ enabled: false }));

    expect(document.getElementById(BANNER_ID)).toBeNull();
  });

  it('band ayarı kapalıysa basılmaz', async () => {
    await load();
    push(config({ showPageBanner: false }));

    expect(document.getElementById(BANNER_ID)).toBeNull();
  });

  it('domain yoksa basılmaz', async () => {
    await load();
    push(config({ domains: [] }));

    expect(document.getElementById(BANNER_ID)).toBeNull();
  });

  it('dil değişince bandın metni tazelenir, sayfa yenilenmesi gerekmez (Revizyon 51)', async () => {
    await load();
    push(config({ bannerText: 'DR-SIM aktif' }));
    push(config({ bannerText: 'DR-SIM active', revision: 2 }));

    expect(bannerText()).toBe('DR-SIM active');
    // Metin tazelenir ama band yeniden kurulmaz: tek host, tek shadow root
    expect(document.querySelectorAll(`#${BANNER_ID}`)).toHaveLength(1);
    expect(shadowRoots).toHaveLength(1);
  });

  it('simülasyon kapanınca band kaldırılır, tekrar açılınca geri gelir', async () => {
    await load();
    push(config());
    expect(document.getElementById(BANNER_ID)).not.toBeNull();

    push(config({ enabled: false, revision: 2 }));
    expect(document.getElementById(BANNER_ID)).toBeNull();

    push(config({ revision: 3 }));
    expect(document.getElementById(BANNER_ID)).not.toBeNull();
  });
});
