// queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/context.js';
import { errorFromApiResponse } from '@/lib/api-error.js';
import { explorerFetch } from '../../explorerHttp';
import type { VocabularyScheme, ConceptNode, ImportResponse } from './types';
import { useVocabularyKbId, vocabularyPath } from './vocabularyKb';

type VocabularyApiCopy = {
  fetchSchemesFailed: string;
  fetchHierarchyFailed: string;
  importFailed: string;
};

function useVocabularyApiCopy(): VocabularyApiCopy {
  const { t } = useI18n();
  return t.kbVocabulary.api;
}

async function throwIfExplorerNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  throw errorFromApiResponse(res.status, body, fallback);
}

const fetchSchemes = async (kbId: string, fallback: string): Promise<VocabularyScheme[]> => {
  const res = await explorerFetch(vocabularyPath(kbId, 'schemes'));
  await throwIfExplorerNotOk(res, fallback);
  return res.json();
};

const fetchHierarchy = async (
  kbId: string,
  schemeUri: string,
  fallback: string,
): Promise<ConceptNode[]> => {
  const res = await explorerFetch(
    vocabularyPath(kbId, 'hierarchy', `scheme=${encodeURIComponent(schemeUri)}`),
  );
  await throwIfExplorerNotOk(res, fallback);
  return res.json();
};

const importVocabulary = async (
  kbId: string,
  file: File,
  fallback: string,
): Promise<ImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await explorerFetch(vocabularyPath(kbId, 'import'), {
    method: 'POST',
    body: formData,
  });
  await throwIfExplorerNotOk(res, fallback);
  return res.json();
};

export const useVocabularies = () => {
  const kbId = useVocabularyKbId();
  const api = useVocabularyApiCopy();
  return useQuery({
    queryKey: ['vocabularies', kbId],
    queryFn: () => fetchSchemes(kbId, api.fetchSchemesFailed),
  });
};

export const useConceptHierarchy = (schemeUri: string | undefined) => {
  const kbId = useVocabularyKbId();
  const api = useVocabularyApiCopy();
  return useQuery({
    queryKey: ['hierarchy', kbId, schemeUri],
    queryFn: () => fetchHierarchy(kbId, schemeUri!, api.fetchHierarchyFailed),
    enabled: !!schemeUri,
  });
};

export const useImportVocabulary = () => {
  const kbId = useVocabularyKbId();
  const api = useVocabularyApiCopy();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importVocabulary(kbId, file, api.importFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabularies', kbId] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy', kbId] });
    },
  });
};
