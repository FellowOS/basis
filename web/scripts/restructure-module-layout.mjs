#!/usr/bin/env node
/**
 * One-off: ensure modules/<name>/{pages,i18n,components} and move common entry files.
 * Run from repo: node web/scripts/restructure-module-layout.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const modulesRoot = path.join(webSrc, 'modules');

const PAGE_ROOT_FILES = new Set([
  'panel.tsx',
  'screen.tsx',
  'host.tsx',
  'diff.tsx',
  'sources.tsx',
  'mapping-new.tsx',
  'mapping-edit.tsx',
  'oauth-callback.tsx',
  'analyze-panels.tsx',
  'sparql.tsx',
  'reasoning.tsx',
  'reasoning-input.tsx',
  'reasoning-results.tsx',
  'reasoning-rules-dialog.tsx',
  'reasoning-rule-library-combobox.tsx',
  'search-results.tsx',
  'graph-host.tsx',
]);

/** Route entry lives at module root as index.tsx (not under pages/). */
const MODULE_ROUTE_ENTRY = 'index.tsx';

const I18N_GLOB = /-copy\.ts$|Copy\.ts$|reasoning-syntax\.ts$/;

const HOOK_GLOB = /^use-[a-z].+\.(ts|tsx)$/;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function moveFile(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
  return true;
}

function stubI18n(i18nDir, moduleName) {
  const indexPath = path.join(i18nDir, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(
      indexPath,
      `/** Module-local i18n bridges for \`${moduleName}\`. */\nexport {};\n`,
    );
  }
}

function stubComponents(compDir) {
  const indexPath = path.join(compDir, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `/** Module-local UI; import from concrete files, not only this barrel. */\nexport {};\n`);
  }
}

for (const name of fs.readdirSync(modulesRoot)) {
  if (name === 'README.md') continue;
  const mod = path.join(modulesRoot, name);
  if (!fs.statSync(mod).isDirectory()) continue;

  const pagesDir = path.join(mod, 'pages');
  const i18nDir = path.join(mod, 'i18n');
  const componentsDir = path.join(mod, 'components');
  const hooksDir = path.join(mod, 'hooks');
  const libDir = path.join(mod, 'lib');

  ensureDir(pagesDir);
  ensureDir(i18nDir);
  ensureDir(componentsDir);

  const entries = fs.readdirSync(mod).filter((f) => {
    const full = path.join(mod, f);
    return fs.statSync(full).isFile();
  });

  const pagesPage = path.join(pagesDir, 'page.tsx');
  const routeIndex = path.join(mod, MODULE_ROUTE_ENTRY);
  if (fs.existsSync(pagesPage) && !fs.existsSync(routeIndex)) {
    moveFile(pagesPage, routeIndex);
  }

  for (const file of entries) {
    const from = path.join(mod, file);
    if (file === MODULE_ROUTE_ENTRY) {
      continue;
    }
    if (I18N_GLOB.test(file)) {
      moveFile(from, path.join(i18nDir, file));
      continue;
    }
    if (HOOK_GLOB.test(file)) {
      ensureDir(hooksDir);
      moveFile(from, path.join(hooksDir, file));
      continue;
    }
    if (PAGE_ROOT_FILES.has(file)) {
      moveFile(from, path.join(pagesDir, file));
      continue;
    }
    if (file.endsWith('.tsx')) {
      moveFile(from, path.join(componentsDir, file));
      continue;
    }
    if (file.endsWith('.ts')) {
      ensureDir(libDir);
      moveFile(from, path.join(libDir, file));
      continue;
    }
  }

  stubI18n(i18nDir, name);
  stubComponents(componentsDir);
}

console.log('Module layout restructure done. Run typecheck and fix remaining imports.');
