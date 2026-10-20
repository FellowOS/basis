/**
 * Maintain symlinked product docs under content/docs/{locale}/.
 *
 * Long-form specs live in docs/architecture/ so repo docs can link them; the
 * Fumadocs pages are symlinked into content/docs so `/docs/*` can route them.
 * All other MDX bodies/frontmatter are edited in content/docs/ directly.
 *
 * Run: node scripts/generate-product-docs-mdx.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(webRoot);
const contentRoot = path.join(webRoot, 'content/docs');

/** Docs pages whose canonical source stays under docs/architecture/ (repo-relative). */
const SYMLINKED_PAGES = [
  {
    slug: 'bocp',
    en: 'docs/architecture/connectors/bocp.md',
    zh: 'docs/architecture/connectors/bocp.zh.md',
  },
  {
    slug: 'connectors-basis',
    en: 'docs/architecture/connectors/runtime.md',
    zh: 'docs/architecture/connectors/runtime.zh.md',
  },
];

const LOCALES = ['en', 'zh'];

async function linkPage(locale, entry) {
  const dir = path.join(contentRoot, locale);
  const source = entry[locale];
  const target = path.join(repoRoot, source);
  const linkPath = path.join(dir, `${entry.slug}.md`);

  await fs.access(target).catch(() => {
    throw new Error(`Missing source for ${locale}/${entry.slug}.md: ${source}`);
  });
  await fs.mkdir(dir, { recursive: true });

  let existing;
  try {
    existing = await fs.lstat(linkPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (existing) {
    if (!existing.isSymbolicLink()) {
      throw new Error(
        `${path.relative(repoRoot, linkPath)} exists and is not a symlink; refusing to replace it`,
      );
    }
    await fs.unlink(linkPath);
  }

  await fs.symlink(path.relative(dir, target), linkPath);
}

async function main() {
  for (const entry of SYMLINKED_PAGES) {
    for (const locale of LOCALES) {
      await linkPage(locale, entry);
    }
  }
  console.log(
    `Refreshed ${SYMLINKED_PAGES.length * LOCALES.length} product-docs symlinks under content/docs/{${LOCALES.join(',')}}/`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
