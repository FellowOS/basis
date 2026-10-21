import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { workspacePath } from '@/lib/nav/nav-config.js';
import { useWorkspaceCapabilities } from '@/lib/workspace/capabilities.js';

export function WorkspaceUnavailable({
  workspaceId,
  feature,
}: {
  workspaceId: string;
  feature?: 'graph' | 'sparql' | 'review' | 'import' | 'vocabulary' | 'lineage';
}) {
  const { t } = useI18n();
  const { caps } = useWorkspaceCapabilities();

  const message =
    caps?.diagnostic === 'explorer_unavailable'
      ? t.core.workspace_nav.capabilities.explorer_unavailable
      : t.core.workspace_nav.capabilities.unavailable;

  const featureHint =
    feature === 'import' && caps && !caps.import_export && caps.explorer_runtime
      ? t.core.workspace_nav.capabilities.import_editor_required
      : null;

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PublicIcon name='alert-circle' className="size-6" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">{t.core.workspace_nav.capabilities.feature_unavailable_title}</h2>
        <p className="text-sm text-muted-foreground">{featureHint ?? message}</p>
      </div>
      <Button variant="outline" asChild>
        <Link to={workspacePath(workspaceId, 'sources')}>{t.library.menu.sources}</Link>
      </Button>
    </div>
  );
}
