import { PublicIcon } from '@/components/ui/public-icon.js';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useImportVocabulary } from './queries';
import type { ImportResponse } from './types';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import { cn } from '@/lib/utils.js';
import {
  exWsVocabImportDropzone,
  exWsVocabImportDropzoneActive,
  exWsVocabImportError,
  exWsVocabImportStateCol,
  exWsVocabImportStateIcon,
  exWsVocabImportSuccessCol,
} from '@/lib/explorer-ws-classes.js';
export const ImportDropzone: React.FC = () => {
  const { t } = useI18n();
  const copy = t.kbVocabulary;
  const apiError = useApiErrorMessage();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const importMutation = useImportVocabulary();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);

      importMutation.mutate(selectedFile, {
        onSuccess: (data) => {
          setImportResult(data);
          setTimeout(() => {
            setFile(null);
            setImportResult(null);
          }, 4000);
        },
        onError: (err) => {
          console.error('Upload failed:', err);
          setFile(null);
        },
      });
    }
  }, [importMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/turtle': ['.ttl'],
      'application/rdf+xml': ['.rdf', '.owl'],
    },
    maxFiles: 1,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          exWsVocabImportDropzone,
          isDragActive && exWsVocabImportDropzoneActive,
        )}
      >
        <input {...getInputProps()} />

        {importMutation.isPending ? (
          <div className={cn('oh-muted', exWsVocabImportStateCol)}>
            <PublicIcon name='loader-01' className={cn('animate-spin', exWsVocabImportStateIcon)} size={20} />
            <span className="text-xs">{copy.uploading} {file?.name}…</span>
          </div>
        ) : importResult ? (
          <div className={exWsVocabImportSuccessCol}>
            <PublicIcon name='check-circle' className={exWsVocabImportStateIcon} size={20} />
            <span className="text-xs font-medium">{copy.importOk}</span>
            <span className={cn('oh-muted', 'mt-0.5 text-[11px]')}>
              {fmt(copy.addedSummary, {
                nodes: String(importResult.nodes_added),
                edges: String(importResult.edges_added),
              })}
            </span>
          </div>
        ) : (
          <div className={exWsVocabImportStateCol}>
            <PublicIcon name='upload-01'
              className={cn(
                exWsVocabImportStateIcon,
                isDragActive ? 'text-primary' : 'text-muted-foreground',
              )}
              size={20}
            />
            <span className="text-xs font-medium text-foreground">
              {isDragActive ? copy.dropActive : copy.drop}
            </span>
            <span className={cn('oh-muted', 'mt-0.5 text-[11px]')}>.ttl · .rdf · .owl</span>
          </div>
        )}
      </div>
      {importMutation.isError && (
        <p className={exWsVocabImportError}>{apiError(importMutation.error)}</p>
      )}
    </div>
  );
};
