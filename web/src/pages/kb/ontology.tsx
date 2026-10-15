import { useCallback, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import {
  KbOntologyWorkspace,
  type OntologyHubPageActions,
} from '@/components/kb/workspaces/kb-ontology-workspace.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';
import { Plus } from 'lucide-react';

export function KbOntologyPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const { getKb } = useKbCatalog();
  const [pageActions, setPageActions] = useState<OntologyHubPageActions | null>(null);
  const onPageActionsChange = useCallback((actions: OntologyHubPageActions | null) => {
    setPageActions(actions);
  }, []);

  if (!id) {
    return null;
  }

  const legacyTab = searchParams.get('ontologyTab');
  const legacySearch = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('ontologyTab');
    const q = params.toString();
    return q ? `?${q}` : '';
  };
  if (legacyTab === 'sparql') {
    return <Navigate to={kbPath(id, 'sparql')} replace />;
  }
  if (legacyTab === 'reasoning') {
    return <Navigate to={kbPath(id, 'reasoning')} replace />;
  }
  if (legacyTab === 'versions' || searchParams.has('ontologyProposal')) {
    return <Navigate to={`${kbPath(id, 'ontology-versions')}${legacySearch()}`} replace />;
  }
  if (legacyTab === 'shacl') {
    return <Navigate to={kbPath(id, 'shacl')} replace />;
  }
  if (legacyTab === 'alignments') {
    return <Navigate to={kbPath(id, 'alignments')} replace />;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.ontology },
      ]}
      subtitle={t.pages.kbSubtitles.ontology}
      actions={
        pageActions ? (
          <Button type="button" size="sm" onClick={pageActions.openLoadOntology}>
            <Plus size={14} />
            {zh ? '加载本体' : 'Load ontology'}
          </Button>
        ) : undefined
      }
      className="min-h-0 flex-1 overflow-hidden"
    >
      <KbOntologyWorkspace
        kbId={id}
        className="h-[calc(100svh-12rem)] min-h-[28rem] flex-1 rounded-lg border border-border"
        onPageActionsChange={onPageActionsChange}
      />
    </ConsolePageLayout>
  );
}
