// queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { explorerFetch } from '../../host/explorerHttp';
import { errorFromApiResponse } from '@/lib/api-error.js';
import type { VocabularyScheme, ConceptNode, ImportResponse } from './types';
import { useVocabularyKbId, vocabularyPath } from './vocabularyKb';

async function throwIfExplorerNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  throw errorFromApiResponse(res.status, body, fallback);
}

const fetchSchemes = async (kbId: string): Promise<VocabularyScheme[]> => {
  const res = await explorerFetch(vocabularyPath(kbId, 'schemes'));
  await throwIfExplorerNotOk(res, 'Failed to fetch vocabularies');
  return res.json();
};

const fetchHierarchy = async (kbId: string, schemeUri: string): Promise<ConceptNode[]> => {
  const res = await explorerFetch(
    vocabularyPath(kbId, 'hierarchy', `scheme=${encodeURIComponent(schemeUri)}`),
  );
  await throwIfExplorerNotOk(res, 'Failed to fetch hierarchy');
  return res.json();
};

const importVocabulary = async (kbId: string, file: File): Promise<ImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await explorerFetch(vocabularyPath(kbId, 'import'), {
    method: 'POST',
    body: formData,
  });
  await throwIfExplorerNotOk(res, 'Failed to import vocabulary');
  return res.json();
};

export const useVocabularies = () => {
  const kbId = useVocabularyKbId();
  return useQuery({
    queryKey: ['vocabularies', kbId],
    queryFn: () => fetchSchemes(kbId),
  });
};

export const useConceptHierarchy = (schemeUri: string | undefined) => {
  const kbId = useVocabularyKbId();
  return useQuery({
    queryKey: ['hierarchy', kbId, schemeUri],
    queryFn: () => fetchHierarchy(kbId, schemeUri!),
    enabled: !!schemeUri,
  });
};

export const useImportVocabulary = () => {
  const kbId = useVocabularyKbId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importVocabulary(kbId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabularies', kbId] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy', kbId] });
    },
  });
};
