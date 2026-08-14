import type { Locale } from '@/core/i18n';

// Kılavuz artık eklenti paketinde DEĞİL, depoda duruyor (Revizyon 58).
//
// Gerekçe: kılavuz okunacak bir metin, eklenti ise çalıştırılacak bir araç.
// Paketin içindeyken her yazım düzeltmesi yeni bir sürüm yayını gerektiriyordu
// ve metin yalnızca eklentiyi kurmuş kişiye görünüyordu. Depoda GitHub kendi
// içindekiler menüsünü, geçmişini ve arama kutusunu bedavaya veriyor.
//
// Neden `<a href>` değil: side panel'de bağlantıya tıklamak panelin KENDİSİNİ
// gezdirir, kullanıcı çalışma yüzeyini kaybeder. Bu yüzden her zaman yeni sekme.
//
// Açık bir kılavuz sekmesi varsa yenisi açılmaz, mevcut olan öne getirilir —
// panelden birkaç kez tıklamak sekme yığmasın.

export const GUIDE_URLS: Record<Locale, string> = {
  en: 'https://github.com/typeandgo/dr-sim/blob/main/docs/guide.md',
  tr: 'https://github.com/typeandgo/dr-sim/blob/main/docs/guide.tr.md',
};

export const guideUrl = (locale: Locale): string => GUIDE_URLS[locale] ?? GUIDE_URLS.en;

export const openGuide = async (locale: Locale): Promise<void> => {
  try {
    const url = guideUrl(locale);
    const [existing] = await chrome.tabs.query({ url });

    if (existing?.id !== undefined) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId !== undefined) {
        await chrome.windows?.update(existing.windowId, { focused: true });
      }
      return;
    }

    await chrome.tabs.create({ url });
  } catch {
    // sekme açılamazsa panel çalışmaya devam eder
  }
};
