import { createContext, useContext, type ReactNode } from "react";
import { buildExplorerKbApiPath } from "../../host/explorerHttp";

const OntologyKbContext = createContext<string | null>(null);

export function OntologyKbProvider({
  kbId,
  children,
}: {
  kbId: string;
  children: ReactNode;
}) {
  return (
    <OntologyKbContext.Provider value={kbId}>{children}</OntologyKbContext.Provider>
  );
}

export function useOntologyKbId(): string {
  const kbId = useContext(OntologyKbContext);
  if (!kbId) {
    throw new Error("Ontology workspace requires kbId (OntologyKbProvider).");
  }
  return kbId;
}

/** `/api/kbs/{kbId}/ontology/{suffix}` with optional query string (no leading `?`). */
export function ontologyPath(kbId: string, suffix: string, query?: string): string {
  const path = buildExplorerKbApiPath(
    `ontology/${suffix.replace(/^\//, "")}`,
    kbId,
  );
  return query ? `${path}?${query}` : path;
}

/** `/api/kbs/{kbId}/vocabulary/{suffix}` */
export function vocabularyPath(kbId: string, suffix: string, query?: string): string {
  const path = buildExplorerKbApiPath(
    `vocabulary/${suffix.replace(/^\//, "")}`,
    kbId,
  );
  return query ? `${path}?${query}` : path;
}
