import { isKbScopedPath, parseKbIdFromPath } from '@/lib/nav-config.js';

/** Placeholder KB id for sidebar + nav when the user has no knowledge bases yet. */
export const KB_SETUP_ID = 'setup';

const STORAGE_KEY = 'basis_active_kb_id';

export function isSetupKbId(id: string | null | undefined): boolean {
  return id === KB_SETUP_ID;
}

export function readActiveKbId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveKbId(id: string): void {
  if (isSetupKbId(id)) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function pickDefaultKbId(kbs: ReadonlyArray<{ id: string }>): string | null {
  if (kbs.length === 0) return null;
  const saved = readActiveKbId();
  if (saved && kbs.some((kb) => kb.id === saved)) return saved;
  return kbs[0].id;
}

/** KB id used for sidebar nav links (path KB, else last/default, else setup). */
export function resolveSidebarKbId(
  pathname: string,
  kbs: ReadonlyArray<{ id: string }>,
): string {
  const raw = parseKbIdFromPath(pathname);
  if (isSetupKbId(raw)) return KB_SETUP_ID;
  if (raw && isKbScopedPath(pathname)) return raw;
  if (raw && kbs.some((kb) => kb.id === raw)) return raw;
  return pickDefaultKbId(kbs) ?? KB_SETUP_ID;
}
