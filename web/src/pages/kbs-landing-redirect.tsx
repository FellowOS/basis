import { Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { isSetupKbId, KB_SETUP_ID, pickDefaultKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbsLandingRedirect() {
  const { t } = useI18n();
  const { kbs, loading } = useKbCatalog();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t.common.loading}
      </div>
    );
  }

  const defaultId = pickDefaultKbId(kbs);
  if (defaultId && !isSetupKbId(defaultId)) {
    return <Navigate to={kbPath(defaultId, 'graph')} replace />;
  }

  return <Navigate to={kbPath(KB_SETUP_ID, 'graph')} replace />;
}
