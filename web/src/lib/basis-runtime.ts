/** Deployment/runtime flags (ADR 0004 desktop). */

export function basisAuthRequired(): boolean {
  const desktop = window.__BASIS_DESKTOP__?.authRequired;
  if (desktop === false) return false;
  const raw = import.meta.env.VITE_BASIS_AUTH_REQUIRED;
  if (raw === 'false' || raw === '0') return false;
  return true;
}

declare global {
  interface Window {
    __BASIS_DESKTOP__?: {
      apiBase?: string;
      desktop?: boolean;
      authRequired?: boolean;
    };
  }
}
