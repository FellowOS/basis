import { Navigate, Route, Routes } from 'react-router-dom';
import { PlatformAdminLayout } from '@/components/admin/platform-admin-layout.js';
import { BasisLayout } from '@/components/app/shared/shell/basis-layout.js';
import { HomePage } from '@/modules/home/index.js';
import { LoginPage } from '@/modules/login/index.js';
import {
  AdminConnectorsPage,
  AuditPage,
  DocsPage,
  AlertsPage,
  AnalyzePage,
  ConnectorMappingEditPage,
  ConnectorMappingNewPage,
  ConnectorOAuthCallbackPage,
  ConnectorsPage,
  ConnectorsRedirect,
  DataOnboardingRedirect,
  DecisionsPage,
  EntitiesPage,
  EntityResolutionPage,
  GraphDiffPage,
  GraphPage,
  IntegrationPage,
  LibraryPage,
  LineagePage,
  MappingsPage,
  OntologyPage,
  ProcessingPage,
  ReviewPage,
  SearchPage,
  SetupPage,
  WorkspacesPage,
  VocabularyPage,
  ModelsPage,
  SettingsPage,
  WorkspaceSettingsPage,
  SwaggerPage,
  UsersPage,
} from '@/routes/lazy-pages.js';
import { basisAuthRequired, basisIsDesktopProduct } from '@/lib/runtime/basis-runtime.js';
import { useBasisSession } from '@/lib/session/basis-session.js';
import { AnalyzeHubTabRedirect, OntologyHubTabRedirect } from '@/modules/analyze/lib/hub-route.js';
import { AdminLandingRedirect } from '@/routes/admin-landing-redirect.js';
import {
  AdminOnly,
  WorkspaceDefaultRedirect,
  LegacyChatRedirect,
  LegacyKnowledgeRedirect,
  LegacyLibraryRedirect,
  LegacyMcpRedirect,
  SettingsAccess,
} from '@/routes/guards.js';
import { WorkspacesLandingRedirect } from '@/routes/workspaces-landing-redirect.js';
import { Lazy, WorkspaceLazy } from '@/routes/ui.js';

function SparqlLegacyRedirect() {
  return <AnalyzeHubTabRedirect tab="sparql" />;
}

function ReasoningLegacyRedirect() {
  return <AnalyzeHubTabRedirect tab="reasoning" />;
}

function AlignmentsLegacyRedirect() {
  return <OntologyHubTabRedirect tab="alignments" />;
}

function ShaclLegacyRedirect() {
  return <OntologyHubTabRedirect tab="shacl" />;
}

function OntologyVersionsLegacyRedirect() {
  return <OntologyHubTabRedirect tab="versions" />;
}

