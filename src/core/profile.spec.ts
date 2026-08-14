import { describe, expect, it } from 'vitest';
import { DEFAULT_FAULT, DEFAULT_SETTINGS } from './constants';
import { createTranslator } from './i18n';
import { buildProfileFile, profileFileName, profileToRules, slugify, snapshotProfile } from './profile';
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
  allow: ['/a'],
  block: [],
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
    it('profili dosya biçimine serileştirir — kurulum alanları aynen geçer', () => {
      const source = profile();
      const file = buildProfileFile(source, tr);

      expect(file).toMatchObject({ extension: 'json', name: 'dr-sim-profil-odeme-kapali' });
      expect(JSON.parse(file.content)).toEqual({
        name: source.name,
        defaultPolicy: source.defaultPolicy,
        domains: source.domains,
        allow: source.allow,
        block: source.block,
        fault: source.fault,
      });
    });

    it('dosyaya id ve updatedAt yazılmaz', () => {
      const file = buildProfileFile({
        id: 'p1',
        name: 'DR',
        defaultPolicy: 'pass',
        domains: ['api.x.com'],
        allow: ['/users/current'],
        block: ['/payments/checkout'],
        fault: DEFAULT_FAULT,
        updatedAt: 123,
      }, tr);

      const parsed = JSON.parse(file.content);

      expect(parsed).toEqual({
        name: 'DR',
        defaultPolicy: 'pass',
        domains: ['api.x.com'],
        allow: ['/users/current'],
        block: ['/payments/checkout'],
        fault: DEFAULT_FAULT,
      });
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
      expect(snapshot.allow).toEqual(['/b']);
      expect(snapshot.block).toEqual([]);
    });

    it('anlık görüntü de aynı şemaya uyar — dışa aktarılıp geri okunabilir', () => {
      const snapshot = snapshotProfile(settings(), 'current', 'DR-SIM profili', 1);
      expect(JSON.parse(buildProfileFile(snapshot, tr).content)).toEqual({
        name: snapshot.name,
        defaultPolicy: snapshot.defaultPolicy,
        domains: snapshot.domains,
        allow: snapshot.allow,
        block: snapshot.block,
        fault: snapshot.fault,
      });
    });

    it('anlık görüntü kuralları iki listeye ayırır ve domainleri stringe indirir', () => {
      const profile = snapshotProfile({
        ...DEFAULT_SETTINGS,
        domains: [{ id: 'd1', pattern: 'api.x.com', granted: true }],
        rules: [
          { path: '/users/current', state: 'allow', createdAt: 0 },
          { path: '/payments/checkout', state: 'block', createdAt: 0 },
        ],
      }, 'p1', 'DR', 5);

      expect(profile.allow).toEqual(['/users/current']);
      expect(profile.block).toEqual(['/payments/checkout']);
      expect(profile.domains).toEqual(['api.x.com']);
    });
  });

  describe('profileToRules', () => {
    it('path listelerini kural kayıtlarına çevirir', () => {
      const rules = profileToRules(profile({ allow: ['/users/current'], block: ['/payments/checkout'] }), 99);

      expect(rules).toEqual([
        { path: '/users/current', state: 'allow', createdAt: 99 },
        { path: '/payments/checkout', state: 'block', createdAt: 99 },
      ]);
    });

    it('path normalize edilir — değişken segment :id olur', () => {
      expect(profileToRules(profile({ allow: ['/orders/8842/detail'], block: [] }), 0)[0]?.path)
        .toBe('/orders/:id/detail');
    });

    // Dosya elle yazılabilir olmalı: tek bozuk satır dosyanın tamamını düşürmez
    it('geçersiz path atlanır, geçerliler kalır', () => {
      const rules = profileToRules(profile({ allow: ['/*', '', '   ', '/ok'], block: ['/*'] }), 1);

      expect(rules).toEqual([{ path: '/ok', state: 'allow', createdAt: 1 }]);
    });

    it('iki listede birden geçen path block olur', () => {
      expect(profileToRules(profile({ allow: ['/x'], block: ['/x'] }), 1))
        .toEqual([{ path: '/x', state: 'block', createdAt: 1 }]);
    });

  });
});
