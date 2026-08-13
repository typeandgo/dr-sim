import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { buildProfileFile, profileFileName, slugify, snapshotProfile } from './profile';
import type { Profile, Rule, Settings } from './types';

const rule = (key: string): Rule => ({
  key,
  method: 'GET',
  path: key.split(' ')[1] ?? '/',
  state: 'allow',
  source: 'inventory',
  createdAt: 0,
});

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  name: 'Ödeme kapalı',
  defaultPolicy: 'block',
  domains: [],
  rules: [rule('GET /a')],
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
      expect(profileFileName(profile())).toBe('dr-sim-profil-odeme-kapali');
    });

    it('slug boş kalırsa adsiz’e düşer', () => {
      expect(profileFileName(profile({ name: '???' }))).toBe('dr-sim-profil-adsiz');
    });
  });

  describe('buildProfileFile', () => {
    it('profili birebir serileştirir — içe aktarılan dosya aynen geri çıkar', () => {
      const source = profile();
      const file = buildProfileFile(source);

      expect(file).toMatchObject({ extension: 'json', name: 'dr-sim-profil-odeme-kapali' });
      expect(JSON.parse(file.content)).toEqual(source);
    });
  });

  describe('snapshotProfile', () => {
    it('mevcut ayarların kurulum alanlarını kopyalar', () => {
      const now = 42;
      const snapshot = snapshotProfile(
        settings({ defaultPolicy: 'pass', rules: [rule('GET /b')] }),
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
      expect(JSON.parse(buildProfileFile(snapshot).content)).toEqual(snapshot);
    });
  });
});
