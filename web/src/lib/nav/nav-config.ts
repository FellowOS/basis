export type PlatformNavKey = 'workspaces' | 'users' | 'models' | 'connectors' | 'audit' | 'system';

export type NavItem = {
  to: string;
  labelKey: PlatformNavKey;
  icon: string;
  adminOnly?: boolean;
  /** 仅匹配精确路径（用于 /workspaces） */
  exact?: boolean;
};

export const PLATFORM_ADMIN_PREFIX = '/admin';

export const PLATFORM_NAV: NavItem[] = [
  { to: '/admin/workspaces', labelKey: 'workspaces', icon: 'folder-down-01', exact: true },
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
export function visiblePlatformNavItems(
  isAdmin: boolean,
  canSettings: boolean,
  desktopProduct = false,
): NavItem[] {
  return PLATFORM_NAV.filter((item) => {
    if (
      desktopProduct &&
      (item.labelKey === 'users' || item.labelKey === 'audit' || item.labelKey === 'system')
    ) {
      return false;
    }
    if (item.labelKey === 'workspaces') return isAdmin;
    if (item.adminOnly) return isAdmin;
    if (item.labelKey === 'system') return canSettings;
    return false;
  });
}

export function platformAdminEntryPath(
  isAdmin: boolean,
  canSettings: boolean,
  desktopProduct = false,
): string {
  const items = visiblePlatformNavItems(isAdmin, canSettings, desktopProduct);
  return items[0]?.to ?? '/workspaces';
}

/**
 * Workspace navigation zones ordered by user mental model & task frequency:
 * 1. explore (high-frequency consumption: Graph, Search)
 * 2. knowledge (sources, processing, entity ledger)
 * 3. connectors (BOCP catalog, connections, stream mappings, sync)
 * 4. schema (ontology hub tabs, query/reasoning hub, vocabulary, mappings)
 * 5. govern (review, resolution, decisions, lineage, graph diff)
 * 6. system (integration, settings); alerts via account menu only
 */
export type WorkspaceZone =
  | 'explore'
  | 'knowledge'
  | 'connectors'
  | 'schema'
  | 'govern'
  | 'system';

export const WORKSPACE_ZONES: WorkspaceZone[] = [
  'explore',
  'knowledge',
  'connectors',
  'schema',
  'govern',
  'system',
];

export type WorkspaceNavItem = {
  segment: string;
  labelKey: string;
  icon: string;
};

/** Workspace primary navigation grouped by mental model, with unique icons per item. */
export const WORKSPACE_NAV_BY_ZONE = {
  explore: [
    { segment: 'graph', labelKey: 'graph', icon: 'graph' },
    { segment: 'search', labelKey: 'search', icon: 'search-01' },
  ],
  knowledge: [
    { segment: 'sources', labelKey: 'sources', icon: 'book-01' },
    { segment: 'processing', labelKey: 'processing', icon: 'sync' },
    { segment: 'entities', labelKey: 'entities', icon: 'atom' },
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
  govern: [
    { segment: 'review', labelKey: 'review', icon: 'check-square-contained' },
    { segment: 'entity-resolution', labelKey: 'entityResolution', icon: 'git-merge' },
    { segment: 'decisions', labelKey: 'decisions', icon: 'scales' },
    { segment: 'lineage', labelKey: 'lineage', icon: 'path' },
    { segment: 'graph-diff', labelKey: 'graphDiff', icon: 'git-diff' },
  ],
  system: [
    { segment: 'integration', labelKey: 'integration', icon: 'plug-01' },
    { segment: 'settings', labelKey: 'settings', icon: 'settings' },
  ],
} as const satisfies Record<WorkspaceZone, readonly WorkspaceNavItem[]>;

/** Sidebar `labelKey` values — aligned with per-module `*.menu.*` i18n keys. */
export type SidebarNavKey = {
  [Z in WorkspaceZone]: (typeof WORKSPACE_NAV_BY_ZONE)[Z][number]['labelKey'];
}[WorkspaceZone];

export type SidebarMenuKey = SidebarNavKey | 'alerts';

/** Hub tab / legacy route segments (not primary sidebar nav keys). */
export type HubCapabilityNavKey =
  | 'ontologyVersions'
  | 'shacl'
  | 'alignments'
  | 'sparql'
  | 'reasoning';

/** Routable segments and capability switches (includes legacy `processing`). */
export type WorkspaceNavKey = SidebarMenuKey | HubCapabilityNavKey | 'processing';

export type SidebarNavItem = WorkspaceNavItem & { labelKey: SidebarMenuKey };

/** Workspace alerts route (account menu only; not in sidebar zones). */
export const ALERTS_NAV_ITEM: SidebarNavItem = {
  segment: 'alerts',
  labelKey: 'alerts',
  icon: 'bell-01',
};

export const SETTINGS_NAV_ITEM: SidebarNavItem = WORKSPACE_NAV_BY_ZONE.system[1];

/** Former sidebar routes kept for deep links and redirects. */
export const KB_HUB_LEGACY_SEGMENTS = [
  'ontology-versions',
  'shacl',
  'alignments',
  'sparql',
  'reasoning',
  'onboarding',
] as const;

function buildWorkspaceNav(): SidebarNavItem[] {
  const items: SidebarNavItem[] = [];
  for (const zone of WORKSPACE_ZONES) {
    for (const item of WORKSPACE_NAV_BY_ZONE[zone]) {
      items.push(item as SidebarNavItem);
    }
  }
  items.push(ALERTS_NAV_ITEM);
  return items;
}

export const WORKSPACE_NAV = buildWorkspaceNav();

export function workspacePath(workspaceId: string, segment: string): string {
  return `/workspaces/${workspaceId}/${segment}`;
}

/** BOCP workspace panels (sidebar routes under `/connectors/…`). */
export type ConnectorPanel = 'catalog' | 'mappings' | 'policy' | 'runs';

export function workspaceConnectorPanelPath(workspaceId: string, panel: ConnectorPanel): string {
  return workspacePath(workspaceId, `connectors/${panel}`);
}

/** Deep-link to OWL versions workspace + proposal review modal (F-ONT-05). */
export function workspaceOntologyProposalPath(workspaceId: string, proposalId: string): string {
  const params = new URLSearchParams({
    tab: 'versions',
    ontologyProposal: proposalId,
  });
  return `${workspacePath(workspaceId, 'ontology')}?${params.toString()}`;
}

/** OWL ontology versions & proposals (separate from ledger review queue). */
export function workspaceOntologyVersionsPath(workspaceId: string): string {
  return `${workspacePath(workspaceId, 'ontology')}?tab=versions`;
}

/** Graph projection diff between two ISO instants (F-DIFF-01). */
export function workspaceGraphDiffPath(workspaceId: string, from?: string, to?: string): string {
  const base = workspacePath(workspaceId, 'graph-diff');
  if (!from && !to) return base;
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function parseWorkspaceIdFromPath(pathname: string): string | null {
  const match = /^\/workspaces\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) return null;
  const id = match[1];
  if (!id || id === 'undefined') return null;
  return id as string;
}

/** Sidebar glyph for the page the pathname opens. */
export function menuIconForPath(pathname: string): string | undefined {
  const segment = /^\/workspaces\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  if (segment) {
    if (segment === 'ontology-versions' || segment === 'shacl' || segment === 'alignments') {
      return WORKSPACE_NAV_BY_ZONE.schema.find((item) => item.segment === 'ontology')?.icon;
    }
    if (segment === 'sparql' || segment === 'reasoning') {
      return WORKSPACE_NAV_BY_ZONE.schema.find((item) => item.segment === 'analyze')?.icon;
    }
    if (segment === 'connectors') {
      const panel = /^\/workspaces\/[^/]+\/connectors\/([^/]+)/.exec(pathname)?.[1];
      const navSegment =
        panel === 'mappings' || panel === 'policy' || panel === 'runs'
          ? `connectors/${panel}`
          : 'connectors/catalog';
      return WORKSPACE_NAV.find((item) => item.segment === navSegment)?.icon;
    }
    return WORKSPACE_NAV.find((item) => item.segment === segment)?.icon;
  }
  return PLATFORM_NAV.find((item) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )?.icon;
}

export function isWorkspaceScopedPath(pathname: string): boolean {
  const id = parseWorkspaceIdFromPath(pathname);
  if (!id) return false;
  const rest = pathname.slice(`/workspaces/${id}`.length);
  if (!rest || rest === '/') return false;
  const segment = rest.replace(/^\//, '').split('/')[0];
  if (segment === 'connectors') {
    return true;
  }
  if (WORKSPACE_NAV.some((item) => item.segment === segment)) {
    return true;
  }
  return (KB_HUB_LEGACY_SEGMENTS as readonly string[]).includes(segment);
}
