import { useCallback, useEffect, useState } from 'react';
import { workspaceOpenApiGET } from '@/lib/openapi/client.js';

type TemporalBounds = { min?: string | null; max?: string | null };

/** Ledger + graph temporal bounds (`GET .../temporal/bounds`, F-TIM). */
export function useWorkspaceTemporalBounds(workspaceId: string | undefined): {
  bounds: TemporalBounds | null;
  loading: boolean;
} {
  const [bounds, setBounds] = useState<TemporalBounds | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setBounds(null);
      return;
    }
    setLoading(true);
    try {
      const data = await workspaceOpenApiGET<TemporalBounds>(workspaceId, 'temporal/bounds');
      setBounds(data);
    } catch {
      setBounds(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bounds, loading };
}
