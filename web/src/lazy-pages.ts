import { lazy } from 'react';

export const BasisLayout = lazy(() =>
  import('@/components/app/shared/shell/basis-layout').then((m) => ({ default: m.BasisLayout })),
);
export const KbsPage = lazy(() => import('@/pages/kbs').then((m) => ({ default: m.KbsPage })));
export const KbSettingsPage = lazy(() =>
  import('@/pages/kb/settings').then((m) => ({ default: m.KbSettingsPage })),
);
export const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage })),
);
export const ModelsPage = lazy(() =>
  import('@/pages/models').then((m) => ({ default: m.ModelsPage })),
);
export const AuditPage = lazy(() =>
  import('@/pages/audit').then((m) => ({ default: m.AuditPage })),
);
export const AdminConnectorsPage = lazy(() =>
  import('@/pages/admin-connectors').then((m) => ({ default: m.AdminConnectorsPage })),
);
export const SwaggerPage = lazy(() =>
  import('@/pages/swagger').then((m) => ({ default: m.SwaggerPage })),
);
export const DocsPage = lazy(() =>
  import('@/pages/docs').then((m) => ({ default: m.DocsPage })),
);
export const UsersPage = lazy(() =>
  import('@/pages/users').then((m) => ({ default: m.UsersPage })),
);
export const KbGraphPage = lazy(() =>
  import('@/pages/kb/graph').then((m) => ({ default: m.KbGraphPage })),
);
export const KbLibraryPage = lazy(() =>
  import('@/pages/kb/library').then((m) => ({ default: m.KbLibraryPage })),
);
export const KbConnectorsPage = lazy(() =>
  import('@/pages/kb/connectors').then((m) => ({ default: m.KbConnectorsPage })),
);
export const KbConnectorOAuthCallbackPage = lazy(() =>
  import('@/pages/kb/connector-oauth-callback').then((m) => ({
    default: m.KbConnectorOAuthCallbackPage,
  })),
);
export const KbConnectorsRedirect = lazy(() =>
  import('@/pages/kb/connectors').then((m) => ({ default: m.KbConnectorsRedirect })),
);
export const KbConnectorMappingNewPage = lazy(() =>
  import('@/pages/kb/connector-mapping-new').then((m) => ({
    default: m.KbConnectorMappingNewPage,
  })),
);
export const KbConnectorMappingEditPage = lazy(() =>
  import('@/pages/kb/connector-mapping-edit').then((m) => ({
    default: m.KbConnectorMappingEditPage,
  })),
);
export const KbProcessingPage = lazy(() =>
  import('@/pages/kb/processing').then((m) => ({ default: m.KbProcessingPage })),
);
export const KbEntitiesPage = lazy(() =>
  import('@/pages/kb/entities').then((m) => ({ default: m.KbEntitiesPage })),
);
export const KbSectionPage = lazy(() =>
  import('@/pages/kb/kb-section-page').then((m) => ({ default: m.KbSectionPage })),
);
export const KbReviewPage = lazy(() =>
  import('@/pages/kb/review').then((m) => ({ default: m.KbReviewPage })),
);
export const KbEntityResolutionPage = lazy(() =>
  import('@/pages/kb/entity-resolution').then((m) => ({ default: m.KbEntityResolutionPage })),
);
export const KbDecisionsPage = lazy(() =>
  import('@/pages/kb/decisions').then((m) => ({ default: m.KbDecisionsPage })),
);
export const KbOntologyPage = lazy(() =>
  import('@/pages/kb/ontology').then((m) => ({ default: m.KbOntologyPage })),
);
export const KbAnalyzePage = lazy(() =>
  import('@/pages/kb/analyze').then((m) => ({ default: m.KbAnalyzePage })),
);
export const KbOntologyVersionsPage = lazy(() =>
  import('@/pages/kb/ontology-versions').then((m) => ({ default: m.KbOntologyVersionsPage })),
);
export const KbShaclPage = lazy(() =>
  import('@/pages/kb/shacl').then((m) => ({ default: m.KbShaclPage })),
);
export const KbAlignmentsPage = lazy(() =>
  import('@/pages/kb/alignments').then((m) => ({ default: m.KbAlignmentsPage })),
);
export const KbSparqlPage = lazy(() =>
  import('@/pages/kb/sparql').then((m) => ({ default: m.KbSparqlPage })),
);
export const KbReasoningPage = lazy(() =>
  import('@/pages/kb/reasoning').then((m) => ({ default: m.KbReasoningPage })),
);
export const KbSearchPage = lazy(() =>
  import('@/pages/kb/search').then((m) => ({ default: m.KbSearchPage })),
);
export const KbMappingsPage = lazy(() =>
  import('@/pages/kb/mappings').then((m) => ({ default: m.KbMappingsPage })),
);
export const KbVocabularyPage = lazy(() =>
  import('@/pages/kb/vocabulary').then((m) => ({ default: m.KbVocabularyPage })),
);
export const KbIntegrationPage = lazy(() =>
  import('@/pages/kb/integration').then((m) => ({ default: m.KbIntegrationPage })),
);
export const KbLineagePage = lazy(() =>
  import('@/pages/kb/lineage').then((m) => ({ default: m.KbLineagePage })),
);
export const KbGraphDiffPage = lazy(() =>
  import('@/pages/kb/graph-diff').then((m) => ({ default: m.KbGraphDiffPage })),
);
export const KbAlertsPage = lazy(() =>
  import('@/pages/kb/alerts').then((m) => ({ default: m.KbAlertsPage })),
);
