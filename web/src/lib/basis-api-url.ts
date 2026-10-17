/** Basis API origin for browser fetch (empty = same-origin / Vite proxy). */
export function basisApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_BASIS_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  return '';
}
