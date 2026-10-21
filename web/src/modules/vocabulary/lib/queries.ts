// queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/context.js';
import { errorFromApiResponse } from '@/lib/api-error.js';
import { workspaceFetch } from '@/lib/explorer/ws-http';
import type { VocabularyScheme, ConceptNode, ImportResponse } from './types';
import { useVocabularyWorkspaceId, vocabularyPath } from '../components/vocabulary-workspace-context.js';

type VocabularyApiCopy = {
  fetch_schemes_failed: string;
  fetch_hierarchy_failed: string;
  import_failed: string;
};

function useVocabularyApiCopy(): VocabularyApiCopy {
  const { t } = useI18n();
  return t.vocabulary.page.api;
}

async function throwIfWsNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  throw errorFromApiResponse(res.status, body, fallback);
}

const fetchSchemes = async (workspaceId: string, fallback: string): Promise<VocabularyScheme[]> => {
  const res = await workspaceFetch(vocabularyPath(workspaceId, 'schemes'));
  await throwIfWsNotOk(res, fallback);
  return res.json();
};

const fetchHierarchy = async (
  workspaceId: string,
  schemeUri: string,
  fallback: string,
): Promise<ConceptNode[]> => {
  const res = await workspaceFetch(
    vocabularyPath(workspaceId, 'hierarchy', `scheme=${encodeURIComponent(schemeUri)}`),
  );
  await throwIfWsNotOk(res, fallback);
  return res.json();
};

const importVocabulary = async (
  workspaceId: string,
  file: File,
  fallback: string,
): Promise<ImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await workspaceFetch(vocabularyPath(workspaceId, 'import'), {
    method: 'POST',
    body: formData,
  });
  await throwIfWsNotOk(res, fallback);
  return res.json();
};

export const useVocabularies = () => {
  const workspaceId = useVocabularyWorkspaceId();
  const api = useVocabularyApiCopy();
  return useQuery({
    queryKey: ['vocabularies', workspaceId],
    queryFn: () => fetchSchemes(workspaceId, api.fetch_schemes_failed),
  });
};

export const useConceptHierarchy = (schemeUri: string | undefined) => {
  const workspaceId = useVocabularyWorkspaceId();
  const api = useVocabularyApiCopy();
  return useQuery({
    queryKey: ['hierarchy', workspaceId, schemeUri],
    queryFn: () => fetchHierarchy(workspaceId, schemeUri!, api.fetch_hierarchy_failed),
    enabled: !!schemeUri,
  });
};

export const useImportVocabulary = () => {
  const workspaceId = useVocabularyWorkspaceId();
  const api = useVocabularyApiCopy();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importVocabulary(workspaceId, file, api.import_failed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabularies', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy', workspaceId] });
    },
  });
};
