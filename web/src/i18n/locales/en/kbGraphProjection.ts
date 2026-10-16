export const kbGraphProjection = {
  title: 'Explorer graph projection',
  unavailableDesc: 'Explorer runtime is not available in this environment.',
  description:
    'The canvas reads from the ledger-backed projection. Rebuild replaces the Explorer session from ledger and is audited.',
  openGraph: 'Open graph',
  ledgerRevision: 'Ledger revision',
  projectionStatus: 'Projection status',
  nodesEdges: 'Nodes / edges',
  nodesEdgesValue: '{nodes} / {edges}',
  projectionStatusLabels: {
    clean: 'Clean',
    dirty: 'Dirty',
    building: 'Building',
    failed: 'Failed',
  },
  lastBuilt: 'Last built',
  lastError: 'Last error',
  editorRequired: 'Editor role required to rebuild projection.',
  auditNote: 'Recorded in platform audit as kb.graph.projection_rebuild.',
  viewAuditGraph: 'View graph events in audit',
} as const;
