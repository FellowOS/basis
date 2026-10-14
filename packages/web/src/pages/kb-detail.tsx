import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
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
  const { id } = useParams();
  const [kb, setKb] = useState<{ name: string; my_role: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [targetUser, setTargetUser] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await api(`/api/kbs/${id}/members/${targetUser}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      const body = await api<{ members: Member[] }>(`/api/kbs/${id}/members`);
      setMembers(body.members);
    } catch (err) {
      setError(apiError(err));
    }
  }

  if (!kb) return <p className="text-sm text-muted-foreground">加载中…</p>;

  return (
    <div className="space-y-6">
      <PageHeader crumbs={[{ label: '知识库', to: '/kbs' }, { label: kb.name }]} />
      <p className="text-sm text-muted-foreground">我的角色：{kb.my_role}</p>
      <p>
        <Link className="text-primary hover:underline" to={`/kbs/${id}/knowledge`}>
          打开知识能力 →
        </Link>
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">成员</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>{m.display_name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>{m.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {['owner', 'admin'].includes(kb.my_role) && (
            <div className="flex flex-wrap items-end gap-4 border-t pt-4">
              <div className="min-w-[12rem] space-y-2">
                <Label>添加成员</Label>
                <Select value={targetUser} onValueChange={setTargetUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择用户" />
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
              <div className="min-w-[8rem] space-y-2">
                <Label>角色</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">viewer</SelectItem>
                    <SelectItem value="editor">editor</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="owner">owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={addMember}>保存角色</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
