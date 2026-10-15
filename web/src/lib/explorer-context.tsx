import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { ExplorerClient } from '@/lib/explorer-client.js';

const ExplorerContext = createContext<ExplorerClient | null>(null);

export function ExplorerProvider({
  kbId,
  children,
}: {
  kbId: string;
  children: ReactNode;
}) {
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setGeneration((g) => g + 1);
  }, [kbId]);

  const client = useMemo(() => {
    const controller = new AbortController();
    const instance = new ExplorerClient(kbId, controller.signal);
    return { instance, controller };
  }, [kbId, generation]);

  useEffect(() => () => client.controller.abort(), [client]);

  return (
    <ExplorerContext.Provider value={client.instance}>{children}</ExplorerContext.Provider>
  );
}

export function KbExplorerShell({ children }: { children: ReactNode }) {
  const { id } = useParams();
  if (!id) return children;
  return <ExplorerProvider kbId={id}>{children}</ExplorerProvider>;
}

export function useExplorerClient(): ExplorerClient {
  const client = useContext(ExplorerContext);
  if (!client) {
    throw new Error('useExplorerClient requires ExplorerProvider');
  }
  return client;
}
