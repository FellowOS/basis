import { useEffect, useState } from 'react';
import { openApiGET } from '@/lib/openapi/client.js';
import { useBasisSession } from '@/lib/session/basis-session.js';

const ORG_SSO_ADMIN_ROLES = new Set(['owner', 'admin']);

/** Whether the signed-in user may open `/admin/settings` (sysadmin or org owner/admin). */
export function useSettingsAccess(): boolean | null {
  const { user, isAdmin } = useBasisSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setAllowed(false);
      return;
    }
    if (isAdmin) {
      setAllowed(true);
      return;
    }
    openApiGET<{ organizations: Array<{ my_org_role: string | null }> }>('/api/v1/orgs')
      .then((body) => {
        setAllowed(
          body.organizations.some(
            (o) => o.my_org_role != null && ORG_SSO_ADMIN_ROLES.has(o.my_org_role),
          ),
        );
      })
      .catch(() => setAllowed(false));
  }, [isAdmin, user]);

  return allowed;
}
