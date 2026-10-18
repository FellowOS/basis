export type PlatformNavKey = 'kbs' | 'users' | 'models' | 'audit' | 'system';

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
 * 3. schema (ontology hub, OWL versions, SHACL, SPARQL, reasoning, vocabulary, alignments, mappings)
 * 4. audit (provenance & temporal diff: Lineage, Graph Diff)
 * 5. system (KB alerts & settings)
 */
export type KbWorkspaceZone =
  | 'explore'
  | 'knowledge'
  | 'schema'
  | 'audit'
  | 'system';

export const KB_WORKSPACE_ZONES: KbWorkspaceZone[] = [
  'explore',
  'knowledge',
  'schema',
  'audit',
  'system',
];

export type KbNavKey =
  | 'graph'
  | 'search'
  | 'sources'
  | 'processing'
  | 'entities'
  | 'review'
  | 'entityResolution'
  | 'decisions'
  | 'ontology'
  | 'ontologyVersions'
  | 'shacl'
  | 'sparql'
  | 'reasoning'
  | 'alignments'
  | 'mappings'
  | 'vocabulary'
  | 'lineage'
  | 'graphDiff'
  | 'alerts'
  | 'integration'
  | 'settings';

export type KbNavItem = {
  segment: string;
  labelKey: KbNavKey;
  icon: string;
};

/** KB primary navigation grouped by mental model, with unique icons per item. */
export const KB_NAV_BY_ZONE: Record<KbWorkspaceZone, KbNavItem[]> = {
  explore: [
    { segment: 'graph', labelKey: 'graph', icon: 'graph' },
    { segment: 'search', labelKey: 'search', icon: 'search-01' },
  ],
  knowledge: [
    { segment: 'sources', labelKey: 'sources', icon: 'book-01' },
    { segment: 'entities', labelKey: 'entities', icon: 'atom' },
    { segment: 'entity-resolution', labelKey: 'entityResolution', icon: 'search-01' },
    { segment: 'decisions', labelKey: 'decisions', icon: 'path' },
    { segment: 'review', labelKey: 'review', icon: 'check-square-contained' },
  ],
  schema: [
    { segment: 'ontology', labelKey: 'ontology', icon: 'shapes-01' },
    { segment: 'ontology-versions', labelKey: 'ontologyVersions', icon: 'file-01' },
    { segment: 'shacl', labelKey: 'shacl', icon: 'shield-01' },
    { segment: 'sparql', labelKey: 'sparql', icon: 'code-01' },
    { segment: 'reasoning', labelKey: 'reasoning', icon: 'git-branch-01' },
    { segment: 'vocabulary', labelKey: 'vocabulary', icon: 'tag' },
    { segment: 'alignments', labelKey: 'alignments', icon: 'globe-02' },
    { segment: 'mappings', labelKey: 'mappings', icon: 'arrows-left-right' },
  ],
  audit: [
    { segment: 'lineage', labelKey: 'lineage', icon: 'path' },
    { segment: 'graph-diff', labelKey: 'graphDiff', icon: 'git-diff' },
  ],
  system: [
    { segment: 'alerts', labelKey: 'alerts', icon: 'bell-01' },
    { segment: 'integration', labelKey: 'integration', icon: 'plug-01' },
    { segment: 'settings', labelKey: 'settings', icon: 'settings' },
  ],
};

export const KB_SETTINGS_NAV_ITEM: KbNavItem = KB_NAV_BY_ZONE.system[2];

export const KB_NAV: KbNavItem[] = KB_WORKSPACE_ZONES.flatMap((zone) => KB_NAV_BY_ZONE[zone]);

export function kbPath(kbId: string, segment: string): string {
  return `/kbs/${kbId}/${segment}`;
}

/** Deep-link to OWL versions workspace + proposal review modal (F-ONT-05). */
export function kbOntologyProposalPath(kbId: string, proposalId: string): string {
  const params = new URLSearchParams({
    ontologyTab: 'versions',
    ontologyProposal: proposalId,
  });
  return `${kbPath(kbId, 'ontology-versions')}?${params.toString()}`;
}

/** OWL ontology versions & proposals (separate from ledger review queue). */
export function kbOntologyVersionsPath(kbId: string): string {
  return kbPath(kbId, 'ontology-versions');
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
  return KB_NAV.some((item) => item.segment === segment);
}
