// Toolbar durum göstergesi. Simülasyon açıkken kırmızı ON badge + aktif ikon.

const ON_COLOR = '#b91c1c';

const iconSet = (active: boolean): Record<number, string> => {
  const prefix = active ? 'icons/icon-active' : 'icons/icon';
  return {
    16: `${prefix}-16.png`,
    32: `${prefix}-32.png`,
    48: `${prefix}-48.png`,
    128: `${prefix}-128.png`,
  };
};

// Başlık metni SW'den hazır gelir: sözlük core'da, badge yalnızca chrome API sarmalayıcısı
export const updateBadge = async (enabled: boolean, title: string): Promise<void> => {
  try {
    await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
    await chrome.action.setBadgeBackgroundColor({ color: ON_COLOR });
    await chrome.action.setIcon({ path: iconSet(enabled) });
    await chrome.action.setTitle({ title });
  } catch {
    // badge güncellenemezse simülasyon yine de çalışır
  }
};
