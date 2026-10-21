#!/usr/bin/env node
// Rewrite per-module menu-kb.ts (en/zh) from canonical label maps.
// Run: npx tsx scripts/fix-menu-kb-fragments.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const KB_EN = {
  graph: 'Graph',
  graphDiff: 'Graph diff',
  search: 'Search',
  sources: 'Sources',
  connectors: 'Connectors',
  connectorCatalog: 'Catalog & connections',
  connectorStreamMappings: 'Connector sync mappings',
  dataOntologyWizard: 'Data & ontology setup',
  connectorActionPolicy: 'Action policy',
  connectorRunLogs: 'Run logs',
  processing: 'Processing',
  entities: 'Entities',
  review: 'Review queue',
  entityResolution: 'Entity resolution',
  decisions: 'Decisions',
  ontology: 'Ontology',
  analyze: 'Query & reasoning',
  mappings: 'Statement mappings',
  vocabulary: 'Vocabulary',
  lineage: 'Lineage',
  alerts: 'Alerts',
  integration: 'Integration',
  settings: 'Settings',
};

const KB_ZH = {
  graph: '图谱',
  graphDiff: '版本对比',
  search: '检索',
  sources: '资料',
  connectors: '连接器',
  connectorCatalog: '目录与连接',
  connectorStreamMappings: '连接器同步映射',
  dataOntologyWizard: '数据与本体向导',
  connectorActionPolicy: '动作策略',
  connectorRunLogs: '运行日志',
  processing: '处理任务',
  entities: '实体账本',
  review: '审核队列',
  entityResolution: '实体解析',
  decisions: '决策记录',
  ontology: '本体',
  analyze: '查询推理',
  mappings: '抽取映射',
  vocabulary: '受控词表',
  lineage: '溯源血缘',
  alerts: '消息提醒',
  integration: '集成',
  settings: '设置',
};

const MODULE_KEYS = {
  graph: ['graph', 'graphDiff'],
  connectors: [
    'connectors',
    'connectorCatalog',
    'connectorStreamMappings',
    'connectorActionPolicy',
    'connectorRunLogs',
  ],
  search: ['search'],
  library: ['sources'],
  'data-onboarding': ['dataOntologyWizard'],
  processing: ['processing'],
  entities: ['entities'],
  review: ['review'],
  'entity-resolution': ['entityResolution'],
  decisions: ['decisions'],
  ontology: ['ontology'],
  analyze: ['analyze'],
  mappings: ['mappings'],
  vocabulary: ['vocabulary'],
  lineage: ['lineage'],
  alerts: ['alerts'],
  integration: ['integration'],
  settings: ['settings'],
};

function serialize(slice) {
  const lines = Object.entries(slice).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`);
  return `export const menuKb = {\n${lines.join('\n')}\n} as const;\n`;
}

for (const [lang, kb] of [['en', KB_EN], ['zh', KB_ZH]]) {
  for (const [mod, keys] of Object.entries(MODULE_KEYS)) {
    const slice = {};
    for (const key of keys) {
      slice[key] = kb[key];
    }
    const dir = path.join(srcRoot, 'modules', mod, 'i18n', lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'menu-kb.ts'), serialize(slice));
    const legacy = path.join(dir, 'menu-kb-label.ts');
    if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  }
}

console.log('Wrote menu-kb.ts for workspace nav modules.');
