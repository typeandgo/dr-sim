import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import { GUIDE_PATH, openGuide } from './open-guide';

let chromeMock: ChromeMock;

const URL = `chrome-extension://drsim/${GUIDE_PATH}`;

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock = installChromeMock();
});

describe('ui/open-guide', () => {
  it('kılavuz açık değilse yeni sekmede açar', async () => {
    await openGuide();

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: URL });
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  // Panelden birkaç kez tıklamak sekme yığmamalı
  it('açık kılavuz sekmesi varsa yenisini açmaz, mevcut olanı öne getirir', async () => {
    chromeMock.tabs.query.mockResolvedValueOnce([{ id: 7, windowId: 3 }] as never);

    await openGuide();

    expect(chromeMock.tabs.create).not.toHaveBeenCalled();
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chromeMock.windows.update).toHaveBeenCalledWith(3, { focused: true });
  });

  it('sekmenin penceresi bilinmiyorsa yalnızca sekme öne getirilir', async () => {
    chromeMock.tabs.query.mockResolvedValueOnce([{ id: 7 }] as never);

    await openGuide();

    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chromeMock.windows.update).not.toHaveBeenCalled();
  });

  it('sekme API’si hata verirse sessiz geçer — panel çalışmaya devam eder', async () => {
    chromeMock.tabs.query.mockRejectedValueOnce(new Error('no permission'));

    await expect(openGuide()).resolves.toBeUndefined();
  });
});
