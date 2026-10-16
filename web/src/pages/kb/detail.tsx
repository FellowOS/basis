/**
 * KB summary / admin card view (not wired in `app.tsx` routes today).
 * Prefer `/kbs/:id/settings` for KB configuration; keep for future or deep links.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import { kbMemberRoleLabel } from '@/lib/kb-settings-labels.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type Member = {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
};

type UserRow = { id: string; email: string; display_name: string };

export function KbDetailPage() {
  const apiError = useApiErrorMessage();
  const { t } = useI18n();
  const ks = t.kbSettings;
  const { id } = useParams();
  const [kb, setKb] = useState<{ name: string; my_role: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [targetUser, setTargetUser] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<{ name: string; my_role: string }>(`/api/kbs/${id}`),
      api<{ members: Member[] }>(`/api/kbs/${id}/members`),
      api<{ users: UserRow[] }>('/api/users'),
    ])
      .then(([kbBody, membersBody, usersBody]) => {
        setKb(kbBody);
        setMembers(membersBody.members);
        setUsers(usersBody.users);
      })
      .catch((err) => setError(apiError(err)));
  }, [id, apiError]);

  async function addMember() {
    if (!id || !targetUser) return;
    setAdding(true);
    setError(null);
    try {
      await api(`/api/kbs/${id}/members/${targetUser}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      const body = await api<{ members: Member[] }>(`/api/kbs/${id}/members`);
      setMembers(body.members);
      setAddOpen(false);
      setTargetUser('');
      setRole('viewer');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setAdding(false);
    }
  }

  if (!kb) {
    return (
      <ConsolePageLayout
        crumbs={[{ label: t.menu.platform.kbs, to: '/kbs' }, { label: t.common.ellipsis }]}
      >
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </ConsolePageLayout>
    );
  }

  const canManage = ['owner', 'admin'].includes(kb.my_role);

  return (
    <ConsolePageLayout
      crumbs={[{ label: t.menu.platform.kbs, to: '/kbs' }, { label: kb.name }]}
      meta={fmt(ks.myRoleMeta, { role: kbMemberRoleLabel(ks, kb.my_role) })}
      actions={
        canManage ? (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            {ks.addMember}
          </Button>
        ) : undefined
      }
    >
      <p>
        <Link className="text-primary hover:underline" to={`/kbs/${id}/knowledge`}>
          {ks.openKnowledgeLink}
        </Link>
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.menu.kbSettings.members}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ks.colUser}</TableHead>
                <TableHead>{ks.colEmail}</TableHead>
                <TableHead>{ks.colRole}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>{m.display_name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>{kbMemberRoleLabel(ks, m.role)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ks.addMemberTitle}</DialogTitle>
            <DialogDescription>{ks.addMemberDesc}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{ks.colUser}</Label>
              <Select value={targetUser} onValueChange={setTargetUser}>
                <SelectTrigger>
                  <SelectValue placeholder={ks.selectUser} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ks.role}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{ks.roleLabels.viewer}</SelectItem>
                  <SelectItem value="editor">{ks.roleLabels.editor}</SelectItem>
                  <SelectItem value="admin">{ks.roleLabels.admin}</SelectItem>
                  <SelectItem value="owner">{ks.roleLabels.owner}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="button" disabled={!targetUser || adding} onClick={() => void addMember()}>
              {adding ? t.common.processing : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
