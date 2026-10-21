const PENDING_KEY = 'basis_bocp_oauth_pending';

export type PendingConnectorOAuth = {
  workspaceId: string;
  service: string;
  connectionName: string;
  connectionConfig: Record<string, unknown>;
  state: string;
  redirectUri: string;
  codeVerifier?: string;
};

export function workspaceConnectorOAuthCallbackPath(workspaceId: string): string {
  return `/workspaces/${workspaceId}/connectors/oauth/callback`;
}

export function workspaceConnectorOAuthRedirectUri(workspaceId: string): string {
  if (typeof window === 'undefined') {
    return workspaceConnectorOAuthCallbackPath(workspaceId);
  }
  return `${window.location.origin}${workspaceConnectorOAuthCallbackPath(workspaceId)}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64UrlEncode(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export function savePendingConnectorOAuth(pending: PendingConnectorOAuth): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

export function readPendingConnectorOAuth(): PendingConnectorOAuth | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingConnectorOAuth;
  } catch {
    return null;
  }
}

export function clearPendingConnectorOAuth(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function connectorAuthNeedsPkce(
  auth: Array<{ auth_mode?: string; oauth2?: { pkce_s256?: boolean } }> | undefined,
): boolean {
  if (!auth?.length) return false;
  return auth.some((entry) => entry.auth_mode === 'oauth2' && entry.oauth2?.pkce_s256 === true);
}
