import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { KbSparqlWorkspace } from '@/components/app/kb/workspaces/kb-sparql-workspace.js';
import { KbReasoningWorkspace } from '@/components/app/kb/workspaces/kb-reasoning-workspace.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import type { AnalyzeHubTab } from '@/lib/kb-hub-route.js';
import { analyzeHubTabEnabled, resolveAnalyzeHubTab } from '@/lib/kb-hub-tabs.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbPath } from '@/lib/nav-config.js';

const WORKSPACE_CLASS = 'min-h-0 flex-1 rounded-lg border border-border';

export function KbAnalyzePage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  const { caps } = useKbCapabilities();

  const tab = useMemo(
    () => resolveAnalyzeHubTab(searchParams.get('tab'), caps),
    [caps, searchParams],
  );

  if (!id) {
    return null;
  }

  const kbName = getKb(id)?.name ?? id;

  function onTabChange(value: string) {
    const next = value as AnalyzeHubTab;
    const params = new URLSearchParams(searchParams);
    if (next === 'sparql') {
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
        { label: t.menu.kb.analyze },
      ]}
      subtitle={t.pages.kbSubtitles.analyze}
      className="min-h-0 flex-1 overflow-hidden"
    >
      <Tabs value={tab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="sparql" disabled={!analyzeHubTabEnabled('sparql', caps)}>
            {t.menu.kb.sparql}
          </TabsTrigger>
          <TabsTrigger value="reasoning" disabled={!analyzeHubTabEnabled('reasoning', caps)}>
            {t.menu.kb.reasoning}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="sparql"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbSparqlWorkspace kbId={id} className={WORKSPACE_CLASS} />
        </TabsContent>
        <TabsContent
          value="reasoning"
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <KbReasoningWorkspace kbId={id} className={WORKSPACE_CLASS} />
        </TabsContent>
      </Tabs>
    </ConsolePageLayout>
  );
}
