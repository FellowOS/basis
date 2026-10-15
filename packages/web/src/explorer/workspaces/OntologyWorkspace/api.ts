import { parseExplorerJson } from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath } from "./ontologyKb";
import type {
  AlignmentRelation,
  AlignmentSuggestion,
  OntologyAlignment,
  OntologyEntry,
  OntologyHealthResponse,
  ShaclGenerateResponse,
  ShaclShapesResponse,
  ShaclValidationResponse,
} from "./types";

export type OntologyGraphNode = {
  id: string;
  type: string;
  entity_type: string;
  content?: string;
  properties?: Record<string, unknown>;
};

export type OntologyGraphEdge = {
  id?: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  properties?: Record<string, unknown>;
};

export type OntologyGraphResponse = {
  uri: string;
  nodes: OntologyGraphNode[];
  edges: OntologyGraphEdge[];
};

export type OntologyEntityOwner = {
  owning_ontology?: string | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await parseExplorerJson<T & { message?: string }>(
    response,
    `Request failed (${response.status})`,
  );
  if (response.status === 207) {
    console.warn("Partial Success:", data.message || "Warning: 207 Multi-Status");
  }
  return data as T;
}

export async function loadOntologyRegistry(kbId: string): Promise<OntologyEntry[]> {
  return parseResponse<OntologyEntry[]>(
    await explorerFetch(ontologyPath(kbId, "registry")),
  );
}

export async function loadOntologyGraph(
  kbId: string,
  uri: string,
  signal?: AbortSignal,
): Promise<OntologyGraphResponse> {
  return parseResponse<OntologyGraphResponse>(
    await explorerFetch(ontologyPath(kbId, "graph", `uri=${encodeURIComponent(uri)}`), {
      signal,
    }),
  );
}

export type OntologyOwnerVerdict = string | null | undefined;

export async function loadOntologyEntityOwner(
  kbId: string,
  uri: string,
): Promise<OntologyOwnerVerdict> {
  const response = await explorerFetch(
    ontologyPath(kbId, `entity/${encodeURIComponent(uri)}`),
  );
  if (!response.ok) return undefined;
  const owner = (await response.json()) as OntologyEntityOwner | null;
  const verdict = owner?.owning_ontology;
  return verdict === undefined ? undefined : verdict;
}

export async function loadAlignments(
  kbId: string,
  uri?: string,
): Promise<OntologyAlignment[]> {
  const query = uri ? `uri=${encodeURIComponent(uri)}` : undefined;
  return parseResponse<OntologyAlignment[]>(
    await explorerFetch(ontologyPath(kbId, "alignments", query)),
  );
}

export async function saveAlignment(
  kbId: string,
  payload: {
    source_uri: string;
    target_uri: string;
    relation: AlignmentRelation;
    confidence: number;
    provenance?: string;
    source?: string;
    reviewer?: string;
  },
): Promise<OntologyAlignment> {
  return parseResponse<OntologyAlignment>(
    await explorerFetch(ontologyPath(kbId, "alignments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function removeAlignment(kbId: string, id: string): Promise<void> {
  await parseResponse<{ status: string }>(
    await explorerFetch(
      ontologyPath(kbId, "alignments", `id=${encodeURIComponent(id)}`),
      { method: "DELETE" },
    ),
  );
}

export async function suggestAlignments(
  kbId: string,
  payload: {
    source_ontology_uri?: string;
    target_ontology_uri?: string;
    threshold: number;
    limit: number;
  },
): Promise<AlignmentSuggestion[]> {
  return parseResponse<AlignmentSuggestion[]>(
    await explorerFetch(ontologyPath(kbId, "suggest-alignments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function loadOntologyHealth(
  kbId: string,
  uri: string,
): Promise<OntologyHealthResponse> {
  return parseResponse<OntologyHealthResponse>(
    await explorerFetch(
      ontologyPath(kbId, "health", `uri=${encodeURIComponent(uri)}`),
    ),
  );
}

export async function generateShacl(
  kbId: string,
  uri: string,
  qualityTier: "standard" | "strict" = "strict",
): Promise<ShaclGenerateResponse> {
  return parseResponse<ShaclGenerateResponse>(
    await explorerFetch(ontologyPath(kbId, "shacl/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri, quality_tier: qualityTier }),
    }),
  );
}

export async function loadShaclShapes(
  kbId: string,
  uri: string,
): Promise<ShaclShapesResponse> {
  return parseResponse<ShaclShapesResponse>(
    await explorerFetch(
      ontologyPath(kbId, "shacl/shapes", `uri=${encodeURIComponent(uri)}`),
    ),
  );
}

export async function validateShacl(
  kbId: string,
  uri: string,
  shaclTurtle: string,
): Promise<ShaclValidationResponse> {
  return parseResponse<ShaclValidationResponse>(
    await explorerFetch(ontologyPath(kbId, "shacl/validate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri, shacl_turtle: shaclTurtle }),
    }),
  );
}
