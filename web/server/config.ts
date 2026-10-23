import { fileURLToPath } from 'node:url';

export function basisApiTarget(): string {
  return (process.env.BASIS_API_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
}

export function webListenHost(): string {
  return process.env.WEB_HOST ?? '127.0.0.1';
}

export function webListenPort(): number {
  return Number(process.env.WEB_PORT ?? process.env.PORT ?? '5173');
}

/** Vite HMR websocket port (default: WEB_PORT + 19505, matches Vite’s 5173→24678). */
export function viteHmrPort(): number {
  const raw = process.env.WEB_HMR_PORT?.trim();
  if (raw) {
    return Number(raw);
  }
  return webListenPort() + 19505;
}

export function webStaticRoot(): string {
  if (process.env.WEB_STATIC_DIR?.trim()) {
    return process.env.WEB_STATIC_DIR.trim();
  }
  return fileURLToPath(new URL('../dist/web', import.meta.url));
}
