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
import { basisSessionClient } from '@/lib/session/basis-session-client.js';
import { unwrapOpenApi } from '@/lib/openapi/response.js';
import { useApiErrorMessage } from '@/lib/errors/use-api-error-message.js';

export type CreatedWorkspace = {
  id: string;
  name: string;
};

type WorkspaceCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: CreatedWorkspace) => void | Promise<void>;
};

export function WorkspaceCreateDialog({ open, onOpenChange, onCreated }: WorkspaceCreateDialogProps) {
  const { t } = useI18n();
  const p = t.admin_workspaces.page;
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
      const workspace = unwrapOpenApi(
        await basisSessionClient().openapi().POST('/api/v1/workspaces', {
          body: { name: values.name.trim(), visibility: 'restricted' },
        }),
      ) as CreatedWorkspace;
      form.reset();
      onOpenChange(false);
      await onCreated(workspace);
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
              <DialogTitle>{p.create_dialog_title}</DialogTitle>
              <DialogDescription>{p.create_dialog_desc}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="workspace-create-name">{p.name_label}</FormLabel>
                    <FormControl>
                      <Input id="workspace-create-name" placeholder={p.name_placeholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.core.common.cancel}
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
