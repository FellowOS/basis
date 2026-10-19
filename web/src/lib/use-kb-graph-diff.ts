import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import type { GraphDiffOverlayInput } from '@/lib/graph-diff-overlay.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

export type GraphStagingManifest = {
  session_key?: string;
  from_time?: string;
  to_time?: string;
};

export type KbGraphDiffPayload = GraphDiffOverlayInput & {
  from_time: string;
  to_time: string;
  summary: {
    nodes_added: number;
    nodes_removed: number;
    nodes_modified: number;
    edges_added: number;
    edges_removed: number;
  };
};

export function useKbGraphDiff(
  kbId: string,
  diffFrom: string | undefined,
  diffTo: string | undefined,
  locale: Locale,
): {
  diff: KbGraphDiffPayload | null;
  stagingSessionKey: string | null;
  loading: boolean;
  error: string | null;
} {
  const [diff, setDiff] = useState<KbGraphDiffPayload | null>(null);
  const [stagingSessionKey, setStagingSessionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = diffFrom?.trim();
    const to = diffTo?.trim();
    if (!kbId || !from || !to) {
      setDiff(null);
      setStagingSessionKey(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void kbOpenApiGET<{ diff: KbGraphDiffPayload; manifest?: GraphStagingManifest }>(
      kbId,
      'graph/staging',
      {
        params: { query: { from, to } },
      },
    )
      .then((data) => {
        if (cancelled) return;
        setDiff(data.diff);
        const key = data.manifest?.session_key?.trim();
        setStagingSessionKey(key || null);
      })
      .catch((err) => {
        if (!cancelled) setError(formatUserFacingApiError(err, locale));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diffFrom, diffTo, kbId, locale]);

  return { diff, stagingSessionKey, loading, error };
}
