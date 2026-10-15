import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath } from '@/lib/nav-config.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';

export function KbExplorerUnavailable({
  kbId,
  feature,
}: {
  kbId: string;
  feature?: 'graph' | 'sparql' | 'review' | 'import' | 'vocabulary' | 'lineage';
}) {
  const { t, locale } = useI18n();
  const { caps } = useKbCapabilities();

  const message =
    caps?.diagnostic === 'explorer_unavailable'
      ? t.menu.capabilities.explorerUnavailable
      : t.menu.capabilities.unavailable;

  const featureHint =
    feature === 'import' && caps && !caps.import_export && caps.explorer_runtime
      ? locale === 'zh'
        ? '需要编辑者权限才能导入图数据。'
        : 'Editor role is required to import graph data.'
      : null;

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">{t.menu.capabilities.workspaceDisabledTitle}</h2>
        <p className="text-sm text-muted-foreground">{featureHint ?? message}</p>
      </div>
      <Button variant="outline" asChild>
        <Link to={kbPath(kbId, 'sources')}>{t.menu.kb.sources}</Link>
      </Button>
    </div>
  );
}
