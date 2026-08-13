import type { Translate } from '@/core/i18n';
import type { Profile } from '@/core/types';

// Ayarlar'daki örnek profil şablonu (Revizyon 49).
//
// Gerçek `Profile` nesnesi olarak kurulur; dışa aktarma ile aynı `buildProfileFile`
// üzerinden indirilir. Böylece örnek, ürünün ürettiği biçimden ayrışamaz: şema
// değişirse bu dosya derlenmez.
//
// İçerik bilerek küçük ama üç şeyi birden gösterir: izinli kayıt, engelli kayıt ve
// `:id` ile normalize edilmiş bir path.

export const sampleProfile = (t: Translate): Profile => ({
  id: 'ornek-profil',
  name: t('sample.name'),
  defaultPolicy: 'block',
  domains: [{ id: 'd1', pattern: 'api.example.com' }],
  rules: [
    {
      key: 'GET /users/current',
      method: 'GET',
      path: '/users/current',
      state: 'allow',
      source: 'preset',
      note: t('sample.noteAllow'),
      createdAt: 0,
    },
    {
      key: 'GET /orders/:id/detail',
      method: 'GET',
      path: '/orders/:id/detail',
      state: 'allow',
      source: 'preset',
      note: t('sample.noteNormalized'),
      createdAt: 0,
    },
    {
      key: 'POST /payments/checkout',
      method: 'POST',
      path: '/payments/checkout',
      state: 'block',
      source: 'preset',
      note: t('sample.noteBlock'),
      createdAt: 0,
    },
  ],
  fault: {
    kind: 'http',
    status: 503,
    statusText: 'Service Unavailable',
    body: '{"message":"DR simulated unavailable"}',
    headers: {},
    delayMs: 0,
    timeoutMs: 30000,
  },
  updatedAt: 0,
});
