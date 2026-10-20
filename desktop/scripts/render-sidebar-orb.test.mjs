import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderSidebarOrbPng } from './render-sidebar-orb.mjs';

describe('renderSidebarOrbPng', () => {
  it('renders a non-trivial PNG for light and dark themes', () => {
    const light = renderSidebarOrbPng(128, 'light');
    const dark = renderSidebarOrbPng(128, 'dark');
    assert.ok(light.length > 400, 'light PNG should have body');
    assert.ok(dark.length > 400, 'dark PNG should have body');
    assert.notDeepEqual(light, dark);
  });
});
