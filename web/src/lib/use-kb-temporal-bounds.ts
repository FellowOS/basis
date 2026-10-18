import { useCallback, useEffect, useState } from 'react';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

type TemporalBounds = { min?: string | null; max?: string | null };

/** Ledger + graph temporal bounds (`GET .../temporal/bounds`, F-TIM). */
export function useKbTemporalBounds(kbId: string | undefined): {
  bounds: TemporalBounds | null;
  loading: boolean;
} {
  const [bounds, setBounds] = useState<TemporalBounds | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!kbId) {
      setBounds(null);
      return;
    }
    setLoading(true);
    try {
      const data = await kbOpenApiGET<TemporalBounds>(kbId, 'temporal/bounds');
      setBounds(data);
    } catch {
      setBounds(null);
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bounds, loading };
}
