import { useEffect, useMemo, useState } from 'react';

import { kbOpenApiPOST } from '@/lib/openapi-client.js';

export async function fetchKbNodeLabels(
  kbId: string,
  ids: string[],
): Promise<Record<string, string | null>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 80);
  if (!unique.length) {
    return {};
  }
  const data = await kbOpenApiPOST<{ labels: Record<string, string | null> }>(
    kbId,
    'graph/resolve-labels',
    { body: { ids: unique } },
  );
  return data.labels ?? {};
}

/** Resolve ledger/graph labels for a set of node ids (refetches when id set changes). */
export function useKbNodeLabels(kbId: string | undefined, ids: string[]) {
  const [labels, setLabels] = useState<Record<string, string | null>>({});
  const idKey = useMemo(
    () => [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort().join('\0'),
    [ids],
  );

  useEffect(() => {
    if (!kbId || !idKey) {
      setLabels({});
      return;
    }
    const parsed = idKey.split('\0');
    void fetchKbNodeLabels(kbId, parsed)
      .then((next) => setLabels((prev) => ({ ...prev, ...next })))
      .catch(() => {});
  }, [kbId, idKey]);

  return labels;
}
