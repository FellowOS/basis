/**
 * Left sidebar for the Vocabulary workspace.
 */
import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useVocabularies, useConceptHierarchy } from './queries';
import { ConceptTree } from './ConceptTree';
import { ImportDropzone } from './ImportDropzone';
import type { ConceptNode, VocabularyScheme } from './types';

interface SidebarProps {
  onSelectConcept: (concept: ConceptNode) => void;
}

export function Sidebar({ onSelectConcept }: SidebarProps) {
  const { data: schemes = [], isLoading: schemesLoading } = useVocabularies();
  const [activeScheme, setActiveScheme] = useState<string | undefined>();
  const [importOpen, setImportOpen] = useState(false);

  const selectedSchemeUri = activeScheme ?? schemes[0]?.uri;

  const {
    data: hierarchy = [],
    isLoading: treeLoading,
  } = useConceptHierarchy(selectedSchemeUri);

  return (
    <div className="vocab-sidebar">
      <div className="vocab-sidebar-header">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="vocab-sidebar-title">SKOS vocabulary</h2>
            <p className="vocab-sidebar-sub">
              {schemes.length
                ? `${schemes.length} scheme${schemes.length > 1 ? 's' : ''}`
                : 'No vocabularies loaded'}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <UploadCloud size={14} className="mr-1" aria-hidden />
            Import
          </Button>
        </div>
      </div>

      <div className="vocab-sidebar-section">
        {schemesLoading ? (
          <div className="oh-muted">Loading schemes…</div>
        ) : schemes.length === 0 ? (
          <div className="oh-muted text-sm italic">
            No schemes found. Use Import to load a .ttl or .rdf file.
          </div>
        ) : (
          <Select
            value={selectedSchemeUri || ''}
            onValueChange={(value) => setActiveScheme(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select scheme" />
            </SelectTrigger>
            <SelectContent>
              {schemes.map((s: VocabularyScheme) => (
                <SelectItem key={s.uri} value={s.uri}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {treeLoading ? (
          <div className="oh-muted p-5 text-center">
            Loading hierarchy…
          </div>
        ) : hierarchy.length === 0 ? (
          <div className="oh-muted p-5 text-center italic">
            {selectedSchemeUri
              ? 'No concepts found in this scheme.'
              : 'Select a scheme to browse concepts.'}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <ConceptTree data={hierarchy} onSelectConcept={onSelectConcept} />
          </div>
        )}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import vocabulary</DialogTitle>
            <DialogDescription>Upload SKOS or RDF (.ttl, .rdf, .owl).</DialogDescription>
          </DialogHeader>
          <ImportDropzone />
        </DialogContent>
      </Dialog>
    </div>
  );
}
