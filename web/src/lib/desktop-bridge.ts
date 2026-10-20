import { appIsDesktopProduct } from '@/lib/app-runtime.js';
import type { BasisDesktopBridge } from '@/lib/app-runtime.js';

export function getBasisDesktopBridge(): BasisDesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__BASIS_DESKTOP__;
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

/**
 * macOS desktop shell: native traffic lights; brand + drag live in the sidebar header.
 * Falls back to `navigator.platform` when preload is missing (e.g. Vite desktop in a browser).
 */
export function isMacDesktop(): boolean {
  const fromPreload = getBasisDesktopBridge()?.isMac;
  if (fromPreload === true) return true;
  if (fromPreload === false) return false;
  return appIsDesktopProduct() && isMacPlatform();
}
