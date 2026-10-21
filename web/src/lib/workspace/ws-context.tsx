import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@/i18n/context.js';
import { devMessage } from '@/i18n/dev-messages.js';
import { WorkspaceWsClient } from '@/lib/workspace/ws-client.js';

const WorkspaceWsContext = createContext<WorkspaceWsClient | null>(null);

export function WorkspaceWsProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setGeneration((g) => g + 1);
  }, [workspaceId]);

  const client = useMemo(() => {
    const controller = new AbortController();
    const instance = new WorkspaceWsClient(workspaceId, controller.signal, locale);
    return { instance, controller };
  }, [workspaceId, generation, locale]);

  useEffect(() => () => client.controller.abort(), [client]);

  return (
    <WorkspaceWsContext.Provider value={client.instance}>{children}</WorkspaceWsContext.Provider>
  );
}

export function WorkspaceRouteShell({ children }: { children: ReactNode }) {
  const { id } = useParams();
  if (!id) return children;
  return <WorkspaceWsProvider workspaceId={id}>{children}</WorkspaceWsProvider>;
}

export function useWorkspaceWsClient(): WorkspaceWsClient {
  const client = useContext(WorkspaceWsContext);
  if (!client) {
    throw new Error(devMessage('useWorkspaceWsClient'));
  }
  return client;
}
