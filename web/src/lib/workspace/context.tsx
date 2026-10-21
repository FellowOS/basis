import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { devMessage } from '@/i18n/dev-messages.js';
import { basisSessionClient } from '@/lib/basis-session-client.js';
import { unwrapOpenApi } from '@/lib/openapi-response.js';

export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  my_role: string;
};

type WorkspaceCatalogValue = {
  workspaces: WorkspaceSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  getWorkspace: (id: string) => WorkspaceSummary | undefined;
};

const WorkspaceCatalogContext = createContext<WorkspaceCatalogValue | null>(null);

export function useWorkspaceCatalog(): WorkspaceCatalogValue {
  const ctx = useContext(WorkspaceCatalogContext);
  if (!ctx) throw new Error(devMessage('useWorkspaceCatalog'));
  return ctx;
}

export function WorkspaceCatalogProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const body = unwrapOpenApi(
        await basisSessionClient().openapi().GET('/api/v1/workspaces'),
      ) as { kbs: WorkspaceSummary[] };
      setWorkspaces(body.kbs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getWorkspace = useCallback(
    (id: string) => workspaces.find((ws) => ws.id === id),
    [workspaces],
  );

  const value = useMemo(
    () => ({
      workspaces,
      loading,
      refresh,
      getWorkspace,
    }),
    [workspaces, loading, refresh, getWorkspace],
  );

  return <WorkspaceCatalogContext.Provider value={value}>{children}</WorkspaceCatalogContext.Provider>;
}
