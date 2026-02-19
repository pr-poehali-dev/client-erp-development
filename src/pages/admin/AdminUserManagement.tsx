import React, { useState } from "react";
import DataTable, { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import MemberSearch from "@/components/ui/member-search";
import { StaffUser, Member } from "@/lib/api";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const roleLabels: Record<string, string> = { admin: "Администратор", manager: "Менеджер", client: "Клиент" };
const statusLabels: Record<string, string> = { active: "Активен", blocked: "Заблокирован" };

const roleColor = (role: string) => {
  if (role === "admin") return "destructive";
  if (role === "manager") return "default";
  return "secondary";
};

type UserRow = StaffUser & { [key: string]: unknown };

const columns: Column<UserRow>[] = [
  { key: "login", label: "Логин", className: "font-medium" },
  { key: "name", label: "Имя" },
  { key: "email", label: "Email" },
  { key: "role", label: "Роль", render: (i) => <Badge variant={roleColor(i.role) as "default" | "destructive" | "secondary"} className="text-xs">{roleLabels[i.role] || i.role}</Badge> },
  { key: "status", label: "Статус", render: (i) => <Badge variant={i.status === "active" ? "default" : "outline"} className="text-xs">{statusLabels[i.status] || i.status}</Badge> },
  { key: "last_login", label: "Последний вход", render: (i) => <span className="text-xs">{fmtDate(i.last_login)}</span> },
];

interface AdminUserManagementProps {
  users: UserRow[];
  members: Member[];
  loading: boolean;
  currentUserId?: number;
  onCreate: (form: { login: string; name: string; role: string; password: string; email: string; phone: string }) => Promise<void>;
  onCreateClient: (form: { login: string; name: string; password: string; phone: string; member_id: string }) => Promise<void>;
  onEdit: (userId: number, form: { name: string; role: string; login: string; email: string; phone: string; status: string; password: string; member_id: string }) => Promise<void>;
  onDelete: (userId: number) => Promise<void>;
  onBlock: (userId: number) => Promise<void>;
}

const AdminUserManagement = (props: AdminUserManagementProps) => {
  const { users, members, loading, currentUserId, onCreate, onCreateClient, onEdit, onDelete, onBlock } = props;
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [form, setForm] = useState({ login: "", name: "", role: "manager", password: "", email: "", phone: "" });
  const [clientForm, setClientForm] = useState({ login: "", name: "", password: "", phone: "", member_id: "" });
  const [editForm, setEditForm] = useState({ name: "", role: "", login: "", email: "", phone: "", status: "", password: "", member_id: "" as string });

  const staffUsers = users.filter((u) => u.role === "admin" || u.role === "manager");
  const clientUsers = users.filter((u) => u.role === "client");

  const handleCreate = async () => {
    if (!form.login || !form.name || !form.password) return;
    setSaving(true);
    try {
      await onCreate(form);
      setShowForm(false);
      setForm({ login: "", name: "", role: "manager", password: "", email: "", phone: "" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async () => {
    if (!clientForm.login || !clientForm.name || !clientForm.password || !clientForm.member_id) return;
    setSaving(true);
    try {
      await onCreateClient(clientForm);
      setShowClientForm(false);
      setClientForm({ login: "", name: "", password: "", phone: "", member_id: "" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role, login: u.login, email: u.email || "", phone: u.phone || "", status: u.status, password: "", member_id: String(u.member_id || "") });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await onEdit(editUser.id, editForm);
      setShowEdit(false);
      setEditUser(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: number) => {
    setSaving(true);
    try {
      await onDelete(userId);
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async (userId: number) => {
    setSaving(true);
    try {
      await onBlock(userId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Сотрудники</TabsTrigger>
          <TabsTrigger value="clients">Клиенты</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <div className="mb-4"><Button onClick={() => setShowForm(true)}><Icon name="UserPlus" size={16} className="mr-2" />Создать пользователя</Button></div>
          <DataTable columns={columns} data={staffUsers} loading={loading} onRowClick={openEdit} />
        </TabsContent>

        <TabsContent value="clients">
          <div className="mb-4"><Button onClick={() => setShowClientForm(true)}><Icon name="UserPlus" size={16} className="mr-2" />Создать клиента</Button></div>
          <DataTable columns={columns} data={clientUsers} loading={loading} onRowClick={openEdit} />
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый пользователь</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Логин</Label><Input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} /></div>
            <div><Label>Имя</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Телефон</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Роль</Label><Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Администратор</SelectItem><SelectItem value="manager">Менеджер</SelectItem></SelectContent></Select></div>
            <div><Label>Пароль</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={saving || !form.login || !form.name || !form.password}>Создать</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый клиент</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Пайщик</Label><MemberSearch members={members} value={clientForm.member_id} onChange={v => setClientForm({ ...clientForm, member_id: v })} /></div>
            <div><Label>Логин</Label><Input value={clientForm.login} onChange={e => setClientForm({ ...clientForm, login: e.target.value })} /></div>
            <div><Label>Имя</Label><Input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></div>
            <div><Label>Телефон</Label><Input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} /></div>
            <div><Label>Пароль</Label><Input type="password" value={clientForm.password} onChange={e => setClientForm({ ...clientForm, password: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateClient} disabled={saving || !clientForm.login || !clientForm.name || !clientForm.password || !clientForm.member_id}>Создать</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактирование пользователя</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Логин</Label><Input value={editForm.login} onChange={e => setEditForm({ ...editForm, login: e.target.value })} /></div>
            <div><Label>Имя</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div><Label>Телефон</Label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            {editUser?.role !== "client" && (
              <div><Label>Роль</Label><Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Администратор</SelectItem><SelectItem value="manager">Менеджер</SelectItem></SelectContent></Select></div>
            )}
            {editUser?.role === "client" && (
              <div><Label>Пайщик</Label><MemberSearch members={members} value={editForm.member_id} onChange={v => setEditForm({ ...editForm, member_id: v })} /></div>
            )}
            <div><Label>Статус</Label><Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Активен</SelectItem><SelectItem value="blocked">Заблокирован</SelectItem></SelectContent></Select></div>
            <div><Label>Новый пароль (оставьте пустым, если не меняется)</Label><Input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></div>
          </div>
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {editUser && editUser.id !== currentUserId && (
                <>
                  <Button variant="outline" onClick={() => editUser && handleBlock(editUser.id)} disabled={saving}>{editUser.status === "active" ? "Заблокировать" : "Разблокировать"}</Button>
                  <Button variant="destructive" onClick={() => editUser && confirm(`Удалить пользователя "${editUser.name}"?`) && handleDelete(editUser.id)} disabled={saving}>Удалить</Button>
                </>
              )}
            </div>
            <Button onClick={handleEdit} disabled={saving}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUserManagement;
