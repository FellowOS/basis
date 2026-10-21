import { createContext, useContext, type ReactNode } from "react";

import { localeFromBrowser } from "@/i18n/locale.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";

import { buildWorkspaceApiPath } from '@/lib/explorer/ws-http';

const OntologyWorkspaceCatalogContext = createContext<string | null>(null);

export function OntologyWorkspaceCatalogProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  return (
    <OntologyWorkspaceCatalogContext.Provider value={workspaceId}>{children}</OntologyWorkspaceCatalogContext.Provider>
  );
}

export function useOntologyWorkspaceId(): string {
  const workspaceId = useContext(OntologyWorkspaceCatalogContext);
  if (!workspaceId) {
    const lang = typeof navigator !== "undefined" ? navigator.language : "en";
    throw new Error(messagesForLocale(localeFromBrowser(lang)).ontology.page.workspace_required);
  }
  return workspaceId;
}

/** `/api/v1/workspaces/{workspaceId}/ontology/{suffix}` with optional query string (no leading `?`). */
export function ontologyPath(workspaceId: string, suffix: string, query?: string): string {
  const path = buildWorkspaceApiPath(
    `ontology/${suffix.replace(/^\//, "")}`,
    workspaceId,
  );
  return query ? `${path}?${query}` : path;
}

/** `/api/v1/workspaces/{workspaceId}/vocabulary/{suffix}` */
export function vocabularyPath(workspaceId: string, suffix: string, query?: string): string {
  const path = buildWorkspaceApiPath(
    `vocabulary/${suffix.replace(/^\//, "")}`,
    workspaceId,
  );
  return query ? `${path}?${query}` : path;
}
