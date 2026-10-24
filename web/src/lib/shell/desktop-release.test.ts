import { describe, expect, it } from 'vitest';

import {
  compareSemver,
  desktopUpdateAvailable,
  parseDesktopReleaseVersion,
} from '@/lib/shell/desktop-release.js';

describe('parseDesktopReleaseVersion', () => {
  it('parses desktop-v tags', () => {
    expect(parseDesktopReleaseVersion('desktop-v0.1.0')).toBe('0.1.0');
    expect(parseDesktopReleaseVersion('v0.1.0')).toBeNull();
  });
});

describe('compareSemver', () => {
  it('orders versions', () => {
    expect(compareSemver('0.2.0', '0.1.9')).toBeGreaterThan(0);
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
  });
});

describe('desktopUpdateAvailable', () => {
  it('returns latest when newer', () => {
    const latest = {
      version: '0.2.0',
      tagName: 'desktop-v0.2.0',
      htmlUrl: 'https://example.com/release',
    };
    expect(desktopUpdateAvailable('0.1.0', latest)?.version).toBe('0.2.0');
    expect(desktopUpdateAvailable('0.2.0', latest)).toBeNull();
  });
});
