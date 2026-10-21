import { createContext, useContext, type ReactNode } from "react";

import { localeFromBrowser } from "@/i18n/locale.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";

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
    const lang = typeof navigator !== "undefined" ? navigator.language : "en";
    throw new Error(messagesForLocale(localeFromBrowser(lang)).kbExplorer.vocabularyKbRequired);
  }
  return kbId;
}

export function vocabularyPath(kbId: string, suffix: string, query?: string): string {
  return buildVocabularyPath(kbId, suffix, query);
}
