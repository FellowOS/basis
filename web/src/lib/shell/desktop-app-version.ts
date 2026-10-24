import { getBasisDesktopBridge } from '@/lib/shell/desktop-bridge.js';

/** Packaged Electron version (preload) or desktop Vite build define. */
export function getDesktopAppVersion(): string | null {
  const fromBridge = getBasisDesktopBridge()?.appVersion?.trim();
  if (fromBridge) return fromBridge;
  const fromEnv = (import.meta.env.VITE_BASIS_APP_VERSION as string | undefined)?.trim();
  return fromEnv || null;
}
