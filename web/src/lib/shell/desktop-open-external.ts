import { getBasisDesktopBridge } from '@/lib/shell/desktop-bridge.js';

export async function openDesktopExternalUrl(url: string): Promise<void> {
  const bridge = getBasisDesktopBridge();
  if (bridge?.openExternal) {
    await bridge.openExternal(url);
    return;
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
