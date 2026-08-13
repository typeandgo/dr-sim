import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/core/constants';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';

// Kılavuz sayfasının duman testi: sayfa kendi kendine kuruluyor mu, dil tercihi
// storage'dan okunuyor mu, ayrı sayfaya taşınan iki içerik de yerinde mi.

let chromeMock: ChromeMock;

const mount = async (locale?: string): Promise<void> => {
  document.body.replaceChildren();
  const root = document.createElement('div');
  root.id = 'drsim-root';
  document.body.appendChild(root);

  if (locale) {
    chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] = { locale };
  }

  vi.resetModules();
  await import('./main');
  // storage okuması asenkron; mikro görev kuyruğunun boşalmasını bekle
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.drsim-section').length).toBeGreaterThan(0);
  });
};

beforeEach(() => {
  chromeMock = installChromeMock();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('ui/guide/main', () => {
  it('kılavuz bölümlerini ve örnek profili aynı sayfada kurar', async () => {
    await mount();

    const titles = [...document.querySelectorAll('.drsim-section__title')].map((node) => node.textContent);
    expect(titles).toContain('Sample profile');

    // Kılavuz bölümleri ve alan sözlüğü grupları katlanır bloklar
    expect(document.querySelectorAll('.drsim-guide__chapter').length).toBeGreaterThan(8);

    // Örnek profil JSON'ı gerçek üreticiden geçmiş olmalı
    const code = document.querySelector('.drsim-code')?.textContent ?? '';
    expect(JSON.parse(code)).toMatchObject({ defaultPolicy: 'block' });

    // Alan sözlüğü satırları
    expect(document.querySelectorAll('.drsim-schema__key').length).toBeGreaterThan(10);
  });

  it('dil tercihi storage’dan okunur ve belge diline yazılır', async () => {
    await mount('tr');

    expect(document.documentElement.lang).toBe('tr');
    expect(document.title).toBe('DR-SIM — Kılavuz');

    const titles = [...document.querySelectorAll('.drsim-section__title')].map((node) => node.textContent);
    expect(titles).toContain('Örnek profil');
  });

  it('tercih yoksa İngilizceye düşer', async () => {
    await mount();

    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('DR-SIM — Guide');
  });

  // Sayfa saatlerce açık kalabilir; port açmak service worker'ı ayakta tutardı
  it('service worker’a port açmaz', async () => {
    await mount();

    expect(chromeMock.runtime.connect).not.toHaveBeenCalled();
  });

  it('ayarlardan dil değişince sayfayı yeniden kurar', async () => {
    await mount();
    expect(document.documentElement.lang).toBe('en');

    chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] = { locale: 'tr' };
    chromeMock.storage.onChanged.emit({ [STORAGE_KEYS.SETTINGS]: {} } as never, 'local' as never);

    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe('tr');
    });
  });
});
