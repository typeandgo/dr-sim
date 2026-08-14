import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, DEFAULT_SETTINGS } from '@/core/constants';
import { createTranslator } from '@/core/i18n';
import type { InventoryItem, Settings, UiState } from '@/core/types';
import { emptyState } from '../state/connection';
import { mountInventory } from './inventory';
import type { ComponentContext } from './types';

// Kural 400: DOM ağacı değil, gönderilen komut ve payload doğrulanır.

const item = (over: Partial<InventoryItem> = {}): InventoryItem => ({
  key: '/offers',
  path: '/offers',
  methods: ['GET'],
  sampleUrl: 'https://api.x.com/offers',
  count: 2,
  lastAt: 1,
  lastStatus: 200,
  lastDurationMs: 10,
  successCount: 2,
  failCount: 0,
  simulatedCount: 0,
  lastReason: 'allowed',
  origin: 'fetch',
  frameId: 0,
  ...over,
});

const state = (settings: Partial<Settings> = {}, items: InventoryItem[] = [item()]): UiState => ({
  ...emptyState(),
  settings: { ...DEFAULT_SETTINGS, ...settings },
  session: {
    ...emptyState().session!,
    tabId: 1,
    origin: 'https://app.x.com',
    routePath: '/home',
    title: '',
    inventory: Object.fromEntries(items.map((entry) => [entry.key, entry])),
    successLog: [],
    failLog: [],
    outOfScopeCount: 0,
    droppedCount: 0,
    blockedSinceLoad: 0,
    loadedAt: 0,
    updatedAt: 0,
  },
});

const t = createTranslator('tr');

const setup = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx: ComponentContext = { send: vi.fn(async () => ({ ok: true })), notify: vi.fn(), t, locale: 'tr' };
  return { root, ctx, component: mountInventory(root, ctx) };
};

const toggleOf = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-test="dr-sim-state-toggle"]')!;

