/** Normalize public site URL (no trailing slash). */
export function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function platformAuthCallbacks(publicBase: string): Record<string, string> | null {
  const base = normalizeSiteUrl(publicBase);
  if (!base) return null;
  return {
    github: `${base}/api/auth/oauth/github/callback`,
    google: `${base}/api/auth/oauth/google/callback`,
    org_oidc: `${base}/api/auth/oidc/callback`,
  };
}

export function orgSsoPublicUrls(
  publicBase: string,
  orgSlug: string,
): { login_url: string; callback_url: string } | null {
  const base = normalizeSiteUrl(publicBase);
  const slug = orgSlug.trim();
  if (!base || !slug) return null;
  return {
    login_url: `${base}/api/auth/oidc/${slug}/start`,
    callback_url: `${base}/api/auth/oidc/callback`,
  };
}
