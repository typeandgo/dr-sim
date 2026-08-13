// Toolbar durum göstergesi — 02-ui-spec.md §2. Simülasyon açıkken kırmızı ON badge + aktif ikon.

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

export const updateBadge = async (enabled: boolean, blockedCount = 0): Promise<void> => {
  try {
    await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
    await chrome.action.setBadgeBackgroundColor({ color: ON_COLOR });
    await chrome.action.setIcon({ path: iconSet(enabled) });
    await chrome.action.setTitle({
      title: enabled ? `DR-SIM açık — ${blockedCount} istek bloklandı` : 'DR-SIM kapalı',
    });
  } catch {
    // badge güncellenemezse simülasyon yine de çalışır
  }
};
