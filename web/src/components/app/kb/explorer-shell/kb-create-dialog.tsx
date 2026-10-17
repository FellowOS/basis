import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
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
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const form = useForm({
    resolver: zodResolver(
      z.object({
        name: z.string().trim().min(1),
      }),
    ),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: { name: string }) {
    setCreating(true);
    setError(null);
    try {
      const kb = await api<CreatedKb>('/api/kbs', {
        method: 'POST',
        body: JSON.stringify({ name: values.name.trim(), visibility: 'restricted' }),
      });
      form.reset();
      onOpenChange(false);
      await onCreated(kb);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) form.reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{p.createDialogTitle}</DialogTitle>
              <DialogDescription>{p.createDialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="kb-create-name">{p.nameLabel}</FormLabel>
                    <FormControl>
                      <Input id="kb-create-name" placeholder={p.namePlaceholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? p.creating : p.create}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
