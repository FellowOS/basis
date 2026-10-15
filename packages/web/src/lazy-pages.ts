import { lazy } from 'react';

export const BasisLayout = lazy(() =>
  import('@/components/basis-layout').then((m) => ({ default: m.BasisLayout })),
);
export const KbsPage = lazy(() => import('@/pages/kbs').then((m) => ({ default: m.KbsPage })));
export const KbSettingsPage = lazy(() =>
  import('@/pages/kb-settings').then((m) => ({ default: m.KbSettingsPage })),
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
export const UsersPage = lazy(() =>
  import('@/pages/users').then((m) => ({ default: m.UsersPage })),
);
export const KbGraphPage = lazy(() =>
  import('@/pages/kb/graph').then((m) => ({ default: m.KbGraphPage })),
);
export const KbLibraryPage = lazy(() =>
  import('@/pages/kb/library').then((m) => ({ default: m.KbLibraryPage })),
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
export const KbOntologyPage = lazy(() =>
  import('@/pages/kb/ontology').then((m) => ({ default: m.KbOntologyPage })),
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
export const KbChatPage = lazy(() =>
  import('@/pages/kb/chat').then((m) => ({ default: m.KbChatPage })),
);
export const KbLineagePage = lazy(() =>
  import('@/pages/kb/lineage').then((m) => ({ default: m.KbLineagePage })),
);
export const KbGraphDiffPage = lazy(() =>
  import('@/pages/kb/graph-diff').then((m) => ({ default: m.KbGraphDiffPage })),
);
