export type PlatformNavKey = 'kbs' | 'users' | 'models' | 'audit' | 'system';

export type NavItem = {
  to: string;
  labelKey: PlatformNavKey;
  icon: string;
  adminOnly?: boolean;
  /** 仅匹配精确路径（用于 /kbs） */
  exact?: boolean;
};

export const PLATFORM_NAV: NavItem[] = [
  { to: '/kbs', labelKey: 'kbs', icon: 'folder-down-01', exact: true },
  { to: '/users', labelKey: 'users', icon: 'users-profiles-01', adminOnly: true },
  { to: '/models', labelKey: 'models', icon: 'atom', adminOnly: true },
  { to: '/audit', labelKey: 'audit', icon: 'list-dashes-01', adminOnly: true },
  { to: '/settings', labelKey: 'system', icon: 'settings', adminOnly: true },
];

/** KB lifecycle zones: sources → processing → knowledge → use/governance. */
export type KbWorkspaceZone =
  | 'sources'
  | 'knowledge'
  | 'explore'
  | 'governance'
  | 'settings';

export const KB_WORKSPACE_ZONES: KbWorkspaceZone[] = [
  'sources',
  'knowledge',
  'explore',
  'governance',
  'settings',
];

export type KbNavKey =
  | 'graph'
  | 'search'
  | 'chat'
  | 'sources'
  | 'processing'
  | 'entities'
  | 'review'
  | 'ontology'
  | 'mappings'
  | 'vocabulary'
  | 'lineage'
  | 'settings';

export type KbNavItem = {
  segment: string;
  labelKey: KbNavKey;
  icon: string;
};

/** KB navigation grouped by the knowledge lifecycle. */
export const KB_NAV_BY_ZONE: Record<KbWorkspaceZone, KbNavItem[]> = {
  sources: [{ segment: 'sources', labelKey: 'sources', icon: 'book-01' }],
  knowledge: [
    { segment: 'entities', labelKey: 'entities', icon: 'atom' },
    { segment: 'mappings', labelKey: 'mappings', icon: 'git-branch-01' },
  ],
  explore: [
    { segment: 'graph', labelKey: 'graph', icon: 'git-branch-01' },
    { segment: 'search', labelKey: 'search', icon: 'search-01' },
    { segment: 'chat', labelKey: 'chat', icon: 'message-chat-01' },
    { segment: 'lineage', labelKey: 'lineage', icon: 'git-branch-01' },
  ],
  governance: [
    { segment: 'review', labelKey: 'review', icon: 'check-square-contained' },
    { segment: 'ontology', labelKey: 'ontology', icon: 'shapes-01' },
    { segment: 'vocabulary', labelKey: 'vocabulary', icon: 'shapes-01' },
  ],
  settings: [{ segment: 'settings', labelKey: 'settings', icon: 'settings' }],
};

export const KB_NAV: KbNavItem[] = KB_WORKSPACE_ZONES.flatMap((zone) => KB_NAV_BY_ZONE[zone]);

export function kbPath(kbId: string, segment: string): string {
  return `/kbs/${kbId}/${segment}`;
}

/** Deep-link to ontology Versions tab + proposal review modal (F-ONT-05). */
export function kbOntologyProposalPath(kbId: string, proposalId: string): string {
  const params = new URLSearchParams({
    ontologyTab: 'versions',
    ontologyProposal: proposalId,
  });
  return `${kbPath(kbId, 'ontology')}?${params.toString()}`;
}

export function parseKbIdFromPath(pathname: string): string | null {
  const match = /^\/kbs\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) return null;
  const id = match[1];
  if (!id || id === 'undefined') return null;
  return id as string;
}

export function isKbScopedPath(pathname: string): boolean {
  const id = parseKbIdFromPath(pathname);
  if (!id) return false;
  const rest = pathname.slice(`/kbs/${id}`.length);
  if (!rest || rest === '/') return false;
  const segment = rest.replace(/^\//, '').split('/')[0];
  return KB_NAV.some((item) => item.segment === segment);
}
