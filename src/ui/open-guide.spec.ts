import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES } from '@/core/i18n';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import { GUIDE_URLS, guideUrl, openGuide } from './open-guide';

let chromeMock: ChromeMock;

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock = installChromeMock();
});

describe('ui/open-guide', () => {
  // Kılavuz eklenti paketinden çıkıp depoya taşındı (Revizyon 58): artık
  // `chrome-extension://` değil, dile göre iki ayrı GitHub adresi var.
  it('her dil için bir kılavuz adresi vardır', () => {
    LOCALES.forEach((locale) => {
      expect(guideUrl(locale)).toMatch(/^https:\/\/github\.com\/.+\/docs\/guide(\.tr)?\.md$/);
    });

    expect(new Set(Object.values(GUIDE_URLS)).size).toBe(LOCALES.length);
  });

  it('arayüz dilindeki kılavuzu açar', async () => {
    await openGuide('tr');

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: GUIDE_URLS.tr });

    await openGuide('en');

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: GUIDE_URLS.en });
  });

  it('kılavuz açık değilse yeni sekmede açar', async () => {
    await openGuide('en');

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: GUIDE_URLS.en });
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  // Panelden birkaç kez tıklamak sekme yığmamalı
  it('açık kılavuz sekmesi varsa yenisini açmaz, mevcut olanı öne getirir', async () => {
    chromeMock.tabs.query.mockResolvedValueOnce([{ id: 7, windowId: 3 }] as never);

    await openGuide('en');

    expect(chromeMock.tabs.create).not.toHaveBeenCalled();
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chromeMock.windows.update).toHaveBeenCalledWith(3, { focused: true });
  });

  it('sekmenin penceresi bilinmiyorsa yalnızca sekme öne getirilir', async () => {
    chromeMock.tabs.query.mockResolvedValueOnce([{ id: 7 }] as never);

    await openGuide('en');

    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chromeMock.windows.update).not.toHaveBeenCalled();
  });

  it('sekme API’si hata verirse sessiz geçer — panel çalışmaya devam eder', async () => {
    chromeMock.tabs.query.mockRejectedValueOnce(new Error('no permission'));

    await expect(openGuide('en')).resolves.toBeUndefined();
  });
});
