#!/usr/bin/env node
/**
 * Fail release before electron-builder when required Desktop resources are missing.
 * Fellow: packages/desktop/scripts/verify-release-resources.mjs
 */
import { apiStageDir, profilesDir, webDistDir } from './paths.mjs';
import { verifyReleaseResources } from './verify-release-resources-lib.mjs';

try {
  verifyReleaseResources({ webDistDir, profilesDir, apiStageDir });
  console.log('[release-resources] OK');
} catch (err) {
  console.error(`[release-resources] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
