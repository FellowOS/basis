import { Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  AuditPage,
  KbGraphPage,
  KbLibraryPage,
  KbEntitiesPage,
  KbSearchPage,
  KbOntologyPage,
  KbReviewPage,
  KbChatPage,
  KbMappingsPage,
  KbVocabularyPage,
  KbSectionPage,
  KbSettingsPage,
  KbsPage,
  ModelsPage,
  SemaLayout,
  SettingsPage,
  UsersPage,
} from '@/lazy-pages.js';
import { HomePage } from '@/pages/home.js';
import { LoginPage } from '@/pages/login.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';
import { SemaSessionProvider, useSemaSession } from '@/lib/sema-session.js';

function AdminOnly({ children }: { children: ReactNode }) {
  const { ready, user, homePath, isAdmin } = useSemaSession();
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
  const { ready, user, homePath, logout } = useSemaSession();

  return (
    <Routes>
      <Route
        path="/"
        element={
          ready && user ? (
            <Navigate to={homePath} replace />
          ) : (
            <HomePage />
          )
        }
      />
      <Route
        path="/login"
        element={
          ready && user ? (
            <Navigate to={homePath} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        element={
          ready && !user ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={null}>
              <SemaLayout onLogout={() => void logout()} />
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
          path="/kbs/:id/mappings"
          element={
            <Suspense fallback={null}>
              <KbMappingsPage />
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
    <SemaSessionProvider>
      <AuthedApp />
    </SemaSessionProvider>
  );
}
