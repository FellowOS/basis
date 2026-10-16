export const kbExplorer = {
  loadingOntology: 'Loading ontology workspace…',
  loadingAlignments: 'Loading ontology alignments…',
  loadingSparql: 'Loading SPARQL workspace…',
  loadingOntologyVersions: 'Loading ontology versions…',
  loadingDecisions: 'Loading decisions…',
  loadOntology: 'Load ontology',
  loadingGraph: 'Loading graph…',
  loadingShacl: 'Loading SHACL studio…',
  loadingReasoning: 'Loading reasoning workspace…',
  loadingReview: 'Loading review queue…',
  kbContextRequired:
    'Explorer API requires a knowledge base (pass kbId or mount ExplorerHostProvider with apiRoot).',
  graphUpdatesWebSocketRequired:
    'Graph updates WebSocket requires ExplorerHostProvider (KB realtime ticket).',
  ontologyKbRequired: 'Ontology workspace requires kbId (OntologyKbProvider).',
  vocabularyKbRequired: 'Vocabulary workspace requires kbId (VocabularyKbProvider).',
  realtimeTicketFailed: 'Realtime ticket failed ({status})',
} as const;
