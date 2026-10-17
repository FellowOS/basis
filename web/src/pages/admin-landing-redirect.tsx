import { Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/basis-session.js';
import { platformAdminEntryPath } from '@/lib/nav-config.js';
import { useSettingsAccess } from '@/lib/use-settings-access.js';

export function AdminLandingRedirect() {
  const { t } = useI18n();
  const { isAdmin, homePath } = useBasisSession();
  const canSettings = useSettingsAccess();

  if (!isAdmin && canSettings === null) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t.common.loading}
      </div>
    );
  }

  const target = platformAdminEntryPath(isAdmin, canSettings === true);
  if (target === '/kbs') {
    return <Navigate to={homePath} replace />;
  }

  return <Navigate to={target} replace />;
}
