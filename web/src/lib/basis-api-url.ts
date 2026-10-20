import { getAppRuntime } from '@/lib/app-runtime.js';

/** Basis API origin for browser fetch (empty = same-origin / Vite proxy). */
export function basisApiBaseUrl(): string {
  const fromRuntime = getAppRuntime().apiBase?.trim();
  if (fromRuntime) return fromRuntime.replace(/\/$/, '');
  const fromEnv = import.meta.env.VITE_BASIS_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  return '';
}
