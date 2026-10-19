import { Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  AuditPage,
  AdminConnectorsPage,
  KbGraphPage,
  KbLibraryPage,
  KbConnectorsPage,
  KbConnectorsRedirect,
  KbConnectorMappingNewPage,
  KbConnectorMappingEditPage,
  KbConnectorOAuthCallbackPage,
  KbProcessingPage,
  KbEntitiesPage,
  KbSearchPage,
  KbOntologyPage,
  KbAnalyzePage,
  KbOntologyVersionsPage,
  KbShaclPage,
  KbAlignmentsPage,
  KbSparqlPage,
  KbReasoningPage,
  KbReviewPage,
  KbEntityResolutionPage,
  KbDecisionsPage,
  KbIntegrationPage,
  KbMappingsPage,
  KbVocabularyPage,
  KbLineagePage,
  KbGraphDiffPage,
  KbAlertsPage,
  KbSectionPage,
  KbSettingsPage,
  KbsPage,
  ModelsPage,
  BasisLayout,
  SettingsPage,
  SwaggerPage,
  DocsPage,
  UsersPage,
} from '@/lazy-pages.js';
import { HomePage } from '@/pages/home.js';
import { LoginPage } from '@/pages/login.js';
import { PlatformAdminLayout } from '@/components/admin/platform-admin-layout.js';
import { AdminLandingRedirect } from '@/pages/admin-landing-redirect.js';
import { KbsLandingRedirect } from '@/pages/kbs-landing-redirect.js';
import { KbSetupWorkspacePage } from '@/pages/kb/setup-workspace.js';
import { isSetupKbId, KB_SETUP_ID } from '@/lib/kb-active-id.js';
import { kbPath } from '@/lib/nav-config.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';
import { BasisSessionProvider, useBasisSession } from '@/lib/basis-session.js';
import { basisAuthRequired } from '@/lib/basis-runtime.js';
import { useSettingsAccess } from '@/lib/use-settings-access.js';

function AdminOnly({ children }: { children: ReactNode }) {
  const { ready, user, homePath, isAdmin } = useBasisSession();
  if (!ready) return null;
  if (!user || !isAdmin) return <Navigate to={homePath} replace />;
  return children;
}

function SettingsAccess({ children }: { children: ReactNode }) {
  const { ready, user, homePath } = useBasisSession();
  const allowed = useSettingsAccess();

  if (!ready) return children;
  if (!user) return <Navigate to="/login" replace />;
  if (allowed === null) return null;
  if (!allowed) return <Navigate to={homePath} replace />;
  return children;
}

function KbDefaultRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/kbs" replace />;
  if (isSetupKbId(id)) return <Navigate to={kbPath(KB_SETUP_ID, 'graph')} replace />;
  return <Navigate to={`/kbs/${id}/graph`} replace />;
}

function KbLegacyKnowledgeRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/kbs" replace />;
  return <Navigate to={`/kbs/${id}/sources`} replace />;
}

function KbLegacyLibraryRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/kbs" replace />;
  return <Navigate to={`/kbs/${id}/sources`} replace />;
}

/** Legacy Playground URL; F-CHAT-01–03 removed from console (see progress §6). */
function KbLegacyChatRedirect() {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return <Navigate to="/kbs" replace />;
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'connect') {
    return <Navigate to={`${kbPath(id, 'integration')}?tab=mcp`} replace />;
  }
  return <Navigate to={kbPath(id, 'search')} replace />;
}

function KbLegacyMcpRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/kbs" replace />;
  return <Navigate to={`${kbPath(id, 'integration')}?tab=mcp`} replace />;
}

