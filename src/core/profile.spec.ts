import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { createTranslator } from './i18n';
import { buildProfileFile, profileFileName, slugify, snapshotProfile } from './profile';
import type { Profile, Rule, Settings } from './types';

const tr = createTranslator('tr');
const en = createTranslator('en');

const rule = (path: string): Rule => ({ path, state: 'allow', createdAt: 0 });

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  name: 'Ödeme kapalı',
  defaultPolicy: 'block',
  domains: [],
  rules: [rule('/a')],
  fault: DEFAULT_SETTINGS.fault,
  updatedAt: 7,
  ...over,
});

describe('core/profile', () => {
  describe('slugify', () => {
    it.each<[string, string]>([
      ['Ödeme kapalı', 'odeme-kapali'],
      ['DR Sample Scenario', 'dr-sample-scenario'],
      ['  çift   boşluk  ', 'cift-bosluk'],
      ['ĞIŞÜ', 'gisu'],
      ['!!!', ''],
    ])('%s -> %s', (input, expected) => {
      expect(slugify(input)).toBe(expected);
    });

    it('uzun adı kırpar', () => {
      expect(slugify('a'.repeat(60))).toHaveLength(40);
    });
  });

  describe('profileFileName', () => {
    it('profil adını dosya adına taşır', () => {
      expect(profileFileName(profile(), tr)).toBe('dr-sim-profil-odeme-kapali');
    });

    it('slug boş kalırsa yedek ada düşer', () => {
      expect(profileFileName(profile({ name: '???' }), tr)).toBe('dr-sim-profil-adsiz');
    });

    // Dosya adı arayüz dilini izler: İngilizce arayüzde Türkçe dosya inmemeli (Y1)
    it('dosya adı arayüz dilini izler', () => {
      expect(profileFileName(profile(), en)).toBe('dr-sim-profile-odeme-kapali');
      expect(profileFileName(profile({ name: '???' }), en)).toBe('dr-sim-profile-untitled');
    });
  });

  describe('buildProfileFile', () => {
    it('profili birebir serileştirir — içe aktarılan dosya aynen geri çıkar', () => {
      const source = profile();
      const file = buildProfileFile(source, tr);

      expect(file).toMatchObject({ extension: 'json', name: 'dr-sim-profil-odeme-kapali' });
      expect(JSON.parse(file.content)).toEqual(source);
    });
  });

  describe('snapshotProfile', () => {
    it('mevcut ayarların kurulum alanlarını kopyalar', () => {
      const now = 42;
      const snapshot = snapshotProfile(
        settings({ defaultPolicy: 'pass', rules: [rule('/b')] }),
        'current',
        'DR-SIM profili',
        now,
      );

      expect(snapshot).toMatchObject({
        id: 'current',
        name: 'DR-SIM profili',
        defaultPolicy: 'pass',
        updatedAt: now,
      });
      expect(snapshot.rules).toHaveLength(1);
    });

    it('anlık görüntü de aynı şemaya uyar — dışa aktarılıp geri okunabilir', () => {
      const snapshot = snapshotProfile(settings(), 'current', 'DR-SIM profili', 1);
      expect(JSON.parse(buildProfileFile(snapshot, tr).content)).toEqual(snapshot);
    });
  });
});
