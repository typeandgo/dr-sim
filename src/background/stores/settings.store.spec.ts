import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/core/constants';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import { createSettingsStore, migrate, normalizeSettings } from './settings.store';

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
      const result = normalizeSettings({ enabled: true, schemaVersion: 1 });
      expect(result.enabled).toBe(true);
      expect(result.defaultPolicy).toBe('block');
      expect(result.maxLogEntries).toBe(200);
    });

    it('tip uyuşmazlığında varsayılanı korur', () => {
      const result = normalizeSettings({ schemaVersion: 1, maxLogEntries: 'çok', rules: 'liste-değil' });
      expect(result.maxLogEntries).toBe(200);
      expect(result.rules).toEqual([]);
    });

    it('fault ve normalization alt alanlarını birleştirir', () => {
      const result = normalizeSettings({ schemaVersion: 1, fault: { status: 429 } });
      expect(result.fault).toMatchObject({ status: 429, statusText: 'Service Unavailable', kind: 'http' });
    });

    it('v0 verisini güncel sürüme migrate eder', () => {
      expect(migrate({ enabled: true }).schemaVersion).toBe(4);
      expect(normalizeSettings({ enabled: true }).schemaVersion).toBe(4);
    });

    it('v1 verisindeki DomainScope.enabled alanı düşürülür (Revizyon 3)', () => {
      const result = normalizeSettings({
        schemaVersion: 1,
        domains: [{ id: '1', pattern: 'a.com', enabled: false, granted: true }],
        pageHosts: [{ id: '2', pattern: 'b.com', enabled: true, granted: true }],
      });

      expect(result.domains[0]).toEqual({ id: '1', pattern: 'a.com', granted: true });
      expect(result.pageHosts[0]).toEqual({ id: '2', pattern: 'b.com', granted: true });
    });

    it('migration bozuk domain kaydında patlamaz', () => {
      const result = normalizeSettings({ schemaVersion: 1, domains: ['bozuk', null] });
      expect(result.domains).toEqual(['bozuk', null]);
    });

    it('v2 verisindeki 30 dk auto-off kapatılır (Revizyon 7)', () => {
      expect(normalizeSettings({ schemaVersion: 2, autoOffMinutes: 30 }).autoOffMinutes).toBeNull();
    });

    it('kullanıcının bilinçli seçtiği auto-off süresi korunur', () => {
      expect(normalizeSettings({ schemaVersion: 2, autoOffMinutes: 45 }).autoOffMinutes).toBe(45);
    });

    it('bilinmeyen sürümde zinciri durdurur', () => {
      expect(migrate({ schemaVersion: 99 }).schemaVersion).toBe(99);
    });
  });

  describe('store yaşam döngüsü', () => {
    it('depodaki ayarı yükler', async () => {
      chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] = { schemaVersion: 1, enabled: true };
      const store = createSettingsStore();
      const settings = await store.load();
      expect(settings.enabled).toBe(true);
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
