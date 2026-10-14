import { getToken } from '@/lib/api.js';

export type ExplorerCapabilities = {
  graph_snapshot: boolean;
  explorer_runtime: boolean;
};

export type DocumentStoreResult = {
  document_id: string;
  version_id: string;
  doc_id: string;
  status: string;
  version_no?: number;
  new_document?: boolean;
  new_version?: boolean;
  unchanged?: boolean;
  byte_size?: number;
};

export class ExplorerClient {
  readonly kbId: string;
  private readonly signal?: AbortSignal;

  constructor(kbId: string, signal?: AbortSignal) {
    this.kbId = kbId;
    this.signal = signal;
  }

  /** KB-scoped API path; every graph call must go through here. */
  path(subpath: string): string {
    const suffix = subpath.startsWith('/') ? subpath : `/${subpath}`;
    if (!suffix.startsWith('/api/')) {
      return `/api/kbs/${this.kbId}${suffix}`;
    }
    return suffix;
  }

  async requestMultipart<T>(subpath: string, form: FormData): Promise<{ data: T; status: number }> {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(this.path(subpath), {
      method: 'POST',
      headers,
      body: form,
      signal: this.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = (data as { detail?: { message?: string; code?: string } }).detail;
      const err = new Error(detail?.message ?? `请求失败 (${response.status})`);
      (err as Error & { code?: string }).code = detail?.code;
      throw err;
    }
    return { data: data as T, status: response.status };
  }

  async request<T>(subpath: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(this.path(subpath), {
      ...init,
      headers,
      signal: this.signal ?? init.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = (data as { detail?: { message?: string; code?: string } }).detail;
      const err = new Error(detail?.message ?? `请求失败 (${response.status})`);
      (err as Error & { code?: string }).code = detail?.code;
      throw err;
    }
    return data as T;
  }

  realtimeTicket() {
    return this.request<{ ticket: string; projection_revision: number }>('realtime-ticket', {
      method: 'POST',
    });
  }

  documents = {
    list: () => this.request<{ documents: unknown[] }>('documents'),
    ingestText: (body: {
      doc_id: string;
      text: string;
    }) =>
      this.request<DocumentStoreResult>('documents', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    upload: async (form: FormData) => {
      const { data } = await this.requestMultipart<DocumentStoreResult>(
        'documents/upload',
        form,
      );
      return data;
    },
    appendTextVersion: (documentId: string, body: { text: string }) =>
      this.request<DocumentStoreResult>(`documents/${documentId}/versions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    uploadVersion: async (documentId: string, form: FormData) => {
      const { data } = await this.requestMultipart<DocumentStoreResult>(
        `documents/${documentId}/versions/upload`,
        form,
      );
      return data;
    },
  };

  processing = {
    start: (body: {
      version_id: string;
      wait?: boolean;
      chunk?: boolean;
      chunk_size?: number;
      chunk_overlap?: number;
      extract?: boolean;
      ner_method?: string;
      relation_method?: string;
      extract_relations?: boolean;
      extract_triplets?: boolean;
      idempotency_key?: string;
    }) =>
      this.request<{ job_id?: string; accepted?: boolean; ledger_status?: string }>(
        'processing/jobs',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ),
    list: () => this.request<{ jobs: unknown[] }>('processing/jobs'),
    retry: (jobId: string) =>
      this.request<{ job_id?: string; accepted?: boolean }>(
        `processing/jobs/${encodeURIComponent(jobId)}/retry`,
        {
          method: 'POST',
          body: JSON.stringify({ wait: false }),
        },
      ),
  };

  ingest = {
    getJob: (jobId: string) =>
      this.request<{
        job: { status: string; error_code?: string | null };
        version?: { status: string } | null;
      }>(`ingest/jobs/${jobId}`),
    pollJob: async (jobId: string, timeoutMs = 120_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const payload = await this.ingest.getJob(jobId);
        const status = payload.job.status;
        if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
          return payload;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      throw new Error('摄入超时，请稍后刷新文库');
    },
  };

  graph = {
    stats: () => this.request<{ node_count: number; edge_count: number }>('graph/stats'),
    snapshot: (params?: { limit_nodes?: number; limit_edges?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit_nodes) q.set('limit_nodes', String(params.limit_nodes));
      if (params?.limit_edges) q.set('limit_edges', String(params.limit_edges));
      const qs = q.toString();
      return this.request(`graph/snapshot${qs ? `?${qs}` : ''}`);
    },
    nodes: (params?: { search?: string; limit?: number; node_type?: string }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.node_type) q.set('node_type', params.node_type);
      return this.request<{ nodes: unknown[]; total: number }>(`graph/nodes?${q}`);
    },
    neighbors: (nodeId: string, depth = 1) =>
      this.request<{ neighbors: unknown[] }>(
        `graph/nodes/${encodeURIComponent(nodeId)}/neighbors?depth=${depth}`,
      ),
    path: (source: string, target: string) => {
      const q = new URLSearchParams({ source, target });
      return this.request(`graph/path?${q}`);
    },
    search: (body: { query: string; limit?: number }) =>
      this.request<{ results: { node: { id: string; type: string; content: string }; score: number }[] }>(
        'graph/search',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    rebuild: () =>
      this.request<{
        projection_revision?: number;
        projection_status?: string;
        node_count?: number;
        edge_count?: number;
      }>('graph/rebuild', { method: 'POST' }),
  };
}

/** @internal test helper */
export function explorerPathForKb(kbId: string, subpath: string): string {
  return new ExplorerClient(kbId).path(subpath);
}