function AuthedApp() {
  const { ready, user, homePath, logout } = useBasisSession();
  const authRequired = basisAuthRequired();

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
          ready && user ? <Navigate to={homePath} replace /> : <LoginPage />
        }
      />
      <Route
        path="/swagger"
        element={
          <Suspense fallback={null}>
            <SwaggerPage />
          </Suspense>
        }
      />
      <Route
        path="/docs"
        element={
          <Suspense fallback={null}>
            <DocsPage />
          </Suspense>
        }
      />
      <Route
        path="/docs/:slug"
        element={
          <Suspense fallback={null}>
            <DocsPage />
          </Suspense>
        }
      />
      <Route
        element={
          authRequired && ready && !user ? (
            <Navigate to="/" replace />
          ) : !authRequired && !ready ? null : (
            <Suspense fallback={null}>
              <BasisLayout onLogout={() => void logout()} />
            </Suspense>
          )
        }
      >
        <Route path="/kbs" element={<KbsLandingRedirect />} />
        <Route path="/kbs/setup/*" element={<KbSetupWorkspacePage />} />
        <Route path="/admin" element={<AdminLandingRedirect />} />
        <Route element={<PlatformAdminLayout />}>
          <Route
            path="/admin/kbs"
            element={
              <AdminOnly>
                <Suspense fallback={null}>
                  <KbsPage />
                </Suspense>
              </AdminOnly>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminOnly>
                <Suspense fallback={null}>
                  <UsersPage />
                </Suspense>
              </AdminOnly>
            }
          />
          <Route
            path="/admin/models"
            element={
              <AdminOnly>
                <Suspense fallback={null}>
                  <ModelsPage />
                </Suspense>
              </AdminOnly>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <AdminOnly>
                <Suspense fallback={null}>
                  <AuditPage />
                </Suspense>
              </AdminOnly>
            }
          />
          <Route
            path="/admin/connectors"
            element={
              <AdminOnly>
                <Suspense fallback={null}>
                  <AdminConnectorsPage />
                </Suspense>
              </AdminOnly>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <SettingsAccess>
                <Suspense fallback={null}>
                  <SettingsPage />
                </Suspense>
              </SettingsAccess>
            }
          />
        </Route>
        <Route path="/kbs/all" element={<Navigate to="/admin/kbs" replace />} />
        <Route path="/users" element={<Navigate to="/admin/users" replace />} />
        <Route path="/models" element={<Navigate to="/admin/models" replace />} />
        <Route path="/audit" element={<Navigate to="/admin/audit" replace />} />
        <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/kbs/:id" element={<KbDefaultRedirect />} />
        <Route path="/kbs/:id/knowledge" element={<KbLegacyKnowledgeRedirect />} />
        <Route
          path="/kbs/:id/graph-diff"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbGraphDiffPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/graph"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbGraphPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/search"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbSearchPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route path="/kbs/:id/chat" element={<KbLegacyChatRedirect />} />
        <Route path="/kbs/:id/library" element={<KbLegacyLibraryRedirect />} />
        <Route
          path="/kbs/:id/sources"
          element={
            <Suspense fallback={null}>
              <KbLibraryPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/connectors/mappings/new"
          element={
            <Suspense fallback={null}>
              <KbConnectorMappingNewPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/connectors/mappings/:mappingId/edit"
          element={
            <Suspense fallback={null}>
              <KbConnectorMappingEditPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/connectors/oauth/callback"
          element={
            <Suspense fallback={null}>
              <KbConnectorOAuthCallbackPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/connectors/:panel"
          element={
            <Suspense fallback={null}>
              <KbConnectorsPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/connectors"
          element={
            <Suspense fallback={null}>
              <KbConnectorsRedirect />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/processing"
          element={
            <Suspense fallback={null}>
              <KbProcessingPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/entities"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbEntitiesPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/entity-resolution"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbEntityResolutionPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/decisions"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbDecisionsPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/review"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbReviewPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/ontology"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbOntologyPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/analyze"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbAnalyzePage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/ontology-versions"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbOntologyVersionsPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/shacl"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbShaclPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/alignments"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbAlignmentsPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/sparql"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbSparqlPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/reasoning"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbReasoningPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/vocabulary"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbVocabularyPage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/lineage"
          element={
            <KbExplorerShell>
              <Suspense fallback={null}>
                <KbLineagePage />
              </Suspense>
            </KbExplorerShell>
          }
        />
        <Route
          path="/kbs/:id/mappings"
          element={
            <Suspense fallback={null}>
              <KbMappingsPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/alerts"
          element={
            <Suspense fallback={null}>
              <KbAlertsPage />
            </Suspense>
          }
        />
        <Route
          path="/kbs/:id/integration"
          element={
            <Suspense fallback={null}>
              <KbIntegrationPage />
            </Suspense>
          }
        />
        <Route path="/kbs/:id/mcp" element={<KbLegacyMcpRedirect />} />
        <Route
          path="/kbs/:id/settings"
          element={
            <Suspense fallback={null}>
              <KbSettingsPage />
            </Suspense>
          }
        />
        <Route path="/tokens" element={<Navigate to="/kbs" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BasisSessionProvider>
      <AuthedApp />
    </BasisSessionProvider>
  );
}
