export const kbDataOnboarding = {
  title: 'Data & ontology setup',
  subtitle:
    'Connect external systems, accept suggested connector mappings, and run a first sync into the ledger (no OWL publish step).',
  steps: {
    connections: 'Connections',
    suggest: 'Suggested mappings',
    done: 'First sync',
  },
  connectionsTitle: 'Configured connections',
  connectionsSubtitle: 'Add connections in the catalog if this list is empty.',
  loadingConnections: 'Loading connections…',
  noConnections: 'No connections yet. Connect a database or SaaS source first.',
  openCatalog: 'Open connector catalog',
  sqlTablesLabel: 'SQL tables (optional)',
  sqlTablesPlaceholder: 'accounts\ncustomers\npostgres:orders',
  sqlTablesHint:
    'One table per line. Prefix with service name for multiple SQL connections (e.g. postgres:public.users).',
  continueToSuggest: 'Suggest mappings',
  suggestTitle: 'Cross-stream mapping suggestions',
  suggestSubtitle: 'Review drafts grouped by entity type, then save and sync.',
  suggestHint: 'Open the suggestion panel to preview drafts from DISCOVER on your connections.',
  reopenSuggest: 'Open suggestions',
  doneTitle: 'Mappings saved',
  doneSubtitle: '{count} connector mapping(s) created with an initial sync.',
  viewMappings: 'View connector mappings',
  viewEntities: 'View entities',
};
