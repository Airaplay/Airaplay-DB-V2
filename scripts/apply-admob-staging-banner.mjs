#!/usr/bin/env node
/**
 * Safe no-op fallback for staging banner patch step.
 *
 * Some deploy environments invoke:
 *   node scripts/apply-admob-staging-banner.mjs
 *
 * Keep this script resilient so install/build does not fail when
 * optional AdMob staging banner assets are unavailable.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const markerPath = path.join(root, 'src', 'lib', 'admob-staging-banner.ts');

try {
  if (fs.existsSync(markerPath)) {
    console.log(`[admob-banner] marker exists: ${markerPath}`);
  } else {
    console.log('[admob-banner] no marker found, skipping staging banner patch');
  }
  process.exit(0);
} catch (error) {
  console.warn('[admob-banner] non-fatal error, continuing install:', error?.message ?? error);
  process.exit(0);
}