describe('ui/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  // Revizyon 56: envanter normalde her sayfa yüklemesinde kendiliğinden
  // sıfırlanıyor, o yüzden "Temizle" gereksiz bir düğmeydi. Ama
  // `keepInventoryOnNavigate` açıkken sıfırlama YAPILMIYOR ve envanteri
  // boşaltmanın başka yolu kalmıyor — düğme yalnızca o durumda görünür.
  describe('Temizle düğmesi', () => {
    const clearOf = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>('[data-test="dr-sim-clear-inventory"]')!;

    it('otomatik sıfırlama açıkken gizlidir', () => {
      const { root, component } = setup();
      component.update(state({ keepInventoryOnNavigate: false }));

      expect(clearOf(root).hidden).toBe(true);
    });

    it('envanter korunuyorken ve silinecek kayıt varken görünür', () => {
      const { root, component } = setup();
      component.update(state({ keepInventoryOnNavigate: true }));

      expect(clearOf(root).hidden).toBe(false);
    });

    it('envanter boşken görünmez — temizlenecek bir şey yok', () => {
      const { root, component } = setup();
      component.update(state({ keepInventoryOnNavigate: true }, []));

      expect(clearOf(root).hidden).toBe(true);
    });

    it('ayar kapatılınca tekrar gizlenir', () => {
      const { root, component } = setup();

      component.update(state({ keepInventoryOnNavigate: true }));
      component.update(state({ keepInventoryOnNavigate: false }));

      expect(clearOf(root).hidden).toBe(true);
    });

    it('basınca CLEAR_INVENTORY gider', () => {
      const { root, ctx, component } = setup();
      component.update(state({ keepInventoryOnNavigate: true }));

      clearOf(root).click();

      expect(ctx.send).toHaveBeenCalledWith(COMMANDS.CLEAR_INVENTORY);
    });
  });

  // Revizyon 57: envanter yalnızca sayfa trafiğinden dolduğu için eski
  // "envanter"/"manuel" çifti her satırda aynı sabit metni yazıyordu: ayrımı
  // taşıyan `manual` alanını hiçbir yer true yapmıyordu, o yüzden alan da
  // silindi. Etiket artık gerçek bir soruya cevap veriyor: bu EP profilimde
  // tanımlı mı, yoksa sayfada yeni mi bulundu?
  describe('kaynak etiketi', () => {
    const tagsOf = (root: HTMLElement): string[] => [...root.querySelectorAll('.drsim-tags .drsim-tag')]
      .map((tag) => tag.textContent ?? '');

    const profile = (paths: string[]): Partial<Settings> => ({
      activeProfileId: 'p1',
      profiles: [{
        id: 'p1',
        name: 'DR',
        defaultPolicy: 'block',
        domains: [],
        fault: DEFAULT_SETTINGS.fault,
        updatedAt: 0,
        rules: paths.map((path) => ({ path, state: 'block' as const, createdAt: 0 })),
      }],
    });

    it('profilde tanımlı EP "profil" etiketi taşır', () => {
      const { root, component } = setup();
      component.update(state(profile(['/offers'])));

      expect(tagsOf(root)).toContain('profil');
      expect(tagsOf(root)).not.toContain('sayfa');
    });

    it('profilde olmayan EP "sayfa" etiketi taşır', () => {
      const { root, component } = setup();
      component.update(state(profile(['/baska'])));

      expect(tagsOf(root)).toContain('sayfa');
      expect(tagsOf(root)).not.toContain('profil');
    });

    it('etkin profil yokken her satır "sayfa" olur', () => {
      const { root, component } = setup();
      component.update(state());

      expect(tagsOf(root)).toContain('sayfa');
    });

    it('profil değişince etiket tazelenir', () => {
      const { root, component } = setup();

      component.update(state(profile(['/offers'])));
      expect(tagsOf(root)).toContain('profil');

      component.update(state(profile([])));
      expect(tagsOf(root)).toContain('sayfa');
    });

    // Koşulu durum satırındaki "simüle" ile birebir aynıydı — aynı bilgi
    // aynı satırda iki kez duruyordu.
    it('"simüle fail" etiketi artık yazılmaz, bilgi durum satırında kalır', () => {
      const { root, component } = setup();
      component.update(state({}, [item({ simulatedCount: 3 })]));

      expect(tagsOf(root)).not.toContain('simüle fail');
      expect(root.querySelector('.drsim-item__status')!.textContent).toContain('simüle');
    });

    it('xhr ve sync XHR etiketleri korunur', () => {
      const { root, component } = setup();
      component.update(state({}, [item({ origin: 'xhr', lastReason: 'sync-xhr' })]));

      expect(tagsOf(root)).toEqual(['sayfa', 'GET', 'xhr', 'sync XHR']);
    });

    it('satır path yazar, method’lar etiket olarak durur', () => {
      const { root, component } = setup();
      component.update(state({}, [item({ methods: ['GET', 'POST'] })]));

      expect(root.querySelector('.drsim-ep')!.textContent).toBe('/offers');
      expect(tagsOf(root)).toEqual(['sayfa', 'GET', 'POST']);
    });
  });

  it('toggle TOGGLE_RULE_STATE komutunu path ile gönderir', () => {
    const { root, ctx, component } = setup();
    component.update(state());

    toggleOf(root).click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.TOGGLE_RULE_STATE, { path: '/offers' });
  });

  it('varsayılan politikaya göre efektif durumu gösterir', () => {
    const { root, component } = setup();

    component.update(state({ defaultPolicy: 'block' }));
    expect(toggleOf(root).textContent).toBe('Engelli');
    expect(toggleOf(root).getAttribute('aria-checked')).toBe('false');

    component.update(state({ defaultPolicy: 'pass' }));
    expect(toggleOf(root).textContent).toBe('İzinli');
  });

  it('açık kayıt ile varsayılana tabi satırı görsel olarak ayırır', () => {
    const { root, component } = setup();

    component.update(state({ defaultPolicy: 'block' }));
    const row = root.querySelector<HTMLElement>('[data-test="dr-sim-inventory-item"]')!;
    expect(row.className).toContain('drsim-item--default-blocked');

    component.update(state({
      defaultPolicy: 'block',
      rules: [{ path: '/offers', state: 'block', createdAt: 0 }],
    }));
    expect(row.className).toContain('drsim-item--blocked');
    expect(row.className).not.toContain('drsim-item--default-blocked');
  });

  it('engelli / toplam sayacını yazar', () => {
    const { root, component } = setup();
    component.update(state({ defaultPolicy: 'block' }, [item(), item({ key: '/b', path: '/b' })]));

    expect(root.textContent).toContain('Sayfa EP Envanteri (2 engelli / 2)');
  });

  it('kopyala butonu yoktur (Revizyon 18)', () => {
    const { root, component } = setup();
    component.update(state());

    const actions = root.querySelector<HTMLElement>('.drsim-item__actions')!;
    expect([...actions.children].map((el) => el.getAttribute('data-test')))
      .toEqual(['dr-sim-state-toggle', 'dr-sim-rule-remove']);
  });

  it('✕ kaydı olmayan satırda da görünür ve çerçevelidir (Revizyon 26)', () => {
    const { root, component } = setup();

    component.update(state());
    const remove = root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!;
    expect(remove.hidden).toBe(false);
    expect(remove.className).not.toContain('drsim-button--bare');

    component.update(state({
      rules: [{ path: '/offers', state: 'allow', createdAt: 0 }],
    }));
    expect(root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!.hidden).toBe(false);
  });

  it('kaydı olmayan satırda ✕ etkisizdir — komut gitse de satır varsayılanda kalır', () => {
    const { root, ctx, component } = setup();
    component.update(state({ defaultPolicy: 'block' }));

    root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.REMOVE_RULE, { path: '/offers' });
    const row = root.querySelector<HTMLElement>('[data-test="dr-sim-inventory-item"]')!;
    expect(row.className).toContain('drsim-item--default-blocked');
  });

  it('✕ kaydı siler, EP varsayılan davranışa döner', () => {
    const { root, ctx, component } = setup();
    component.update(state({
      rules: [{ path: '/offers', state: 'allow', createdAt: 0 }],
    }));

    root.querySelector<HTMLElement>('[data-test="dr-sim-rule-remove"]')!.click();

    expect(ctx.send).toHaveBeenCalledWith(COMMANDS.REMOVE_RULE, { path: '/offers' });
  });

  it('ham örnek URL satırda yazılmaz, hover’da kalır (Revizyon 17)', () => {
    const { root, component } = setup();
    component.update(state());

    const row = root.querySelector<HTMLElement>('[data-test="dr-sim-inventory-item"]')!;
    expect(row.textContent).not.toContain('https://api.x.com/offers');
    expect(row.title).toBe('https://api.x.com/offers');
  });

  it('boş envanterde mevcut metni korur', () => {
    const { root, component } = setup();
    component.update(state({}, []));

    expect(root.textContent).toContain('Henüz istek yok. Sayfayı yenile veya etkileşim yap.');
  });

  it('update iki kez aynı state ile çağrılınca satır düğümü korunur (idempotent)', () => {
    const { root, component } = setup();
    component.update(state());
    const first = root.querySelector('[data-test="dr-sim-inventory-item"]');
    component.update(state());

    expect(root.querySelector('[data-test="dr-sim-inventory-item"]')).toBe(first);
  });

  it('destroy DOM’u bırakır', () => {
    const { root, component } = setup();
    component.update(state());
    component.destroy();

    expect(root.children).toHaveLength(0);
  });
});
