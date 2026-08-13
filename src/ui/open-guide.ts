// Kılavuz ayrı bir eklenti sayfasıdır; hem panelin header'ından hem Ayarlar'dan
// buradan açılır.
//
// Neden `<a href>` değil: side panel'de bağlantıya tıklamak panelin KENDİSİNİ
// gezdirir, kullanıcı çalışma yüzeyini kaybeder. Bu yüzden her zaman yeni sekme.
//
// Açık bir kılavuz sekmesi varsa yenisi açılmaz, mevcut olan öne getirilir —
// panelden birkaç kez tıklamak sekme yığmasın.
export const GUIDE_PATH = 'ui/guide/index.html';

export const openGuide = async (): Promise<void> => {
  try {
    const url = chrome.runtime.getURL(GUIDE_PATH);
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
