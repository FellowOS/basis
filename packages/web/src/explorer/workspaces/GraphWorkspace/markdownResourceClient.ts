import type {
  MarkdownEditorError,
  MarkdownResourceRef,
} from "./markdownEditorState";
import { buildExplorerKbApiPath, explorerFetch, resolveExplorerApiUrl } from "../../host/explorerHttp";

export interface MarkdownDocument {
  resource: MarkdownResourceRef;
  source: string;
  body: string;
  revision: string;
  editable: boolean;
}

export interface MarkdownApplyResult extends MarkdownDocument {
  changed: boolean;
}

type ErrorDetail = {
  code?: string;
  message?: string;
  field?: string;
  current_revision?: string;
};

export class MarkdownClientError extends Error implements MarkdownEditorError {
  readonly kind: MarkdownEditorError["kind"];
  readonly field?: string;
  readonly currentRevision?: string;

  constructor(error: MarkdownEditorError) {
    super(error.message);
    this.name = "MarkdownClientError";
    this.kind = error.kind;
    this.field = error.field;
    this.currentRevision = error.currentRevision;
  }
}

function resourceUrl(ref: MarkdownResourceRef, kbId?: string): string {
  const segment = `markdown/${ref.kind}/${encodeURIComponent(ref.id)}`;
  if (kbId) {
    return buildExplorerKbApiPath(segment, kbId);
  }
  return resolveExplorerApiUrl(`/api/${segment}`);
}

async function responseError(response: Response): Promise<MarkdownClientError> {
  let detail: ErrorDetail = {};
  try {
    const payload = (await response.json()) as { detail?: ErrorDetail };
    if (payload.detail && typeof payload.detail === "object") {
      detail = payload.detail;
    }
  } catch {
    // A non-JSON response is mapped from its status below.
  }

  const kind: MarkdownEditorError["kind"] =
    response.status === 422
      ? "validation"
      : response.status === 409
        ? "conflict"
        : "save";
  return new MarkdownClientError({
    kind,
    message: detail.message || `Markdown request failed (${response.status}).`,
    field: detail.field,
    currentRevision: detail.current_revision,
  });
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  try {
    const url =
      typeof input === "string"
        ? resolveExplorerApiUrl(input)
        : input instanceof URL
          ? resolveExplorerApiUrl(input.toString())
          : input;
    const response = await explorerFetch(url, init);
    if (!response.ok) {
      throw await responseError(response);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MarkdownClientError) throw error;
    throw new MarkdownClientError({
      kind: "network",
      message: "The Markdown service could not be reached. Your draft was kept.",
    });
  }
}

export function readMarkdownResource(
  ref: MarkdownResourceRef,
  options?: { kbId?: string },
): Promise<MarkdownDocument> {
  return request<MarkdownDocument>(resourceUrl(ref, options?.kbId));
}

export function applyMarkdownResource(
  ref: MarkdownResourceRef,
  markdown: string,
  expectedRevision: string,
  options?: { kbId?: string },
): Promise<MarkdownApplyResult> {
  return request<MarkdownApplyResult>(resourceUrl(ref, options?.kbId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown,
      expected_revision: expectedRevision,
    }),
  });
}
