// queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { explorerFetch } from '../../host/explorerHttp';
import { errorFromApiResponse } from '@/lib/api-error.js';
import type { VocabularyScheme, ConceptNode, ImportResponse } from './types';

async function throwIfExplorerNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  throw errorFromApiResponse(res.status, body, fallback);
}

const fetchSchemes = async (): Promise<VocabularyScheme[]> => {
  const res = await explorerFetch('/api/vocabulary/schemes');
  await throwIfExplorerNotOk(res, 'Failed to fetch vocabularies');
  return res.json();
};

const fetchHierarchy = async (schemeUri: string): Promise<ConceptNode[]> => {
  const res = await explorerFetch(`/api/vocabulary/hierarchy?scheme=${encodeURIComponent(schemeUri)}`);
  await throwIfExplorerNotOk(res, 'Failed to fetch hierarchy');
  return res.json();
};

// Updated to return the ImportResponse
const importVocabulary = async (file: File): Promise<ImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await explorerFetch('/api/vocabulary/import', {
    method: 'POST',
    body: formData,
  });
  await throwIfExplorerNotOk(res, 'Failed to import vocabulary');
  return res.json();
};

export const useVocabularies = () => {
  return useQuery({ 
    queryKey: ['vocabularies'], 
    queryFn: fetchSchemes 
  });
};

export const useConceptHierarchy = (schemeUri: string | undefined) => {
  return useQuery({
    queryKey: ['hierarchy', schemeUri],
    queryFn: () => fetchHierarchy(schemeUri!),
    enabled: !!schemeUri, 
  });
};

export const useImportVocabulary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importVocabulary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabularies'] });
    },
  });
};