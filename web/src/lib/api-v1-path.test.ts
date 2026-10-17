import { describe, expect, it } from 'vitest';

import { authV1Path, platformV1Path } from '@/lib/api-v1-path.js';

describe('api-v1-path', () => {
  it('builds platform and auth paths', () => {
    expect(platformV1Path('admin/users')).toBe('/api/v1/admin/users');
    expect(platformV1Path('orgs')).toBe('/api/v1/orgs');
    expect(authV1Path('me')).toBe('/api/v1/auth/me');
  });
});
