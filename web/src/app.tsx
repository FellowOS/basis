import { Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  AuditPage,
  KbGraphPage,
  KbLibraryPage,
  KbEntitiesPage,
  KbSearchPage,
  KbOntologyPage,
  KbOntologyVersionsPage,
  KbShaclPage,
  KbAlignmentsPage,
  KbSparqlPage,
  KbReasoningPage,
  KbReviewPage,
  KbEntityResolutionPage,
  KbDecisionsPage,
  KbChatPage,
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
  UsersPage,
} from '@/lazy-pages.js';
import { HomePage } from '@/pages/home.js';
import { LoginPage } from '@/pages/login.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';
import { BasisSessionProvider, useBasisSession } from '@/lib/basis-session.js';

function AdminOnly({ children }: { children: ReactNode }) {
  const { ready, user, homePath, isAdmin } = useBasisSession();
  if (!ready) return children;
  if (!user || !isAdmin) return <Navigate to={homePath} replace />;
  return children;
}

function KbDefaultRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/kbs" replace />;
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

function KbLegacyProcessingRedirect() {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return <Navigate to="/kbs" replace />;
  return <Navigate to={`/kbs/${id}/sources${location.search}`} replace />;
}

function AuthedApp() {
  const { ready, user, homePath, logout } = useBasisSession();

  return (
    <Routes>
      <Route
        path="/"
        element={ready && user ? <Navigate to={homePath} replace /> : <HomePage />}
      />
      <Route
        path="/login"
        element={
          ready && user ? <Navigate to={homePath} replace /> : <LoginPage />
        }
      />
      <Route
        element={
          ready && !user ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={null}>
              <BasisLayout onLogout={() => void logout()} />
            </Suspense>
          )
        }
      >
        <Route
          path="/kbs"
          element={
            <Suspense fallback={null}>
              <KbsPage />
            </Suspense>
          }
        />
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
        <Route
          path="/kbs/:id/chat"
          element={
            <Suspense fallback={null}>
              <KbChatPage />
            </Suspense>
          }
        />
        <Route path="/kbs/:id/library" element={<KbLegacyLibraryRedirect />} />
        <Route
          path="/kbs/:id/sources"
          element={
            <Suspense fallback={null}>
              <KbLibraryPage />
            </Suspense>
          }
        />
        <Route path="/kbs/:id/processing" element={<KbLegacyProcessingRedirect />} />
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
          path="/kbs/:id/settings"
          element={
            <Suspense fallback={null}>
              <KbSettingsPage />
            </Suspense>
          }
        />
        <Route path="/tokens" element={<Navigate to="/kbs" replace />} />
        <Route
          path="/models"
          element={
            <AdminOnly>
              <Suspense fallback={null}>
                <ModelsPage />
              </Suspense>
            </AdminOnly>
          }
        />
        <Route
          path="/settings"
          element={
            <AdminOnly>
              <Suspense fallback={null}>
                <SettingsPage />
              </Suspense>
            </AdminOnly>
          }
        />
        <Route
          path="/audit"
          element={
            <AdminOnly>
              <Suspense fallback={null}>
                <AuditPage />
              </Suspense>
            </AdminOnly>
          }
        />
        <Route
          path="/users"
          element={
            <AdminOnly>
              <Suspense fallback={null}>
                <UsersPage />
              </Suspense>
            </AdminOnly>
          }
        />
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
