/**
 * Heuristic audit: lists locale leaf paths with no obvious reference in web/src (excluding locales).
 * Run: npx tsx scripts/audit-locale-usage.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const srcRoot = join(webRoot, "src");

const enUrl = pathToFileURL(join(srcRoot, "i18n/en.ts")).href;
const { en } = await import(enUrl);

function flatten(obj, prefix = "") {
  if (typeof obj === "string") return [prefix];
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return flatten(value, next);
  });
}

function walkDir(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    const st = statSync(path);
    if (st.isDirectory()) walkDir(path, files);
    else if (/\.(tsx?|mjs)$/.test(name)) files.push(path);
  }
  return files;
}

function loadCorpus() {
  const files = walkDir(srcRoot).filter(
    (p) => !p.endsWith("/i18n/module-locales.ts"),
  );
  return files.map((p) => readFileSync(p, "utf8")).join("\n");
}

/** Keys resolved dynamically (Record lookup, merged audit maps, API-driven ids). */
const WHOLE_BLOCK_PREFIXES = [
  "core.api_error_codes.",
  "core.dev.",
  "graph.audit.actions.",
  "admin_audit.platform_audit_actions.",
  "decisions.page.outcome_labels.",
  "decisions.page.step_type_labels.",
  "decisions.page.relationship_labels.",
  "decisions.page.category_labels.",
  "ontology.hub.editor.owl_type_labels.",
  "admin_models.page.providers.",
  "graph.projection.projection_status_labels.",
  "entities.ledger.statement_status_labels.",
  "graph.canvas.entity_shape_labels.",
  "graph.canvas.node_kind_labels.",
  "graph.canvas.effect_reasons.",
  "graph.canvas.plugins.",
  "graph.canvas.registry_log.",
  "home.marketing.",
  "alerts.page.kind_labels.",
];

function isUsed(path, corpus) {
  if (WHOLE_BLOCK_PREFIXES.some((p) => path.startsWith(p))) return true;

  const parts = path.split(".");
  for (let i = 0; i < parts.length; i++) {
    const suffix = parts.slice(i).join(".");
    if (corpus.includes(suffix)) return true;
  }
  const leaf = parts[parts.length - 1];
  if (leaf.length < 3) return true;
  if (corpus.includes(`.${leaf}`)) return true;
  if (corpus.includes(`['${leaf}']`) || corpus.includes(`["${leaf}"]`)) return true;
  return false;
}

const corpus = loadCorpus();
const keys = flatten(en);
const unused = keys.filter((k) => !isUsed(k, corpus));

const byTop = new Map();
for (const k of unused) {
  const top = k.split(".")[0];
  if (!byTop.has(top)) byTop.set(top, []);
  byTop.get(top).push(k);
}

console.log(`Total keys: ${keys.length}, possibly unused: ${unused.length}\n`);
for (const [top, list] of [...byTop.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`## ${top} (${list.length})`);
  for (const k of list.slice(0, 30)) console.log(`  ${k}`);
  if (list.length > 30) console.log(`  ... +${list.length - 30} more`);
  console.log();
}
