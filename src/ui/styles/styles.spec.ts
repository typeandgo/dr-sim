import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Stil kuralları normalde testle korunmaz — ama bu kuralın yokluğu DAVRANIŞI
// bozuyor: `element.hidden = true` sessizce etkisiz kalıyor ve gizlenmesi
// gereken butonlar ekranda duruyor.
//
// Hiçbir bileşen testi bunu yakalayamaz: jsdom, içe aktarılan stil sayfalarının
// cascade'ini uygulamaz. Bu yüzden koruma kaynak seviyesinde.

const read = (file: string): string => readFileSync(resolve(process.cwd(), 'src/ui/styles', file), 'utf8');

describe('ui/styles', () => {
  it('[hidden] global olarak korunur — yoksa hidden özniteliği işlevsiz kalır', () => {
    expect(read('main.scss')).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  });

  it('literal hex yalnızca token dosyasındadır', () => {
    // Stylelint de zorluyor; burada niyeti kayda geçiriyoruz
    const offenders = ['main.scss', 'components.scss', '_mixins.scss']
      .filter((file) => /#[0-9a-f]{3,8}\b/i.test(read(file)));

    expect(offenders).toEqual([]);
  });
});
