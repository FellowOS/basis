import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '@/lib/api.js';
import type { KbNavKey } from '@/lib/nav-config.js';
import { parseKbIdFromPath } from '@/lib/nav-config.js';

export type KbCapabilities = {
  kb_id: string;
  role: string;
  graph: boolean;
  graph_write: boolean;
  temporal: boolean;
  decisions: boolean;
  sparql: boolean;
  reasoning: boolean;
  enrichment: boolean;
  review: boolean;
  direct_graph_merge: boolean;
  direct_graph_import: boolean;
  import_export: boolean;
  provenance: boolean;
  vocabulary: boolean;
  mappings: boolean;
  agent_memory: boolean;
  explorer_runtime: boolean;
  diagnostic: string | null;
};

type KbCapabilitiesContextValue = {
  kbId: string | null;
  caps: KbCapabilities | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const KbCapabilitiesContext = createContext<KbCapabilitiesContextValue | null>(null);

export function KbCapabilitiesProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const kbId = parseKbIdFromPath(pathname);
  const [caps, setCaps] = useState<KbCapabilities | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!kbId) {
      setCaps(null);
      return;
    }
    setLoading(true);
    try {
      const body = await api<KbCapabilities>(`/api/kbs/${kbId}/capabilities`);
      setCaps(body);
    } catch {
      setCaps(null);
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ kbId, caps, loading, refresh }),
    [kbId, caps, loading, refresh],
  );

  return (
    <KbCapabilitiesContext.Provider value={value}>{children}</KbCapabilitiesContext.Provider>
  );
}

export function useKbCapabilitiesOptional(): KbCapabilitiesContextValue | null {
  return useContext(KbCapabilitiesContext);
}

export function useKbCapabilities(): KbCapabilitiesContextValue {
  const ctx = useKbCapabilitiesOptional();
  if (!ctx) {
    throw new Error('useKbCapabilities requires KbCapabilitiesProvider');
  }
  return ctx;
}

/** Whether a KB sidebar segment should be navigable for the current capability set. */
export function kbNavSegmentEnabled(segment: string, caps: KbCapabilities | null): boolean {
  if (!caps) return true;
  if (segment === 'graph-diff') return caps.graph;
  const key = segment as KbNavKey;
  switch (key) {
    case 'graph':
    case 'search':
      return caps.graph;
    case 'lineage':
      return caps.provenance && caps.graph;
    case 'chat':
      return true;
    case 'ontology':
      return caps.sparql || caps.reasoning;
    case 'review':
      return caps.enrichment || caps.decisions;
    case 'sources':
    case 'processing':
    case 'entities':
      return true;
    case 'vocabulary':
      return caps.vocabulary;
    case 'mappings':
    case 'settings':
      return true;
    default:
      return true;
  }
}