/** React Router tree for the Basis console (`app.tsx` wraps this in `BasisSessionProvider`). */
export function AppRoutes() {
  const { ready, user, homePath, logout } = useBasisSession();
  const authRequired = basisAuthRequired();
  const desktopProduct = basisIsDesktopProduct();

  return (
    <Routes>
      <Route
        path="/"
        element={
          authRequired
            ? ready && user
              ? <Navigate to={homePath} replace />
              : <HomePage />
            : ready
              ? <Navigate to={homePath} replace />
              : null
        }
      />
      <Route
        path="/login"
        element={
          !basisAuthRequired() ? (
            <Navigate to={homePath} replace />
          ) : ready && user ? (
            <Navigate to={homePath} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/swagger" element={<Lazy><SwaggerPage /></Lazy>} />
      <Route path="/docs" element={<Lazy><DocsPage /></Lazy>} />
      <Route path="/docs/*" element={<Lazy><DocsPage /></Lazy>} />
      <Route
        element={
          authRequired && ready && !user ? (
            <Navigate to="/" replace />
          ) : !authRequired && !ready ? null : (
            <BasisLayout onLogout={() => void logout()} />
          )
        }
      >
        <Route path="/workspaces" element={<WorkspacesLandingRedirect />} />
        <Route path="/admin" element={<PlatformAdminLayout />}>
          <Route index element={<AdminLandingRedirect />} />
          <Route
            path="workspaces"
            element={
              <AdminOnly>
                <Lazy><WorkspacesPage /></Lazy>
              </AdminOnly>
            }
          />
          <Route
            path="users"
            element={
              desktopProduct ? (
                <Navigate to={homePath} replace />
              ) : (
                <AdminOnly>
                  <Lazy><UsersPage /></Lazy>
                </AdminOnly>
              )
            }
          />
          <Route
            path="models"
            element={
              <AdminOnly>
                <Lazy><ModelsPage /></Lazy>
              </AdminOnly>
            }
          />
          <Route
            path="audit"
            element={
              <AdminOnly>
                <Lazy><AuditPage /></Lazy>
              </AdminOnly>
            }
          />
          <Route
            path="connectors"
            element={
              <AdminOnly>
                <Lazy><AdminConnectorsPage /></Lazy>
              </AdminOnly>
            }
          />
          <Route
            path="settings"
            element={
              desktopProduct ? (
                <Navigate to={homePath} replace />
              ) : (
                <SettingsAccess>
                  <Lazy><SettingsPage /></Lazy>
                </SettingsAccess>
              )
            }
          />
        </Route>
        <Route path="/workspaces/all" element={<Navigate to="/admin/workspaces" replace />} />
        <Route path="/users" element={<Navigate to="/admin/users" replace />} />
        <Route path="/models" element={<Navigate to="/admin/models" replace />} />
        <Route path="/audit" element={<Navigate to="/admin/audit" replace />} />
        <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/tokens" element={<Navigate to="/workspaces" replace />} />

        <Route path="/workspaces/setup/*" element={<Lazy><SetupPage /></Lazy>} />
        <Route path="/workspaces/:id" element={<WorkspaceDefaultRedirect />} />
        <Route path="/workspaces/:id/knowledge" element={<LegacyKnowledgeRedirect />} />
        <Route path="/workspaces/:id/graph-diff" element={<WorkspaceLazy><GraphDiffPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/graph" element={<WorkspaceLazy><GraphPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/search" element={<WorkspaceLazy><SearchPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/chat" element={<LegacyChatRedirect />} />
        <Route path="/workspaces/:id/library" element={<LegacyLibraryRedirect />} />
        <Route path="/workspaces/:id/sources" element={<Lazy><LibraryPage /></Lazy>} />
        <Route path="/workspaces/:id/onboarding/data" element={<Lazy><DataOnboardingRedirect /></Lazy>} />
        <Route
          path="/workspaces/:id/connectors/mappings/new"
          element={<Lazy><ConnectorMappingNewPage /></Lazy>}
        />
        <Route
          path="/workspaces/:id/connectors/mappings/:mappingId/edit"
          element={<Lazy><ConnectorMappingEditPage /></Lazy>}
        />
        <Route
          path="/workspaces/:id/connectors/oauth/callback"
          element={<Lazy><ConnectorOAuthCallbackPage /></Lazy>}
        />
        <Route path="/workspaces/:id/connectors/:panel" element={<Lazy><ConnectorsPage /></Lazy>} />
        <Route path="/workspaces/:id/connectors" element={<Lazy><ConnectorsRedirect /></Lazy>} />
        <Route path="/workspaces/:id/processing" element={<Lazy><ProcessingPage /></Lazy>} />
        <Route path="/workspaces/:id/entities" element={<WorkspaceLazy><EntitiesPage /></WorkspaceLazy>} />
        <Route
          path="/workspaces/:id/entity-resolution"
          element={<WorkspaceLazy><EntityResolutionPage /></WorkspaceLazy>}
        />
        <Route path="/workspaces/:id/decisions" element={<WorkspaceLazy><DecisionsPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/review" element={<WorkspaceLazy><ReviewPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/ontology" element={<WorkspaceLazy><OntologyPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/analyze" element={<WorkspaceLazy><AnalyzePage /></WorkspaceLazy>} />
        <Route
          path="/workspaces/:id/ontology-versions"
          element={<WorkspaceLazy><OntologyVersionsLegacyRedirect /></WorkspaceLazy>}
        />
        <Route path="/workspaces/:id/shacl" element={<WorkspaceLazy><ShaclLegacyRedirect /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/alignments" element={<WorkspaceLazy><AlignmentsLegacyRedirect /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/sparql" element={<WorkspaceLazy><SparqlLegacyRedirect /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/reasoning" element={<WorkspaceLazy><ReasoningLegacyRedirect /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/vocabulary" element={<WorkspaceLazy><VocabularyPage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/lineage" element={<WorkspaceLazy><LineagePage /></WorkspaceLazy>} />
        <Route path="/workspaces/:id/mappings" element={<Lazy><MappingsPage /></Lazy>} />
        <Route path="/workspaces/:id/alerts" element={<Lazy><AlertsPage /></Lazy>} />
        <Route path="/workspaces/:id/integration" element={<Lazy><IntegrationPage /></Lazy>} />
        <Route path="/workspaces/:id/mcp" element={<LegacyMcpRedirect />} />
        <Route path="/workspaces/:id/settings" element={<Lazy><WorkspaceSettingsPage /></Lazy>} />
      </Route>
    </Routes>
  );
}
