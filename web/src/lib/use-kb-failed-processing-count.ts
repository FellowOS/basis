import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isSetupKbId, resolveSidebarKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { isKbScopedPath, parseKbIdFromPath } from '@/lib/nav-config.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

type JobsResponse = { jobs: Array<{ status: string }> };

function resolveKbId(pathname: string, kbs: ReturnType<typeof useKbCatalog>['kbs']): string | null {
  const kbScoped = isKbScopedPath(pathname);
  const pathKbId = parseKbIdFromPath(pathname);
  const navKbId = resolveSidebarKbId(pathname, kbs);
  const id = pathKbId && pathKbId !== 'all' && kbScoped ? pathKbId : navKbId;
  if (!id || isSetupKbId(id)) return null;
  return id;
}

/** Failed ingest jobs for sidebar badge (F-SRC-08 ops visibility). */
export function useKbFailedProcessingCount(): number {
  const { pathname } = useLocation();
  const { kbs } = useKbCatalog();
  const kbId = resolveKbId(pathname, kbs);
  const [failed, setFailed] = useState(0);

  const refresh = useCallback(async () => {
    if (!kbId) {
      setFailed(0);
      return;
    }
    try {
      const data = await kbOpenApiGET<JobsResponse>(kbId, 'ingest/jobs', {
        params: { query: { limit: 50 } },
      });
      setFailed(data.jobs.filter((job) => job.status === 'failed').length);
    } catch {
      /* non-blocking */
    }
  }, [kbId]);

  useEffect(() => {
    void refresh();
    if (!kbId) return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [kbId, refresh]);

  useEffect(() => {
    const onJobs = () => void refresh();
    window.addEventListener('kb-processing-changed', onJobs);
    return () => window.removeEventListener('kb-processing-changed', onJobs);
  }, [refresh]);

  return failed;
}
