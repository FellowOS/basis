/** GitHub Releases with tag `desktop-v*` (see release-desktop.yml). */
export const DESKTOP_RELEASE_TAG_PREFIX = 'desktop-v';

export const DEFAULT_GITHUB_REPO = 'coldbuffer/basis';

const CHECK_CACHE_KEY = 'basis.desktop.release-check.v1';
const DISMISS_KEY = 'basis.desktop.update.dismissed';

export type DesktopReleaseInfo = {
  version: string;
  tagName: string;
  htmlUrl: string;
};

export function githubRepoSlug(): string {
  const fromEnv = (import.meta.env.VITE_BASIS_GITHUB_REPO as string | undefined)?.trim();
  return fromEnv || DEFAULT_GITHUB_REPO;
}

export function parseDesktopReleaseVersion(tagName: string): string | null {
  if (!tagName.startsWith(DESKTOP_RELEASE_TAG_PREFIX)) return null;
  const raw = tagName.slice(DESKTOP_RELEASE_TAG_PREFIX.length);
  return /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(raw) ? raw : null;
}

/** @returns positive if `a` is newer than `b` */
export function compareSemver(a: string, b: string): number {
  const parts = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function readCache(): { checkedAt: number; release: DesktopReleaseInfo | null } | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CHECK_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { checkedAt: number; release: DesktopReleaseInfo | null };
  } catch {
    return null;
  }
}

function writeCache(release: DesktopReleaseInfo | null) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(
    CHECK_CACHE_KEY,
    JSON.stringify({ checkedAt: Date.now(), release }),
  );
}

export function isUpdateDismissed(latestVersion: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(DISMISS_KEY) === latestVersion;
}

export function dismissDesktopUpdate(latestVersion: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DISMISS_KEY, latestVersion);
}

/**
 * Latest published desktop release from GitHub (public API).
 * Cached in sessionStorage for the browser session.
 */
export async function fetchLatestDesktopRelease(
  repo = githubRepoSlug(),
): Promise<DesktopReleaseInfo | null> {
  const cached = readCache();
  if (cached && Date.now() - cached.checkedAt < 6 * 60 * 60 * 1000) {
    return cached.release;
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    writeCache(null);
    return null;
  }

  const releases = (await res.json()) as Array<{ tag_name?: string; html_url?: string }>;
  let best: DesktopReleaseInfo | null = null;
  for (const row of releases) {
    const tag = row.tag_name ?? '';
    const version = parseDesktopReleaseVersion(tag);
    if (!version || !row.html_url) continue;
    if (!best || compareSemver(version, best.version) > 0) {
      best = { version, tagName: tag, htmlUrl: row.html_url };
    }
  }
  writeCache(best);
  return best;
}

export function desktopUpdateAvailable(
  currentVersion: string,
  latest: DesktopReleaseInfo | null,
): DesktopReleaseInfo | null {
  if (!latest) return null;
  if (compareSemver(latest.version, currentVersion) <= 0) return null;
  if (isUpdateDismissed(latest.version)) return null;
  return latest;
}
