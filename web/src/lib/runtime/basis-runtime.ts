/** Deployment/runtime flags (ADR 0004 desktop; Fellow getRuntime alignment). */

export type { AppRuntime, BasisEnvironment } from '@/lib/runtime/app-runtime.js';
export { appAuthRequired, appIsDesktopProduct, getAppRuntime } from '@/lib/runtime/app-runtime.js';

import { appAuthRequired, appIsDesktopProduct } from '@/lib/runtime/app-runtime.js';

/** @deprecated Prefer `appAuthRequired()` / `getAppRuntime().authRequired` */
export function basisAuthRequired(): boolean {
  return appAuthRequired();
}

/** @deprecated Prefer `appIsDesktopProduct()` */
export function basisIsDesktopProduct(): boolean {
  return appIsDesktopProduct();
}
