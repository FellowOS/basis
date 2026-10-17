import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

export type CreatedKb = {
  id: string;
  name: string;
};

type KbCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (kb: CreatedKb) => void | Promise<void>;
};

export function KbCreateDialog({ open, onOpenChange, onCreated }: KbCreateDialogProps) {
  const { t } = useI18n();
  const p = t.pages.basisKbs;
  const apiError = useApiErrorMessage();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const kb = await api<CreatedKb>('/api/kbs', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), visibility: 'restricted' }),
      });
      setName('');
      onOpenChange(false);
      await onCreated(kb);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            void onSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>{p.createDialogTitle}</DialogTitle>
            <DialogDescription>{p.createDialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="kb-create-name">{p.nameLabel}</Label>
              <Input
                id="kb-create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={p.namePlaceholder}
                required
              />
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? p.creating : p.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
