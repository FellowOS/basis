import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { useImportVocabulary } from './queries';
import type { ImportResponse } from './types';
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
            <Loader2 className={cn('animate-spin', exWsVocabImportStateIcon)} size={20} />
            <span className="text-xs">Uploading {file?.name}…</span>
          </div>
        ) : importResult ? (
          <div className={exWsVocabImportSuccessCol}>
            <CheckCircle2 className={exWsVocabImportStateIcon} size={20} />
            <span className="text-xs font-medium">Import successful</span>
            <span className={cn('oh-muted', 'mt-0.5 text-[11px]')}>
              +{importResult.nodes_added} concepts · +{importResult.edges_added} links
            </span>
          </div>
        ) : (
          <div className={exWsVocabImportStateCol}>
            <UploadCloud
              className={cn(
                exWsVocabImportStateIcon,
                isDragActive ? 'text-primary' : 'text-muted-foreground',
              )}
              size={20}
            />
            <span className="text-xs font-medium text-foreground">
              {isDragActive ? 'Drop here…' : 'Import vocabulary'}
            </span>
            <span className={cn('oh-muted', 'mt-0.5 text-[11px]')}>.ttl or .rdf</span>
          </div>
        )}
      </div>
      {importMutation.isError && (
        <p className={exWsVocabImportError}>{apiError(importMutation.error)}</p>
      )}
    </div>
  );
};
