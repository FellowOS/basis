export type PlatformNavKey = 'kbs' | 'users' | 'models' | 'connectors' | 'audit' | 'system';

export type NavItem = {
  to: string;
  labelKey: PlatformNavKey;
  icon: string;
  adminOnly?: boolean;
  /** 仅匹配精确路径（用于 /kbs） */
  exact?: boolean;
};

export const PLATFORM_ADMIN_PREFIX = '/admin';

export const PLATFORM_NAV: NavItem[] = [
  { to: '/admin/kbs', labelKey: 'kbs', icon: 'folder-down-01', exact: true },
  { to: '/admin/users', labelKey: 'users', icon: 'users-profiles-01', adminOnly: true },
  { to: '/admin/models', labelKey: 'models', icon: 'atom', adminOnly: true },
  { to: '/admin/connectors', labelKey: 'connectors', icon: 'plug-01', adminOnly: true },
  { to: '/admin/audit', labelKey: 'audit', icon: 'list-dashes-01', adminOnly: true },
  { to: '/admin/settings', labelKey: 'system', icon: 'settings' },
];

export function platformPathActive(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function isPlatformAdminPath(pathname: string): boolean {
  if (pathname === PLATFORM_ADMIN_PREFIX || pathname.startsWith(`${PLATFORM_ADMIN_PREFIX}/`)) {
    return true;
  }
  return PLATFORM_NAV.some((item) => platformPathActive(pathname, item.to, item.exact));
}

/** Platform section tabs visible to the current user. */
export function visiblePlatformNavItems(isAdmin: boolean, canSettings: boolean): NavItem[] {
  return PLATFORM_NAV.filter((item) => {
    if (item.labelKey === 'kbs') return isAdmin;
    if (item.adminOnly) return isAdmin;
    if (item.labelKey === 'system') return canSettings;
    return false;
  });
}

export function platformAdminEntryPath(isAdmin: boolean, canSettings: boolean): string {
  const items = visiblePlatformNavItems(isAdmin, canSettings);
  return items[0]?.to ?? '/kbs';
}

/**
 * KB navigation zones ordered by user mental model & task frequency:
 * 1. explore (high-frequency consumption: Graph, Search)
 * 2. knowledge (sources, entities, entity resolution, decisions, review queue)
 * 3. connectors (BOCP catalog, connections, stream mappings, sync)
 * 4. schema (ontology hub tabs, query/reasoning hub, vocabulary, mappings)
 * 5. audit (provenance & temporal diff: Lineage, Graph Diff)
 * 6. system (integration, settings); alerts via account menu only
 */
export type KbWorkspaceZone =
  | 'explore'
  | 'knowledge'
  | 'connectors'
  | 'schema'
  | 'audit'
  | 'system';

export const KB_WORKSPACE_ZONES: KbWorkspaceZone[] = [
  'explore',
  'knowledge',
  'connectors',
  'schema',
  'audit',
  'system',
];

export type KbNavItem = {
  segment: string;
  labelKey: string;
  icon: string;
};

/** KB primary navigation grouped by mental model, with unique icons per item. */
export const KB_NAV_BY_ZONE = {
  explore: [
    { segment: 'graph', labelKey: 'graph', icon: 'graph' },
    { segment: 'search', labelKey: 'search', icon: 'search-01' },
  ],
  knowledge: [
    { segment: 'sources', labelKey: 'sources', icon: 'book-01' },
    { segment: 'processing', labelKey: 'processing', icon: 'sync' },
    { segment: 'entities', labelKey: 'entities', icon: 'atom' },
    { segment: 'entity-resolution', labelKey: 'entityResolution', icon: 'git-merge' },
    { segment: 'decisions', labelKey: 'decisions', icon: 'scales' },
    { segment: 'review', labelKey: 'review', icon: 'check-square-contained' },
  ],
  connectors: [
    { segment: 'connectors/catalog', labelKey: 'connectorCatalog', icon: 'database' },
    { segment: 'connectors/mappings', labelKey: 'connectorStreamMappings', icon: 'arrows-left-right' },
    { segment: 'connectors/policy', labelKey: 'connectorActionPolicy', icon: 'scales' },
    { segment: 'connectors/runs', labelKey: 'connectorRunLogs', icon: 'list-dashes-01' },
  ],
  schema: [
    { segment: 'ontology', labelKey: 'ontology', icon: 'shapes-01' },
    { segment: 'analyze', labelKey: 'analyze', icon: 'code-01' },
    { segment: 'vocabulary', labelKey: 'vocabulary', icon: 'tag' },
    { segment: 'mappings', labelKey: 'mappings', icon: 'arrows-left-right' },
  ],
  audit: [
    { segment: 'lineage', labelKey: 'lineage', icon: 'path' },
    { segment: 'graph-diff', labelKey: 'graphDiff', icon: 'git-diff' },
  ],
  system: [
    { segment: 'integration', labelKey: 'integration', icon: 'plug-01' },
    { segment: 'settings', labelKey: 'settings', icon: 'settings' },
  ],
} as const satisfies Record<KbWorkspaceZone, readonly KbNavItem[]>;

/** Sidebar `labelKey` values — single source with `menu.kb` i18n keys. */
export type KbSidebarNavKey = {
  [Z in KbWorkspaceZone]: (typeof KB_NAV_BY_ZONE)[Z][number]['labelKey'];
}[KbWorkspaceZone];

export type KbSidebarMenuKey = KbSidebarNavKey | 'alerts';

/** Hub tab / legacy route segments (not in `menu.kb`). */
export type KbHubCapabilityNavKey =
  | 'ontologyVersions'
  | 'shacl'
  | 'alignments'
  | 'sparql'
  | 'reasoning';

/** Routable segments and capability switches (includes legacy `processing`). */
export type KbNavKey = KbSidebarMenuKey | KbHubCapabilityNavKey | 'processing';

export type KbSidebarNavItem = KbNavItem & { labelKey: KbSidebarMenuKey };

/** KB alerts route (account menu only; not in sidebar zones). */
export const KB_ALERTS_NAV_ITEM: KbSidebarNavItem = {
  segment: 'alerts',
  labelKey: 'alerts',
  icon: 'bell-01',
};

export const KB_SETTINGS_NAV_ITEM: KbSidebarNavItem = KB_NAV_BY_ZONE.system[1];

/** Former sidebar routes kept for deep links and redirects. */
export const KB_HUB_LEGACY_SEGMENTS = [
  'ontology-versions',
  'shacl',
  'alignments',
  'sparql',
  'reasoning',
] as const;

function buildKbNav(): KbSidebarNavItem[] {
  const items: KbSidebarNavItem[] = [];
  for (const zone of KB_WORKSPACE_ZONES) {
    for (const item of KB_NAV_BY_ZONE[zone]) {
      items.push(item as KbSidebarNavItem);
    }
  }
  items.push(KB_ALERTS_NAV_ITEM);
  return items;
}

export const KB_NAV = buildKbNav();

export function kbPath(kbId: string, segment: string): string {
  return `/kbs/${kbId}/${segment}`;
}

/** BOCP workspace panels (sidebar routes under `/connectors/…`). */
export type ConnectorPanel = 'catalog' | 'mappings' | 'policy' | 'runs';

export function kbConnectorPanelPath(kbId: string, panel: ConnectorPanel): string {
  return kbPath(kbId, `connectors/${panel}`);
}

/** Deep-link to OWL versions workspace + proposal review modal (F-ONT-05). */
export function kbOntologyProposalPath(kbId: string, proposalId: string): string {
  const params = new URLSearchParams({
    tab: 'versions',
    ontologyProposal: proposalId,
  });
  return `${kbPath(kbId, 'ontology')}?${params.toString()}`;
}

/** OWL ontology versions & proposals (separate from ledger review queue). */
export function kbOntologyVersionsPath(kbId: string): string {
  return `${kbPath(kbId, 'ontology')}?tab=versions`;
}

/** Graph projection diff between two ISO instants (F-DIFF-01). */
export function kbGraphDiffPath(kbId: string, from?: string, to?: string): string {
  const base = kbPath(kbId, 'graph-diff');
  if (!from && !to) return base;
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function parseKbIdFromPath(pathname: string): string | null {
  const match = /^\/kbs\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) return null;
  const id = match[1];
  if (!id || id === 'undefined') return null;
  return id as string;
}

/** Sidebar glyph for the page the pathname opens. */
export function menuIconForPath(pathname: string): string | undefined {
  const segment = /^\/kbs\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  if (segment) {
    if (segment === 'ontology-versions' || segment === 'shacl' || segment === 'alignments') {
      return KB_NAV_BY_ZONE.schema.find((item) => item.segment === 'ontology')?.icon;
    }
    if (segment === 'sparql' || segment === 'reasoning') {
      return KB_NAV_BY_ZONE.schema.find((item) => item.segment === 'analyze')?.icon;
    }
    if (segment === 'connectors') {
      const panel = /^\/kbs\/[^/]+\/connectors\/([^/]+)/.exec(pathname)?.[1];
      const navSegment =
        panel === 'mappings' || panel === 'policy' || panel === 'runs'
          ? `connectors/${panel}`
          : 'connectors/catalog';
      return KB_NAV.find((item) => item.segment === navSegment)?.icon;
    }
    return KB_NAV.find((item) => item.segment === segment)?.icon;
  }
  return PLATFORM_NAV.find((item) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )?.icon;
}

export function isKbScopedPath(pathname: string): boolean {
  const id = parseKbIdFromPath(pathname);
  if (!id) return false;
  const rest = pathname.slice(`/kbs/${id}`.length);
  if (!rest || rest === '/') return false;
  const segment = rest.replace(/^\//, '').split('/')[0];
  if (segment === 'connectors') {
    return true;
  }
  if (KB_NAV.some((item) => item.segment === segment)) {
    return true;
  }
  return (KB_HUB_LEGACY_SEGMENTS as readonly string[]).includes(segment);
}
