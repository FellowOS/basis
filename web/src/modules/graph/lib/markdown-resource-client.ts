import type { Locale } from "@/i18n/locale.js";
import { requestFailedStatusMessage } from "@/i18n/format.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";
import type {
  MarkdownEditorError,
  MarkdownResourceRef,
} from "./markdown-editor-state";
import {
  buildWorkspaceApiPath,
  workspaceFetch,
  resolveWorkspaceApiUrl,
} from '@/lib/explorer/ws-http';

export type MarkdownClientOptions = {
  locale?: Locale;
};

function markdownClientMessages(locale: Locale = "en") {
  const messages = messagesForLocale(locale);
  return {
    networkUnreachable:
      messages.graph.canvas.inspector.markdown.network_unreachable,
    requestFailedStatus: (status: number) =>
      requestFailedStatusMessage(locale, status),
  };
}

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
  readonly code?: string;
  readonly field?: string;
  readonly currentRevision?: string;

  constructor(error: MarkdownEditorError) {
    super(error.message);
    this.name = "MarkdownClientError";
    this.kind = error.kind;
    this.code = error.code;
    this.field = error.field;
    this.currentRevision = error.currentRevision;
    if (error.code) {
      (this as Error & { code?: string }).code = error.code;
    }
  }
}

function resourceUrl(ref: MarkdownResourceRef, workspaceId: string): string {
  const segment = `markdown/${ref.kind}/${encodeURIComponent(ref.id)}`;
  return buildWorkspaceApiPath(segment, workspaceId);
}

async function responseError(
  response: Response,
  locale: Locale,
): Promise<MarkdownClientError> {
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
  const { requestFailedStatus } = markdownClientMessages(locale);
  const fallback = requestFailedStatus(response.status);
  const message = detail.code ? "" : (detail.message?.trim() || fallback);
  return new MarkdownClientError({
    kind,
    code: detail.code?.trim() || undefined,
    message,
    field: detail.field,
    currentRevision: detail.current_revision,
  });
}

async function request<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: MarkdownClientOptions,
): Promise<T> {
  const locale = options?.locale ?? "en";
  const { networkUnreachable } = markdownClientMessages(locale);
  try {
    const resolved =
      typeof input === "string"
        ? resolveWorkspaceApiUrl(input)
        : input instanceof URL
          ? resolveWorkspaceApiUrl(input.toString())
          : resolveWorkspaceApiUrl(input.url);
    const response = await workspaceFetch(resolved, init);
    if (!response.ok) {
      throw await responseError(response, locale);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MarkdownClientError) throw error;
    throw new MarkdownClientError({
      kind: "network",
      message: networkUnreachable,
    });
  }
}

export function readMarkdownResource(
  ref: MarkdownResourceRef,
  workspaceId: string,
  options?: MarkdownClientOptions,
): Promise<MarkdownDocument> {
  return request<MarkdownDocument>(resourceUrl(ref, workspaceId), undefined, options);
}

export function applyMarkdownResource(
  ref: MarkdownResourceRef,
  markdown: string,
  expectedRevision: string,
  workspaceId: string,
  options?: MarkdownClientOptions,
): Promise<MarkdownApplyResult> {
  return request<MarkdownApplyResult>(
    resourceUrl(ref, workspaceId),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown,
        expected_revision: expectedRevision,
      }),
    },
    options,
  );
}
