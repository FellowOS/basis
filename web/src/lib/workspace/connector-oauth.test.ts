import { describe, expect, it } from 'vitest';

import { connectorAuthNeedsPkce } from '@/lib/workspace/connector-oauth.js';

describe('connectorAuthNeedsPkce', () => {
  it('returns true when oauth2 auth spec requires PKCE', () => {
    expect(
      connectorAuthNeedsPkce([{ auth_mode: 'oauth2', oauth2: { pkce_s256: true } }]),
    ).toBe(true);
  });

  it('returns false for api_key or oauth2 without pkce', () => {
    expect(connectorAuthNeedsPkce([{ auth_mode: 'api_key' }])).toBe(false);
    expect(connectorAuthNeedsPkce([{ auth_mode: 'oauth2', oauth2: { pkce_s256: false } }])).toBe(
      false,
    );
  });
});
