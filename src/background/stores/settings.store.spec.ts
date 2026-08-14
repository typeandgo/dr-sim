import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, STORAGE_KEYS } from '@/core/constants';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import { createSettingsStore, normalizeSettings } from './settings.store';

let chromeMock: ChromeMock;

describe('background/settings.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    chromeMock = installChromeMock();
  });

  describe('normalizeSettings', () => {
    it('bozuk veride varsayılana döner', () => {
      expect(normalizeSettings('bozuk')).toEqual(DEFAULT_SETTINGS);
      expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    });

    it('eksik alanları varsayılanla tamamlar', () => {
      const result = normalizeSettings({ enabled: true, schemaVersion: SCHEMA_VERSION });
      expect(result.enabled).toBe(true);
      expect(result.defaultPolicy).toBe('block');
      expect(result.maxLogEntries).toBe(200);
    });

    it('tip uyuşmazlığında varsayılanı korur', () => {
      const result = normalizeSettings({ schemaVersion: SCHEMA_VERSION, maxLogEntries: 'çok', rules: 'liste-değil' });
      expect(result.maxLogEntries).toBe(200);
      expect(result.rules).toEqual([]);
    });

    it('fault ve normalization alt alanlarını birleştirir', () => {
      const result = normalizeSettings({ schemaVersion: SCHEMA_VERSION, fault: { status: 429 } });
      expect(result.fault).toMatchObject({ status: 429, statusText: 'Service Unavailable', kind: 'http' });
    });

    // Revizyon 60: göç zinciri yok. Ürün kararı — eski sürümden gelen kullanıcı
    // her şeye son biçimle sıfırdan başlar; geriye dönük dönüşüm kodu tutulmuyor.
    it('şema sürümü tutmayan kayıt tamamen atılır', () => {
      const eski = {
        schemaVersion: 4,
        enabled: true,
        domains: [{ id: 'd1', pattern: 'api.x.com', granted: true }],
        rules: [{ key: 'GET /x', method: 'GET', path: '/x', state: 'block', source: 'preset', createdAt: 5 }],
        profiles: [{ id: 'p1', name: 'DR', rules: [{ path: '/x', state: 'block' }] }],
        maxLogEntries: 42,
      };

      expect(normalizeSettings(eski)).toEqual(DEFAULT_SETTINGS);
    });

    it('şema sürümü hiç olmayan kayıt da atılır', () => {
      expect(normalizeSettings({ enabled: true, maxLogEntries: 42 })).toEqual(DEFAULT_SETTINGS);
    });

    it('ileri bir şema sürümü de atılır — aşağı uyumluluk da yok', () => {
      expect(normalizeSettings({ schemaVersion: 99, enabled: true })).toEqual(DEFAULT_SETTINGS);
    });

    it('güncel şemadaki kayıt olduğu gibi okunur', () => {
      const result = normalizeSettings({ schemaVersion: SCHEMA_VERSION, enabled: true, maxLogEntries: 42 });

      expect(result.enabled).toBe(true);
      expect(result.maxLogEntries).toBe(42);
    });
  });

  describe('reset', () => {
    it('varsayılana döner ve kalıcı kaydı siler', async () => {
      const store = createSettingsStore();
      await store.load();
      await store.update({ enabled: true, defaultPolicy: 'pass', rules: [], locale: 'tr' });

      const result = await store.reset();

      expect(result).toEqual(DEFAULT_SETTINGS);
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
      expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(STORAGE_KEYS.SETTINGS);
    });

    // İptal edilmezse debounce'lu yazma temizlikten sonra tetiklenip
    // eski ayarları geri yazardı — sıfırlama sessizce geri alınırdı
    it('bekleyen yazmayı iptal eder, eski ayarlar geri gelmez', async () => {
      const store = createSettingsStore();
      await store.load();
      await store.update({ defaultPolicy: 'pass' });

      await store.reset();
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS]).toBeUndefined();
      expect(store.get().defaultPolicy).toBe('block');
    });

    it('revizyon artar — açık paneller yeni durumu alır', async () => {
      const store = createSettingsStore();
      await store.load();
      const before = store.revision();

      await store.reset();

      expect(store.revision()).toBeGreaterThan(before);
    });

    it('depo silinemezse kullanıcıya bildirilir', async () => {
      const store = createSettingsStore();
      await store.load();
      chromeMock.storage.local.remove.mockRejectedValueOnce(new Error('dolu'));

      await store.reset();

      expect(store.notice()).toBe('settings-write');
    });
  });

  describe('store yaşam döngüsü', () => {
    it('depodaki ayarı yükler', async () => {
      chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] = { schemaVersion: SCHEMA_VERSION, enabled: true };
      const store = createSettingsStore();
      const settings = await store.load();
      expect(settings.enabled).toBe(true);
    });

    // Sıfırlama sessiz olmamalı: kullanıcı domainlerini, kurallarını ve
    // profillerini kaybediyor, sebebini panelde görmeli.
    it('eski şemadaki kayıt atılır ve kullanıcıya bildirilir', async () => {
      chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] = {
        schemaVersion: 4,
        enabled: true,
        domains: [{ id: 'd1', pattern: 'api.x.com', granted: true }],
      };
      const store = createSettingsStore();
      const settings = await store.load();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(store.notice()).toBe('settings-reset');
    });

    it('güncel şemadaki kayıt bildirim üretmez', async () => {
      chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] = { schemaVersion: SCHEMA_VERSION, enabled: true };
      const store = createSettingsStore();
      await store.load();

      expect(store.notice()).toBeNull();
    });

    it('ikinci load cache’ten döner', async () => {
      const store = createSettingsStore();
      await store.load();
      await store.load();
      expect(chromeMock.storage.local.get).toHaveBeenCalledTimes(1);
    });

    it('okuma hatasında varsayılana döner ve bildirim üretir', async () => {
      chromeMock.storage.local.get.mockRejectedValueOnce(new Error('bozuk'));
      const store = createSettingsStore();
      await store.load();
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
      expect(store.notice()).toBe('settings-read');
      store.clearNotice();
      expect(store.notice()).toBeNull();
    });

    it('güncelleme revizyonu artırır ve aboneyi tetikler', async () => {
      const store = createSettingsStore();
      await store.load();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      const before = store.revision();

      await store.update({ enabled: true });

      expect(store.get().enabled).toBe(true);
      expect(store.revision()).toBe(before + 1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      await store.update({ enabled: false });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('dinleyici hatası diğerlerini durdurmaz', async () => {
      const store = createSettingsStore();
      await store.load();
      const healthy = vi.fn();
      store.subscribe(() => {
        throw new Error('patladı');
      });
      store.subscribe(healthy);

      await store.update({ enabled: true });
      expect(healthy).toHaveBeenCalled();
    });

    it('mutate ile kural listesi güncellenir', async () => {
      const store = createSettingsStore();
      await store.load();
      await store.mutate((current) => ({ ...current, defaultPolicy: 'pass' }));
      expect(store.get().defaultPolicy).toBe('pass');
    });

    it('flush yazmayı zorlar', async () => {
      const store = createSettingsStore();
      await store.load();
      await store.update({ enabled: true });
      await store.flush();

      expect(chromeMock.storage.local.set).toHaveBeenCalled();
      const written = chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] as { enabled: boolean };
      expect(written.enabled).toBe(true);
    });

    it('yazma hatası bildirime dönüşür', async () => {
      chromeMock.storage.local.set.mockRejectedValueOnce(new Error('dolu'));
      const store = createSettingsStore();
      await store.load();
      await store.update({ enabled: true });
      await store.flush();
      expect(store.notice()).toBe('settings-write');
    });
  });
});
