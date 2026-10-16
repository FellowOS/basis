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
import { api } from '@/lib/api.js';

export type KbSummary = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  my_role: string;
};

type KbContextValue = {
  kbs: KbSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  getKb: (id: string) => KbSummary | undefined;
};

const KbContext = createContext<KbContextValue | null>(null);

export function useKbCatalog(): KbContextValue {
  const ctx = useContext(KbContext);
  if (!ctx) throw new Error(devMessage('useKbCatalog'));
  return ctx;
}

export function KbProvider({ children }: { children: ReactNode }) {
  const [kbs, setKbs] = useState<KbSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const body = await api<{ kbs: KbSummary[] }>('/api/kbs');
      setKbs(body.kbs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getKb = useCallback((id: string) => kbs.find((kb) => kb.id === id), [kbs]);

  const value = useMemo(
    () => ({
      kbs,
      loading,
      refresh,
      getKb,
    }),
    [kbs, loading, refresh, getKb],
  );

  return <KbContext.Provider value={value}>{children}</KbContext.Provider>;
}
