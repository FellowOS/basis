const STORAGE_KEY = 'basis_integration_playground_subject';

export function readPlaygroundSubjectId(workspaceId: string): string {
  if (typeof window === 'undefined') {
    return defaultPlaygroundSubjectId(workspaceId);
  }
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${workspaceId}`);
    if (raw?.trim()) {
      return raw.trim();
    }
  } catch {
    /* ignore */
  }
  return defaultPlaygroundSubjectId(workspaceId);
}

export function writePlaygroundSubjectId(workspaceId: string, subjectId: string): void {
  try {
    sessionStorage.setItem(`${STORAGE_KEY}:${workspaceId}`, subjectId.trim());
  } catch {
    /* ignore */
  }
}

export function defaultPlaygroundSubjectId(workspaceId: string): string {
  return `playground-${workspaceId.slice(0, 8)}`;
}
