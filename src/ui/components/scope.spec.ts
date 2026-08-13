import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { Settings, UiState } from '@/core/types';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import { emptyState } from '../state/connection';
import { mountScope } from './scope';
import type { ComponentContext } from './types';

// KRİTİK: `chrome.permissions.request()` yalnızca kullanıcı hareketi bağlamında çalışır.
// Service worker'da gesture yoktur → çağrı fırlatır ve izin dialogu HİÇ açılmaz.
// Bu yüzden izin isteği UI'daki tıklama handler'ından yapılmalıdır.

let chromeMock: ChromeMock;

const state = (settings: Partial<Settings> = {}, tabUrl = 'http://localhost:5174/'): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...settings },
  tabUrl,
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t, locale: 'tr' };
  return { root, ctx, component: mountScope(root, ctx) };
};

const click = (root: HTMLElement, test: string): void => {
  root.querySelector<HTMLElement>(`[data-test="${test}"]`)!.click();
};

const flush = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('ui/scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
    chromeMock = installChromeMock();
  });

  it('izin isteği UI tıklamasından yapılır (SW’de gesture yok)', async () => {
    const { root, ctx, component } = setup();
    component.update(state());

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'localhost:5175';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ origins: ['*://localhost/*'] });
    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.ADD_DOMAIN, { pattern: 'localhost:5175' });
  });

  it('aktif sayfa kapsam dışıysa domain ile birlikte TEK dialogda istenir (Revizyon 8)', async () => {
    const { root, ctx, component } = setup();
    component.update(state({}, 'https://panel.example.com/portfoy'));

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'api.example.com';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(chromeMock.permissions.request).toHaveBeenCalledTimes(1);
    expect(chromeMock.permissions.request).toHaveBeenCalledWith({
      origins: ['*://api.example.com/*', '*://panel.example.com/*'],
    });
    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.ADD_PAGE_HOST, { pattern: 'panel.example.com' });
  });

  it('aktif sayfa zaten kapsamdaysa yalnızca domain izni istenir', async () => {
    const { root, ctx, component } = setup();
    component.update(state({
      pageHosts: [{ id: '1', pattern: 'panel.example.com', granted: true }],
    }, 'https://panel.example.com/portfoy'));

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'api.example.com';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ origins: ['*://api.example.com/*'] });
    expect(ctx.send).not.toHaveBeenCalledWith(COMMANDS.ADD_PAGE_HOST, expect.anything());
  });

  it('aynı origin ikinci bir dialog açmaz — izinler tekilleştirilir', async () => {
    const { root, component } = setup();
    component.update(state({}, 'https://api.example.com/app'));

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'api.example.com';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(chromeMock.permissions.request).toHaveBeenCalledTimes(1);
    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ origins: ['*://api.example.com/*'] });
  });

  // Kullanıcı bildirimi: fixture'da ilk sayfada pill hiç eklenmiyordu.
  // Sebep: `*://localhost/*` iki portu da kapsadığı için "kayda gerek yok"
  // deniyordu — ama o zaman panelde hangi sayfada çalıştığı görünmüyordu.
  it('port farkı olan sayfa da kaydedilir (fixture senaryosu)', async () => {
    const { root, ctx, component } = setup();
    component.update(state({}, 'http://localhost:7174/'));

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'localhost:7175';
    click(root, 'dr-sim-domain-add');
    await flush();

    // Tek dialog: iki host da `*://localhost/*` origin'ine düşer
    expect(chromeMock.permissions.request).toHaveBeenCalledTimes(1);
    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ origins: ['*://localhost/*'] });

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.ADD_DOMAIN, { pattern: 'localhost:7175' });
    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.ADD_PAGE_HOST, { pattern: 'localhost:7174' });
  });

  it('zaten kayıtlı sayfa ikinci kez eklenmez', async () => {
    const { root, ctx, component } = setup();
    component.update(state({
      pageHosts: [{ id: '1', pattern: 'localhost:7174', granted: true }],
    }, 'http://localhost:7174/'));

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'localhost:7175';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(ctx.send).not.toHaveBeenCalledWith(COMMANDS.ADD_PAGE_HOST, expect.anything());
  });

  it('desteklenmeyen sekmede sayfa izni istenmez', async () => {
    const { root, ctx, component } = setup();
    component.update(state({}, 'chrome://extensions/'));

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'api.example.com';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ origins: ['*://api.example.com/*'] });
    expect(ctx.send).not.toHaveBeenCalledWith(COMMANDS.ADD_PAGE_HOST, expect.anything());
  });

  it('izin reddedilirse komut gönderilmez ve sebep gösterilir', async () => {
    chromeMock.permissions.request.mockResolvedValueOnce(false);
    const { root, ctx, component } = setup();
    component.update(state());

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'api.example.com';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(ctx.send).not.toHaveBeenCalled();
    expect(root.textContent).toContain('izin verilmedi');
  });

  it('geçersiz domain izin bile istemez', async () => {
    const { root, ctx, component } = setup();
    component.update(state());

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'a b c';
    click(root, 'dr-sim-domain-add');
    await flush();

    expect(chromeMock.permissions.request).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('"Bu sayfada çalıştır" aktif sekme origin’i için izin ister', async () => {
    const { root, ctx, component } = setup();
    component.update(state());

    click(root, 'dr-sim-enable-page');
    await flush();

    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ origins: ['*://localhost/*'] });
    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.ADD_PAGE_HOST, { pattern: 'localhost:5174' });
  });

  it('sayfa kapsam dışıysa uyarı ve aksiyon görünür', () => {
    const { root, component } = setup();
    component.update(state());

    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-enable-page"]')!.hidden).toBe(false);
    expect(root.textContent).toContain('enjekte edilmiyor');
  });

  it('sayfa zaten kapsamdaysa uyarı gizlenir', () => {
    const { root, component } = setup();
    component.update(state({
      pageHosts: [{ id: '1', pattern: 'localhost:5174', granted: true }],
    }));

    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-enable-page"]')!.hidden).toBe(true);
  });

  it('aktif sayfa tek satırda tam adres gösterir (Revizyon 9)', () => {
    const { root, component } = setup();
    component.update({
      ...state({}, 'https://panel.example.com/portfoy/123/detay'),
      session: {
        tabId: 1,
        documentId: 'doc',
        origin: 'https://panel.example.com',
        routePath: '/portfoy/123/detay',
        title: '',
        inventory: {},
        successLog: [],
        failLog: [],
        outOfScopeCount: 0,
        droppedCount: 0,
        blockedSinceLoad: 0,
        loadedAt: 0,
        updatedAt: 0,
      },
    });

    const routeEl = root.querySelector<HTMLElement>('[data-test="dr-sim-route"]')!;
    expect(routeEl.textContent).toBe('https://panel.example.com/portfoy/123/detay');
    // Ayrı bir kısmi path satırı kalmadı
    expect([...root.querySelectorAll('p, button')].filter((el) => el.textContent === '/portfoy/123/detay')).toHaveLength(0);
  });

  it('oturum yokken sekme URL’i gösterilir', () => {
    const { root, component } = setup();
    component.update(state({}, 'https://panel.example.com/giris'));

    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-route"]')!.textContent)
      .toBe('https://panel.example.com/giris');
  });

  it('domain yoksa uyarı metni görünür', () => {
    const { root, component } = setup();
    component.update(state());

    expect(root.textContent).toContain('Domain girilmeden hiçbir istek yönetilmez');
  });

  it('boş hata ve chip listeleri akıştan çıkarılır (Revizyon 10)', () => {
    const { root, component } = setup();
    component.update(state());

    // Aralarına görünmez boşluk koymasınlar diye hidden olmalılar
    expect(root.querySelectorAll<HTMLElement>('.drsim-hint--error')[0]!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-domain-chips"]')!.hidden).toBe(true);
  });

  it('domain eklendiğinde chip listesi görünür, uyarı gizlenir', () => {
    const { root, component } = setup();
    component.update(state({ domains: [{ id: '1', pattern: 'api.example.com', granted: true }] }));

    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-domain-chips"]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-domain-empty"]')!.hidden).toBe(true);
  });

  // Bu buton kullanıcıyı yanılttı: izin verilmiş bir domainin yanında görünürse
  // "eklendi ama izin yok" izlenimi verir. Üç durumun üçü de kilitleniyor.
  describe('erişim ver butonu', () => {
    const grantButton = (root: HTMLElement): HTMLElement => root
      .querySelector<HTMLElement>('[data-test="dr-sim-domain-grant"]')!;

    it('izin verilmişken gizlidir', () => {
      const { root, component } = setup();
      component.update(state({ domains: [{ id: '1', pattern: 'api.example.com', granted: true }] }));

      expect(grantButton(root).hidden).toBe(true);
      expect(root.querySelector<HTMLElement>('[data-test="dr-sim-permission-lost"]')!.hidden).toBe(true);
    });

    it('izin hiç sorulmamışken de gizlidir', () => {
      const { root, component } = setup();
      component.update(state({ domains: [{ id: '1', pattern: 'api.example.com' }] }));

      expect(grantButton(root).hidden).toBe(true);
    });

    it('yalnızca erişim geri alınmışsa görünür ve uyarı satırı çıkar', () => {
      const { root, component } = setup();
      component.update(state({ domains: [{ id: '1', pattern: 'api.example.com', granted: false }] }));

      expect(grantButton(root).hidden).toBe(false);
      expect(root.querySelector('.drsim-chip')!.classList.contains('drsim-chip--pending')).toBe(true);

      const lost = root.querySelector<HTMLElement>('[data-test="dr-sim-permission-lost"]')!;
      expect(lost.hidden).toBe(false);
      expect(lost.textContent).toContain('Erişim ver');
    });

    // Son Fail'lerdeki hızlı izin butonu da "İzin ver" yazıyor; ikisi aynı anda
    // görününce hangisinin ne yaptığı anlaşılmıyordu
    it('etiketi Son Fail’lerdeki “İzin ver” ile karışmaz', () => {
      const { root, component } = setup();
      component.update(state({ domains: [{ id: '1', pattern: 'api.example.com', granted: false }] }));

      expect(grantButton(root).textContent).toBe('Erişim ver');
    });
  });

  it('hata mesajı yalnızca hata varken görünür', async () => {
    const { root, component } = setup();
    component.update(state());

    root.querySelector<HTMLInputElement>('[data-test="dr-sim-domain-input"]')!.value = 'a b c';
    click(root, 'dr-sim-domain-add');
    await flush();

    const errorEl = root.querySelectorAll<HTMLElement>('.drsim-hint--error')[0]!;
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toContain('Geçersiz domain');
  });
});
