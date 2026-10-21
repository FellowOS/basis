import { isWorkspaceScopedPath, parseWorkspaceIdFromPath } from '@/lib/nav-config.js';

/** Placeholder workspace id for sidebar + nav when the user has no workspaces yet. */
export const WORKSPACE_SETUP_ID = 'setup';

const STORAGE_KEY = 'basis_active_workspace_id';
const LEGACY_STORAGE_KEY = 'basis_active_kb_id';

export function isSetupWorkspaceId(id: string | null | undefined): boolean {
  return id === WORKSPACE_SETUP_ID;
}

export function readActiveWorkspaceId(): string | null {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return current;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function writeActiveWorkspaceId(id: string): void {
  if (isSetupWorkspaceId(id)) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function pickDefaultWorkspaceId(workspaces: ReadonlyArray<{ id: string }>): string | null {
  if (workspaces.length === 0) return null;
  const saved = readActiveWorkspaceId();
  if (saved && workspaces.some((ws) => ws.id === saved)) return saved;
  return workspaces[0].id;
}

/** Workspace id for sidebar nav links (path id, else last/default, else setup). */
export function resolveSidebarWorkspaceId(
  pathname: string,
  workspaces: ReadonlyArray<{ id: string }>,
): string {
  const raw = parseWorkspaceIdFromPath(pathname);
  if (isSetupWorkspaceId(raw)) return WORKSPACE_SETUP_ID;
  if (raw && isWorkspaceScopedPath(pathname)) return raw;
  if (raw && workspaces.some((ws) => ws.id === raw)) return raw;
  return pickDefaultWorkspaceId(workspaces) ?? WORKSPACE_SETUP_ID;
}
