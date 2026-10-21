import { fmt } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";

import { parseExplorerJson } from "../../ws/explorer-api-error";
import { explorerFetch } from "../../ws/explorerHttp";
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

export type OntologyRequestOptions = {
  locale?: Locale;
};

export type OntologyGraphRequestOptions = OntologyRequestOptions & {
  signal?: AbortSignal;
};

async function parseResponse<T>(response: Response, locale: Locale = "en"): Promise<T> {
  const common = messagesForLocale(locale).common;
  const data = await parseExplorerJson<T & { message?: string }>(
    response,
    fmt(common.requestFailedStatus, { status: response.status }),
  );
  if (response.status === 207) {
    console.warn(data.message?.trim() || common.partialSuccess);
  }
  return data as T;
}

export async function loadOntologyRegistry(
  kbId: string,
  options?: OntologyRequestOptions,
): Promise<OntologyEntry[]> {
  return parseResponse<OntologyEntry[]>(
    await explorerFetch(ontologyPath(kbId, "registry")),
    options?.locale,
  );
}

export async function loadOntologyGraph(
  kbId: string,
  uri: string,
  options?: OntologyGraphRequestOptions,
): Promise<OntologyGraphResponse> {
  return parseResponse<OntologyGraphResponse>(
    await explorerFetch(ontologyPath(kbId, "graph", `uri=${encodeURIComponent(uri)}`), {
      signal: options?.signal,
    }),
    options?.locale,
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
  options?: OntologyRequestOptions,
): Promise<OntologyAlignment[]> {
  const query = uri ? `uri=${encodeURIComponent(uri)}` : undefined;
  return parseResponse<OntologyAlignment[]>(
    await explorerFetch(ontologyPath(kbId, "alignments", query)),
    options?.locale,
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
  options?: OntologyRequestOptions,
): Promise<OntologyAlignment> {
  return parseResponse<OntologyAlignment>(
    await explorerFetch(ontologyPath(kbId, "alignments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    options?.locale,
  );
}

export async function removeAlignment(
  kbId: string,
  id: string,
  options?: OntologyRequestOptions,
): Promise<void> {
  await parseResponse<{ status: string }>(
    await explorerFetch(
      ontologyPath(kbId, "alignments", `id=${encodeURIComponent(id)}`),
      { method: "DELETE" },
    ),
    options?.locale,
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
  options?: OntologyRequestOptions,
): Promise<AlignmentSuggestion[]> {
  return parseResponse<AlignmentSuggestion[]>(
    await explorerFetch(ontologyPath(kbId, "suggest-alignments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    options?.locale,
  );
}

export async function loadOntologyHealth(
  kbId: string,
  uri: string,
  options?: OntologyRequestOptions,
): Promise<OntologyHealthResponse> {
  return parseResponse<OntologyHealthResponse>(
    await explorerFetch(
      ontologyPath(kbId, "health", `uri=${encodeURIComponent(uri)}`),
    ),
    options?.locale,
  );
}

export async function generateShacl(
  kbId: string,
  uri: string,
  qualityTier: "standard" | "strict" = "strict",
  options?: OntologyRequestOptions,
): Promise<ShaclGenerateResponse> {
  return parseResponse<ShaclGenerateResponse>(
    await explorerFetch(ontologyPath(kbId, "shacl/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri, quality_tier: qualityTier }),
    }),
    options?.locale,
  );
}

export async function loadShaclShapes(
  kbId: string,
  uri: string,
  options?: OntologyRequestOptions,
): Promise<ShaclShapesResponse> {
  return parseResponse<ShaclShapesResponse>(
    await explorerFetch(
      ontologyPath(kbId, "shacl/shapes", `uri=${encodeURIComponent(uri)}`),
    ),
    options?.locale,
  );
}

export async function validateShacl(
  kbId: string,
  uri: string,
  shaclTurtle: string,
  options?: OntologyRequestOptions,
): Promise<ShaclValidationResponse> {
  return parseResponse<ShaclValidationResponse>(
    await explorerFetch(ontologyPath(kbId, "shacl/validate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri, shacl_turtle: shaclTurtle }),
    }),
    options?.locale,
  );
}
