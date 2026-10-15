import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import {
  KbSparqlWorkspace,
  type KbSparqlPageActions,
} from '@/components/kb/workspaces/kb-sparql-workspace.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';
import { Copy, Download, Play } from 'lucide-react';

export function KbSparqlPage() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const { getKb } = useKbCatalog();
  const [pageActions, setPageActions] = useState<KbSparqlPageActions | null>(null);
  const onPageActionsChange = useCallback((actions: KbSparqlPageActions | null) => {
    setPageActions(actions);
  }, []);

  if (!id) {
    return null;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.sparql },
      ]}
      subtitle={t.pages.kbSubtitles.sparql}
      actions={
        pageActions ? (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={pageActions.copyQuery}>
              <Copy size={14} />
              {zh ? '复制查询' : 'Copy query'}
            </Button>
            {pageActions.canExportCsv ? (
              <Button type="button" size="sm" variant="outline" onClick={pageActions.exportCsv}>
                <Download size={14} />
                {zh ? '导出 CSV' : 'Export CSV'}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pageActions.loading}
              onClick={pageActions.run}
            >
              {pageActions.loading ? <Spinner className="size-4" /> : <Play size={14} />}
              {pageActions.loading
                ? zh
                  ? '执行中…'
                  : 'Running…'
                : zh
                  ? '执行查询'
                  : 'Run query'}
            </Button>
          </div>
        ) : undefined
      }
      className="min-h-0 overflow-hidden"
    >
      <KbSparqlWorkspace
        kbId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
        onPageActionsChange={onPageActionsChange}
      />
    </ConsolePageLayout>
  );
}
