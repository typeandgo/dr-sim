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
      expect(migrate({ enabled: true }).schemaVersion).toBe(5);
      expect(normalizeSettings({ enabled: true }).schemaVersion).toBe(5);
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

    it('v5: kurallar path’e iner, çakışan durumda block kazanır', () => {
      const migrated = migrate({
        schemaVersion: 4,
        rules: [
          { key: 'GET /orders', method: 'GET', path: '/orders', state: 'allow', source: 'manual', note: 'x', createdAt: 100 },
          { key: 'POST /orders', method: 'POST', path: '/orders', state: 'block', source: 'preset', createdAt: 50 },
          { key: 'GET /users', method: 'GET', path: '/users', state: 'allow', source: 'manual', createdAt: 200 },
        ],
      });

      expect(migrated.schemaVersion).toBe(5);
      expect(migrated.rules).toEqual([
        { path: '/orders', state: 'block', createdAt: 50 },
        { path: '/users', state: 'allow', createdAt: 200 },
      ]);
    });

    it('v5: kural listesi yoksa boş dizi üretir', () => {
      expect(migrate({ schemaVersion: 4 }).rules).toEqual([]);
    });
  });

  // v4'te KAYITLI PROFİLLER de dönüşmeli. Atlandıklarında profil `allow`/`block`
  // taşımadığı için `applyProfile` ham TypeError fırlatıyor, `buildProfileFile`
  // ise `JSON.stringify` bu anahtarları atladığı için kural listesini SESSİZCE
  // düşürüyordu: kullanıcı dosyayı indiriyor, dosya boş çıkıyor ve geri
  // yüklenemiyordu. Yayındaki her 1.0.1 kurulumu bu durumdaydı.
  describe('v5 migration — kayıtlı profiller', () => {
    const v4Profile = {
      id: 'p1',
      name: 'DR — ödeme',
      defaultPolicy: 'pass',
      domains: [{ id: 'd1', pattern: 'api.sirket.com', granted: true }],
      rules: [
        { key: 'GET /orders', method: 'GET', path: '/orders', state: 'allow', source: 'manual', note: 'x', createdAt: 100 },
        { key: 'GET /users/current', method: 'GET', path: '/users/current', state: 'allow', source: 'preset', createdAt: 200 },
        { key: 'POST /payments', method: 'POST', path: '/payments', state: 'block', source: 'manual', createdAt: 50 },
      ],
      fault: { kind: 'http', status: 503 },
      updatedAt: 1234,
    };

    const migrateProfiles = (profiles: unknown): Record<string, unknown>[] => migrate({ schemaVersion: 4, profiles })
      .profiles as Record<string, unknown>[];

    it('v4 profilindeki rules[] allow/block listelerine iner ve alan düşer', () => {
      const [profile] = migrateProfiles([v4Profile]);

      expect(profile).toEqual({
        id: 'p1',
        name: 'DR — ödeme',
        defaultPolicy: 'pass',
        domains: ['api.sirket.com'],
        allow: ['/orders', '/users/current'],
        block: ['/payments'],
        fault: { kind: 'http', status: 503 },
        updatedAt: 1234,
      });
      expect(profile).not.toHaveProperty('rules');
    });

    // `granted` makineye özeldir; profile taşınmaz, izin uygulama anında ölçülür
    it('domains nesne dizisinden string dizisine iner, granted taşınmaz', () => {
      const [profile] = migrateProfiles([{ ...v4Profile, domains: [{ id: 'd1', pattern: 'a.com', granted: true }, { id: 'd2', pattern: 'b.com' }] }]);

      expect(profile?.domains).toEqual(['a.com', 'b.com']);
    });

    it('aynı path iki durumda geçerse block kazanır, createdAt en eskiden devralınır', () => {
      const [profile] = migrateProfiles([{
        ...v4Profile,
        rules: [
          { key: 'GET /orders', method: 'GET', path: '/orders', state: 'allow', createdAt: 100 },
          { key: 'POST /orders', method: 'POST', path: '/orders', state: 'block', createdAt: 50 },
        ],
      }]);

      expect(profile?.allow).toEqual([]);
      expect(profile?.block).toEqual(['/orders']);
    });

    it('zaten yeni biçimdeki profil ikinci kez dönüştürülmez — liste boşalmaz', () => {
      const current = {
        id: 'p2',
        name: 'yeni biçim',
        defaultPolicy: 'block',
        domains: ['api.x.com'],
        allow: ['/a'],
        block: ['/b'],
        fault: { kind: 'http' },
        updatedAt: 9,
      };

      const once = migrateProfiles([current]);
      const twice = migrateProfiles(once);

      expect(once).toEqual([current]);
      expect(twice).toEqual([current]);
    });

    it('tek liste taşıyan yeni biçimli profilde eksik liste boş dizi olur', () => {
      const [profile] = migrateProfiles([{ id: 'p3', name: 'tek liste', block: ['/b'] }]);

      expect(profile).toMatchObject({ allow: [], block: ['/b'] });
    });

    it('bozuk profil verisinde patlamaz', () => {
      expect(migrate({ schemaVersion: 4, profiles: 'dizi-değil' }).profiles).toEqual([]);
      expect(migrate({ schemaVersion: 4 }).profiles).toEqual([]);
      // nesne olmayan kayıtlar düşer: `profiles.find(entry => entry.id === id)` onlarda patlardı
      expect(migrateProfiles([null, 'metin', 42, []])).toEqual([]);
    });

    it('eksik ve bozuk alanlar boş listeye iner, kayıt yine de kurtarılır', () => {
      const [profile] = migrateProfiles([{
        id: 'p4',
        name: 'bozuk',
        rules: 'dizi-değil',
        domains: [null, 42, { id: 'd1' }, 'a.com'],
      }]);

      expect(profile).toEqual({ id: 'p4', name: 'bozuk', domains: ['a.com'], allow: [], block: [] });
    });

    it('path taşımayan kural kaydı atlanır', () => {
      const [profile] = migrateProfiles([{
        id: 'p5',
        rules: [null, { method: 'GET' }, { path: 42 }, { path: '/ok', state: 'block' }],
      }]);

      expect(profile).toMatchObject({ allow: [], block: ['/ok'] });
    });

    // Depodan okunan yol da doğrulanır: `normalizeSettings` yalnızca `Array.isArray`
    // baktığı için eski biçimli profiller eskiden buradan olduğu gibi geçiyordu.
    it('normalizeSettings üzerinden okunan v4 profili de yeni biçimde çıkar', () => {
      const [profile] = normalizeSettings({ schemaVersion: 4, profiles: [v4Profile] }).profiles;

      expect(profile?.allow).toEqual(['/orders', '/users/current']);
      expect(profile?.block).toEqual(['/payments']);
      expect(profile?.domains).toEqual(['api.sirket.com']);
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
