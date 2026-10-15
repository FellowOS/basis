import { createContext, useContext, type ReactNode } from "react";
import { vocabularyPath as buildVocabularyPath } from "../OntologyWorkspace/ontologyKb";

const VocabularyKbContext = createContext<string | null>(null);

export function VocabularyKbProvider({
  kbId,
  children,
}: {
  kbId: string;
  children: ReactNode;
}) {
  return (
    <VocabularyKbContext.Provider value={kbId}>{children}</VocabularyKbContext.Provider>
  );
}

export function useVocabularyKbId(): string {
  const kbId = useContext(VocabularyKbContext);
  if (!kbId) {
    throw new Error("Vocabulary workspace requires kbId (VocabularyKbProvider).");
  }
  return kbId;
}

export function vocabularyPath(kbId: string, suffix: string, query?: string): string {
  return buildVocabularyPath(kbId, suffix, query);
}
