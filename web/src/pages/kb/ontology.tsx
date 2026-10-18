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
import { legacyOntologyTabFromParam, ontologyHubTabEnabled, resolveOntologyHubTab } from '@/lib/kb-hub-tabs.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbPath } from '@/lib/nav-config.js';

const WORKSPACE_CLASS = 'min-h-0 flex-1 rounded-lg border border-border';
const MODEL_WORKSPACE_CLASS = 'h-[calc(100svh-14rem)] min-h-[28rem] flex-1 rounded-lg border border-border';

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

  const tab = useMemo(
    () =>
      resolveOntologyHubTab(
        searchParams.get('tab'),
        legacyOntologyTab,
        searchParams.has('ontologyProposal'),
        caps,
      ),
    [caps, legacyOntologyTab, searchParams],
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
    const mapped = legacyOntologyTabFromParam(legacyOntologyTab);
    if (mapped) {
      const params = new URLSearchParams(searchParams);
      params.delete('ontologyTab');
      params.set('tab', mapped);
      return <Navigate to={`${kbPath(id, 'ontology')}?${params.toString()}`} replace />;
    }
  }

  const kbName = getKb(id)?.name ?? id;

  const subtitleByTab: Record<OntologyHubTab, string | undefined> = {
    model: t.pages.kbSubtitles.ontology,
    versions: t.pages.kbSubtitles.ontologyVersions,
    shacl: undefined,
    alignments: undefined,
  };

  function onTabChange(value: string) {
    const next = value as OntologyHubTab;
    const params = new URLSearchParams(searchParams);
    params.delete('ontologyTab');
    if (next === 'model') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: kbName, to: kbPath(id, 'graph') },
        { label: t.menu.kb.ontology },
      ]}
      subtitle={subtitleByTab[tab]}
      actions={
        tab === 'model' && pageActions ? (
          <Button type="button" size="sm" onClick={pageActions.openLoadOntology}>
            <PublicIcon name="plus-01" size={14} />
            {t.kbExplorer.loadOntology}
          </Button>
        ) : undefined
      }
      className="min-h-0 flex-1 overflow-hidden"
    >
      <Tabs value={tab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="model" disabled={!ontologyHubTabEnabled('model', caps)}>
            {t.menu.kb.ontology}
          </TabsTrigger>
          <TabsTrigger value="versions" disabled={!ontologyHubTabEnabled('versions', caps)}>
            {t.menu.kb.ontologyVersions}
          </TabsTrigger>
          <TabsTrigger value="shacl" disabled={!ontologyHubTabEnabled('shacl', caps)}>
            {t.menu.kb.shacl}
          </TabsTrigger>
          <TabsTrigger value="alignments" disabled={!ontologyHubTabEnabled('alignments', caps)}>
            {t.menu.kb.alignments}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="model"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbOntologyWorkspace
            kbId={id}
            className={MODEL_WORKSPACE_CLASS}
            onPageActionsChange={onPageActionsChange}
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
