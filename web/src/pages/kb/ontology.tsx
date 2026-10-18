import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useCallback, useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import {
  KbOntologyWorkspace,
  type OntologyHubPageActions,
} from '@/components/app/kb/workspaces/kb-ontology-workspace.js';
import { KbOntologyVersionsWorkspace } from '@/components/app/kb/workspaces/kb-ontology-versions-workspace.js';
import { KbShaclWorkspace } from '@/components/app/kb/workspaces/kb-shacl-workspace.js';
import { KbAlignmentsWorkspace } from '@/components/app/kb/workspaces/kb-alignments-workspace.js';
import { Button } from '@/components/ui/button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import type { OntologyHubTab } from '@/lib/kb-hub-route.js';
import { kbAnalyzeHubPath } from '@/lib/kb-hub-route.js';
import {
  normalizeOntologyHubTabId,
  ontologyHubTabEnabled,
  resolveOntologyHubTab,
} from '@/lib/kb-hub-tabs.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbPath } from '@/lib/nav-config.js';

const WORKSPACE_CLASS = 'min-h-0 flex-1 rounded-lg border border-border';
const INTERIOR_WORKSPACE_CLASS = 'h-[calc(100svh-14rem)] min-h-[28rem] flex-1 rounded-lg border border-border';

function ontologyHubSearchRedirect(
  kbId: string,
  searchParams: URLSearchParams,
  tab: OntologyHubTab,
): string {
  const params = new URLSearchParams(searchParams);
  params.delete('ontologyTab');
  if (tab === 'registry') {
    params.delete('tab');
  } else {
    params.set('tab', tab);
  }
  const q = params.toString();
  return `${kbPath(kbId, 'ontology')}${q ? `?${q}` : ''}`;
}

export function KbOntologyPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  const { caps } = useKbCapabilities();
  const [pageActions, setPageActions] = useState<OntologyHubPageActions | null>(null);
  const onPageActionsChange = useCallback((actions: OntologyHubPageActions | null) => {
    setPageActions(actions);
  }, []);

  const legacyOntologyTab = searchParams.get('ontologyTab');
  const rawTabParam = searchParams.get('tab');

  const tab = useMemo(
    () =>
      resolveOntologyHubTab(
        rawTabParam,
        legacyOntologyTab,
        searchParams.has('ontologyProposal'),
        searchParams.has('ontologyEntity'),
        caps,
      ),
    [caps, legacyOntologyTab, rawTabParam, searchParams],
  );

  if (!id) {
    return null;
  }

  if (legacyOntologyTab === 'sparql') {
    return <Navigate to={kbAnalyzeHubPath(id, 'sparql')} replace />;
  }
  if (legacyOntologyTab === 'reasoning') {
    return <Navigate to={kbAnalyzeHubPath(id, 'reasoning')} replace />;
  }

  if (legacyOntologyTab) {
    const legacyMapped = normalizeOntologyHubTabId(legacyOntologyTab);
    if (legacyMapped) {
      return <Navigate to={ontologyHubSearchRedirect(id, searchParams, legacyMapped)} replace />;
    }
  }

  if (rawTabParam === 'model') {
    return <Navigate to={ontologyHubSearchRedirect(id, searchParams, 'registry')} replace />;
  }

  const kbName = getKb(id)?.name ?? id;
  const hubTabs = t.kbOntology.hubTabs;
  const hubSubtitles = t.kbOntology.hubSubtitles;

  function onTabChange(value: string) {
    const next = value as OntologyHubTab;
    const params = new URLSearchParams(searchParams);
    params.delete('ontologyTab');
    if (next === 'registry') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    setSearchParams(params, { replace: true });
  }

  const onFixInEditor = useCallback(
    (entityUri: string) => {
      const params = new URLSearchParams(searchParams);
      params.delete('ontologyTab');
      params.set('tab', 'editor');
      params.set('ontologyEntity', entityUri);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: kbName, to: kbPath(id, 'graph') },
        { label: t.menu.kb.ontology },
      ]}
      subtitle={hubSubtitles[tab]}
      actions={
        tab === 'registry' && pageActions ? (
          <Button type="button" size="sm" onClick={pageActions.openLoadOntology}>
            <PublicIcon name="plus-01" size={14} />
            {t.kbExplorer.loadOntology}
          </Button>
        ) : undefined
      }
      className="min-h-0 flex-1 overflow-hidden"
    >
      <Tabs value={tab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="registry" disabled={!ontologyHubTabEnabled('registry', caps)}>
            {hubTabs.registry}
          </TabsTrigger>
          <TabsTrigger value="editor" disabled={!ontologyHubTabEnabled('editor', caps)}>
            {hubTabs.editor}
          </TabsTrigger>
          <TabsTrigger value="health" disabled={!ontologyHubTabEnabled('health', caps)}>
            {hubTabs.health}
          </TabsTrigger>
          <TabsTrigger value="versions" disabled={!ontologyHubTabEnabled('versions', caps)}>
            {hubTabs.versions}
          </TabsTrigger>
          <TabsTrigger value="shacl" disabled={!ontologyHubTabEnabled('shacl', caps)}>
            {hubTabs.shacl}
          </TabsTrigger>
          <TabsTrigger value="alignments" disabled={!ontologyHubTabEnabled('alignments', caps)}>
            {hubTabs.alignments}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="registry"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbOntologyWorkspace
            kbId={id}
            panel="registry"
            className={INTERIOR_WORKSPACE_CLASS}
            onPageActionsChange={onPageActionsChange}
          />
        </TabsContent>
        <TabsContent
          value="editor"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbOntologyWorkspace kbId={id} panel="editor" className={INTERIOR_WORKSPACE_CLASS} />
        </TabsContent>
        <TabsContent
          value="health"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbOntologyWorkspace
            kbId={id}
            panel="health"
            className={INTERIOR_WORKSPACE_CLASS}
            onFixInEditor={onFixInEditor}
          />
        </TabsContent>
        <TabsContent
          value="versions"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbOntologyVersionsWorkspace kbId={id} className={WORKSPACE_CLASS} />
        </TabsContent>
        <TabsContent
          value="shacl"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbShaclWorkspace kbId={id} className={WORKSPACE_CLASS} />
        </TabsContent>
        <TabsContent
          value="alignments"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbAlignmentsWorkspace kbId={id} className="min-h-0 flex-1" />
        </TabsContent>
      </Tabs>
    </ConsolePageLayout>
  );
}
