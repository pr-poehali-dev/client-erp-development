import React, { useState, useEffect } from "react";
import PageHeader from "@/components/ui/page-header";
import DataTable, { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import MemberSearch from "@/components/ui/member-search";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import api, { StaffUser, AuditLogEntry, Member, Organization } from "@/lib/api";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const roleLabels: Record<string, string> = { admin: "Администратор", manager: "Менеджер", client: "Клиент" };
const actionLabels: Record<string, string> = { create: "Создание", update: "Изменение", payment: "Платёж", early_repayment: "Досрочное", modify: "Модификация", transaction: "Операция", early_close: "Досрочное закрытие", login: "Вход", login_failed: "Неудачный вход", logout: "Выход", block: "Блокировка" };
const entityLabels: Record<string, string> = { member: "Пайщик", loan: "Займ", saving: "Сбережение", share: "Паевой счёт", user: "Пользователь", auth: "Авторизация" };
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

const Admin = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPwChange, setShowPwChange] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ login: "", name: "", role: "manager", password: "", email: "", phone: "" });
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ login: "", name: "", password: "", phone: "", member_id: "" });
  const [editForm, setEditForm] = useState({ name: "", role: "", login: "", email: "", phone: "", status: "", password: "", member_id: "" as string });
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "" });
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditFilter, setAuditFilter] = useState({ entity: "", action: "" });
  const [auditLoading, setAuditLoading] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState<Partial<Organization>>({});
  const [orgSaving, setOrgSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.users.list(), api.members.list()]).then(([u, m]) => { setUsers(u); setMembers(m); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadAudit = (page = 0) => {
    setAuditLoading(true);
    const params: Record<string, string | number> = { limit: 50, offset: page * 50 };
    if (auditFilter.entity) params.filter_entity = auditFilter.entity;
    if (auditFilter.action) params.filter_action = auditFilter.action;
    api.audit.list(params).then((res) => {
      setAuditLog(res.items);
      setAuditTotal(res.total);
      setAuditPage(page);
    }).finally(() => setAuditLoading(false));
  };

  const loadOrgs = () => {
    setOrgsLoading(true);
    api.organizations.list().then(setOrgs).catch(() => {}).finally(() => setOrgsLoading(false));
  };

  const openOrgForm = (org?: Organization) => {
    if (org) {
      setEditOrg(org);
      setOrgForm({ ...org });
    } else {
      setEditOrg(null);
      setOrgForm({ director_position: "Директор" });
    }
    setShowOrgForm(true);
  };

  const saveOrg = async () => {
    setOrgSaving(true);
    try {
      if (editOrg) {
        await api.organizations.update({ id: editOrg.id, ...orgForm } as Organization & { id: number });
      } else {
        await api.organizations.create(orgForm);
      }
      toast({ title: editOrg ? "Организация обновлена" : "Организация создана" });
      setShowOrgForm(false);
      loadOrgs();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setOrgSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editOrg) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Неверный формат", description: "Допустимы: PNG, JPEG, WebP, SVG", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимум 2 МБ", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await api.organizations.uploadLogo(editOrg.id, base64, file.type);
        setOrgForm(prev => ({ ...prev, logo_url: res.logo_url }));
        toast({ title: "Логотип загружен" });
        loadOrgs();
      } catch (err) {
        toast({ title: "Ошибка загрузки", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDelete = async () => {
    if (!editOrg) return;
    try {
      await api.organizations.update({ id: editOrg.id, logo_url: "" });
      setOrgForm(prev => ({ ...prev, logo_url: "" }));
      toast({ title: "Логотип удалён" });
      loadOrgs();
    } catch (err) {
      toast({ title: "Ошибка", description: String(err), variant: "destructive" });
    }
  };

  const deleteOrg = async (org: Organization) => {
    if (!confirm(`Удалить организацию "${org.name}"?`)) return;
    try {
      await api.organizations.delete(org.id);
      toast({ title: "Организация удалена" });
      loadOrgs();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const staffUsers = users.filter((u) => u.role === "admin" || u.role === "manager");
  const clientUsers = users.filter((u) => u.role === "client");

  const handleCreate = async () => {
    if (!form.login || !form.name || !form.password) return;
    setSaving(true);
    try {
      await api.users.create(form);
      toast({ title: "Пользователь создан" });
      setShowForm(false);
      setForm({ login: "", name: "", role: "manager", password: "", email: "", phone: "" });
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async () => {
    if (!clientForm.login || !clientForm.name || !clientForm.password || !clientForm.member_id) return;
    setSaving(true);
    try {
      await api.users.create({ login: clientForm.login, name: clientForm.name, role: "client", password: clientForm.password, phone: clientForm.phone, member_id: Number(clientForm.member_id) });
      toast({ title: "Клиент создан", description: "Теперь пайщик сможет входить в личный кабинет" });
      setShowClientForm(false);
      setClientForm({ login: "", name: "", password: "", phone: "", member_id: "" });
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role, login: u.login || "", email: u.email || "", phone: u.phone || "", status: u.status, password: "", member_id: u.member_id ? String(u.member_id) : "" });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = { id: editUser.id };
      if (editForm.name !== editUser.name) data.name = editForm.name;
      if (editForm.role !== editUser.role) data.role = editForm.role;
      if (editForm.login !== (editUser.login || "")) data.login = editForm.login;
      if (editForm.email !== (editUser.email || "")) data.email = editForm.email;
      if (editForm.phone !== (editUser.phone || "")) data.phone = editForm.phone;
      if (editForm.status !== editUser.status) data.status = editForm.status;
      if (editForm.password) data.password = editForm.password;
      const newMid = editForm.member_id ? Number(editForm.member_id) : null;
      if (newMid !== editUser.member_id) data.member_id = newMid;
      await api.users.update(data as Parameters<typeof api.users.update>[0]);
      toast({ title: "Сохранено" });
      setShowEdit(false);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Заблокировать пользователя ${u.name}?`)) return;
    try {
      await api.users.delete(u.id);
      toast({ title: "Пользователь заблокирован" });
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const handleBulkCreateClients = async () => {
    const membersWithoutAccount = members.filter(m => m.status === "active" && !clientUsers.some(u => u.member_id === m.id));
    if (membersWithoutAccount.length === 0) {
      toast({ title: "Все пайщики уже имеют учётные записи" });
      return;
    }
    if (!confirm(`Будет создано ${membersWithoutAccount.length} учётных записей клиентов с паролем по умолчанию "kpk12345". Продолжить?`)) return;
    setSaving(true);
    try {
      const res = await api.users.bulkCreateClients();
      toast({ title: `Создано ${res.created} клиентов`, description: `Пароль по умолчанию: ${res.password}` });
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePwChange = async () => {
    if (!pwForm.new_password) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("staff_token") || "";
      await api.staffAuth.changePassword(token, pwForm.old_password, pwForm.new_password);
      toast({ title: "Пароль изменён" });
      setShowPwChange(false);
      setPwForm({ old_password: "", new_password: "" });
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const actionsColumn: Column<UserRow> = {
    key: "id",
    label: "",
    render: (u) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button className="p-1 rounded hover:bg-muted" title="Редактировать" onClick={() => openEdit(u)}>
          <Icon name="Pencil" size={14} />
        </button>
        {u.id !== (users.find((x) => x.login === currentUser?.login)?.id) && u.status === "active" && (
          <button className="p-1 rounded hover:bg-muted text-destructive" title="Заблокировать" onClick={() => handleDelete(u)}>
            <Icon name="Ban" size={14} />
          </button>
        )}
      </div>
    ),
  };

  const staffColumns = [...columns, actionsColumn];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Администрирование"
        description="Управление пользователями и ролями"
        actionLabel="Добавить сотрудника"
        actionIcon="UserPlus"
        onAction={() => setShowForm(true)}
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Сотрудники</TabsTrigger>
          <TabsTrigger value="clients">Клиенты ЛК</TabsTrigger>
          <TabsTrigger value="audit" onClick={() => { if (auditLog.length === 0) loadAudit(); }}>Журнал действий</TabsTrigger>
          <TabsTrigger value="org" onClick={() => { if (orgs.length === 0 && !orgsLoading) loadOrgs(); }}>Организации</TabsTrigger>
          <TabsTrigger value="roles">Роли и права</TabsTrigger>
          <TabsTrigger value="profile">Мой профиль</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Всего сотрудников</div>
              <div className="text-xl font-bold">{staffUsers.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Администраторов</div>
              <div className="text-xl font-bold">{staffUsers.filter((u) => u.role === "admin").length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Менеджеров</div>
              <div className="text-xl font-bold">{staffUsers.filter((u) => u.role === "manager").length}</div>
            </Card>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <DataTable columns={staffColumns} data={staffUsers} emptyMessage="Нет сотрудников" onRowClick={openEdit} />
          )}
        </TabsContent>

        <TabsContent value="clients" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Card className="p-4 flex-1 mr-4">
              <div className="text-xs text-muted-foreground mb-1">Клиентов в личном кабинете</div>
              <div className="text-xl font-bold">{clientUsers.length}</div>
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBulkCreateClients} disabled={saving} className="gap-2">
                <Icon name="UsersRound" size={16} />Создать для всех пайщиков
              </Button>
              <Button onClick={() => { setClientForm({ login: "", name: "", password: "", phone: "", member_id: "" }); setShowClientForm(true); }} className="gap-2">
                <Icon name="UserPlus" size={16} />Добавить клиента
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Логин</th>
                    <th className="px-3 py-2 text-left font-medium">Имя</th>
                    <th className="px-3 py-2 text-left font-medium">Пайщик</th>
                    <th className="px-3 py-2 text-left font-medium">Телефон</th>
                    <th className="px-3 py-2 text-left font-medium">Статус</th>
                    <th className="px-3 py-2 text-left font-medium">Последний вход</th>
                    <th className="px-3 py-2 text-center font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clientUsers.map(u => {
                    const member = members.find(m => m.id === u.member_id);
                    return (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{u.login}</td>
                        <td className="px-3 py-2">{u.name}</td>
                        <td className="px-3 py-2">
                          {member ? (
                            <div>
                              <span className="text-xs font-medium">{member.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">({member.member_no})</span>
                            </div>
                          ) : u.member_id ? (
                            <span className="text-xs text-muted-foreground">ID: {u.member_id}</span>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Не привязан</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{u.phone || "—"}</td>
                        <td className="px-3 py-2"><Badge variant={u.status === "active" ? "default" : "outline"} className="text-xs">{statusLabels[u.status] || u.status}</Badge></td>
                        <td className="px-3 py-2 text-xs">{fmtDate(u.last_login)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <button className="p-1 rounded hover:bg-muted" title="Редактировать" onClick={() => openEdit(u)}><Icon name="Pencil" size={14} /></button>
                            {u.status === "active" && <button className="p-1 rounded hover:bg-muted text-destructive" title="Заблокировать" onClick={() => handleDelete(u)}><Icon name="Ban" size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {clientUsers.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-xs">Нет клиентов. Добавьте первого клиента для доступа в личный кабинет.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Объект</Label>
              <Select value={auditFilter.entity} onValueChange={(v) => setAuditFilter({ ...auditFilter, entity: v === "all" ? "" : v })}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Все" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="member">Пайщики</SelectItem>
                  <SelectItem value="loan">Займы</SelectItem>
                  <SelectItem value="saving">Сбережения</SelectItem>
                  <SelectItem value="share">Паевые счета</SelectItem>
                  <SelectItem value="user">Пользователи</SelectItem>
                  <SelectItem value="auth">Авторизация</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Действие</Label>
              <Select value={auditFilter.action} onValueChange={(v) => setAuditFilter({ ...auditFilter, action: v === "all" ? "" : v })}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Все" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="create">Создание</SelectItem>
                  <SelectItem value="update">Изменение</SelectItem>
                  <SelectItem value="payment">Платёж</SelectItem>
                  <SelectItem value="early_repayment">Досрочное</SelectItem>
                  <SelectItem value="modify">Модификация</SelectItem>
                  <SelectItem value="transaction">Операция</SelectItem>
                  <SelectItem value="login">Вход</SelectItem>
                  <SelectItem value="login_failed">Неудачный вход</SelectItem>
                  <SelectItem value="block">Блокировка</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadAudit(0)}>
              <Icon name="Search" size={14} className="mr-1" /> Применить
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">Всего записей: {auditTotal}</span>
          </div>

          {auditLoading ? (
            <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Дата</th>
                    <th className="px-3 py-2 text-left font-medium">Пользователь</th>
                    <th className="px-3 py-2 text-left font-medium">Действие</th>
                    <th className="px-3 py-2 text-left font-medium">Объект</th>
                    <th className="px-3 py-2 text-left font-medium">Метка</th>
                    <th className="px-3 py-2 text-left font-medium">Детали</th>
                    <th className="px-3 py-2 text-left font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="font-medium">{entry.user_name || "—"}</span>
                        {entry.user_role && <Badge variant="outline" className="ml-1 text-[10px] py-0">{roleLabels[entry.user_role] || entry.user_role}</Badge>}
                      </td>
                      <td className="px-3 py-2"><Badge variant={entry.action === "login_failed" || entry.action === "block" ? "destructive" : "secondary"} className="text-[10px]">{actionLabels[entry.action] || entry.action}</Badge></td>
                      <td className="px-3 py-2 text-xs">{entityLabels[entry.entity] || entry.entity}{entry.entity_id ? ` #${entry.entity_id}` : ""}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{entry.entity_label || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[250px] truncate">{entry.details || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{entry.ip || "—"}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-xs">Нет записей</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {auditTotal > 50 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={auditPage === 0} onClick={() => loadAudit(auditPage - 1)}>
                <Icon name="ChevronLeft" size={14} />
              </Button>
              <span className="text-xs self-center">{auditPage + 1} / {Math.ceil(auditTotal / 50)}</span>
              <Button variant="outline" size="sm" disabled={(auditPage + 1) * 50 >= auditTotal} onClick={() => loadAudit(auditPage + 1)}>
                <Icon name="ChevronRight" size={14} />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="org" className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Организации</h3>
              <p className="text-xs text-muted-foreground">Управление организациями, предоставляющими финансовые услуги</p>
            </div>
            <Button onClick={() => openOrgForm()} className="gap-2">
              <Icon name="Plus" size={16} />Добавить организацию
            </Button>
          </div>

          {orgsLoading ? (
            <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
          ) : orgs.length === 0 ? (
            <Card className="p-8 text-center">
              <Icon name="Building2" size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Нет организаций. Добавьте первую.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgs.map(org => (
                <Card key={org.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openOrgForm(org)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon name="Building2" size={20} className="text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{org.name || "Без названия"}</h4>
                        {org.short_name && <p className="text-xs text-muted-foreground truncate">{org.short_name}</p>}
                        {org.inn && <p className="text-xs text-muted-foreground mt-1">ИНН: {org.inn}</p>}
                        {org.director_fio && <p className="text-xs text-muted-foreground">{org.director_position || "Директор"}: {org.director_fio}</p>}
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button className="p-1 rounded hover:bg-muted" onClick={() => openOrgForm(org)}><Icon name="Pencil" size={14} /></button>
                        <button className="p-1 rounded hover:bg-muted text-destructive" onClick={() => deleteOrg(org)}><Icon name="Trash2" size={14} /></button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                      {org.phone && <span className="flex items-center gap-1"><Icon name="Phone" size={10} />{org.phone}</span>}
                      {org.email && <span className="flex items-center gap-1"><Icon name="Mail" size={10} />{org.email}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><Icon name="ShieldCheck" size={16} className="text-red-600" /></div>
                  <CardTitle className="text-sm">Администратор</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Полный доступ к системе</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Управление пользователями</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Удаление записей</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Все операции</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Icon name="UserCog" size={16} className="text-primary" /></div>
                  <CardTitle className="text-sm">Менеджер</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Просмотр данных</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Создание и редактирование</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Оформление договоров</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Внесение платежей</li>
                  <li className="flex items-center gap-2"><Icon name="X" size={12} className="text-destructive" /> Удаление записей</li>
                  <li className="flex items-center gap-2"><Icon name="X" size={12} className="text-destructive" /> Управление пользователями</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Icon name="User" size={16} className="text-muted-foreground" /></div>
                  <CardTitle className="text-sm">Клиент</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Личный кабинет</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-green-600" /> Просмотр своих договоров</li>
                  <li className="flex items-center gap-2"><Icon name="X" size={12} className="text-destructive" /> Доступ к панели управления</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Мой профиль</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div><span className="text-sm text-muted-foreground">Имя:</span> <span className="text-sm font-medium">{currentUser?.name}</span></div>
              <div><span className="text-sm text-muted-foreground">Логин:</span> <span className="text-sm font-medium">{currentUser?.login}</span></div>
              <div><span className="text-sm text-muted-foreground">Роль:</span> <Badge variant={roleColor(currentUser?.role || "")} className="text-xs ml-1">{roleLabels[currentUser?.role || ""] || currentUser?.role}</Badge></div>
              <Button variant="outline" size="sm" onClick={() => { setPwForm({ old_password: "", new_password: "" }); setShowPwChange(true); }}>
                <Icon name="Key" size={14} className="mr-2" />Сменить пароль
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Новый сотрудник</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Логин *</Label>
              <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="ivanov" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ФИО *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Иванов Иван Иванович" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Роль</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Менеджер</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Пароль *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Не менее 6 символов" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving || !form.login || !form.name || !form.password} className="w-full">
              {saving ? "Создание..." : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Редактировать: {editUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Логин</Label>
              <Input value={editForm.login} onChange={(e) => setEditForm({ ...editForm, login: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ФИО</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Роль</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Администратор</SelectItem>
                    <SelectItem value="manager">Менеджер</SelectItem>
                    <SelectItem value="client">Клиент</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Статус</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активен</SelectItem>
                    <SelectItem value="blocked">Заблокирован</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editForm.role === "client" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Привязка к пайщику</Label>
                <MemberSearch members={members} value={editForm.member_id} onChange={(id) => setEditForm({ ...editForm, member_id: id })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Новый пароль (оставьте пустым, если не менять)</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Не менее 6 символов" />
            </div>
            <Button onClick={handleUpdate} disabled={saving} className="w-full">
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Новый клиент личного кабинета</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Привязка к пайщику *</Label>
              <MemberSearch members={members} value={clientForm.member_id} onChange={(id) => {
                const m = members.find(x => String(x.id) === id);
                setClientForm(p => ({
                  ...p,
                  member_id: id,
                  name: m ? m.name : p.name,
                  phone: m?.phone || p.phone,
                  login: m?.phone ? m.phone.replace(/\D/g, "").slice(-10) : p.login,
                }));
              }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Логин * (телефон или произвольный)</Label>
              <Input value={clientForm.login} onChange={(e) => setClientForm({ ...clientForm, login: e.target.value })} placeholder="79001234567" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ФИО *</Label>
              <Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Пароль *</Label>
              <Input type="password" value={clientForm.password} onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })} placeholder="Не менее 6 символов" />
            </div>
            <Card className="p-3 bg-muted/50">
              <div className="text-xs text-muted-foreground">Клиент сможет входить в личный кабинет по логину и паролю. В кабинете он увидит все договоры и счета привязанного пайщика.</div>
            </Card>
            <Button onClick={handleCreateClient} disabled={saving || !clientForm.login || !clientForm.name || !clientForm.password || !clientForm.member_id} className="w-full">
              {saving ? "Создание..." : "Создать клиента"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPwChange} onOpenChange={setShowPwChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Смена пароля</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Текущий пароль</Label>
              <Input type="password" value={pwForm.old_password} onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Новый пароль</Label>
              <Input type="password" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Не менее 6 символов" />
            </div>
            <Button onClick={handlePwChange} disabled={saving || !pwForm.new_password} className="w-full">
              {saving ? "Сохранение..." : "Сменить пароль"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrgForm} onOpenChange={setShowOrgForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editOrg ? "Редактировать организацию" : "Новая организация"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {editOrg && (
              <div className="flex items-center gap-4">
                {orgForm.logo_url ? (
                  <div className="relative group">
                    <img src={orgForm.logo_url} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                    <button onClick={handleLogoDelete} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить логотип">
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <Icon name="Image" size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Логотип</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} className="mt-1 h-9 text-xs" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Полное наименование *</Label>
              <Input value={orgForm.name || ""} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} placeholder='КПК «ЭКСПЕРТ ФИНАНС»' />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Краткое наименование</Label>
              <Input value={orgForm.short_name || ""} onChange={e => setOrgForm({ ...orgForm, short_name: e.target.value })} placeholder="ЭКСПЕРТ ФИНАНС" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ИНН</Label>
                <Input value={orgForm.inn || ""} onChange={e => setOrgForm({ ...orgForm, inn: e.target.value })} placeholder="1234567890" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ОГРН</Label>
                <Input value={orgForm.ogrn || ""} onChange={e => setOrgForm({ ...orgForm, ogrn: e.target.value })} placeholder="1234567890123" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">КПП</Label>
                <Input value={orgForm.kpp || ""} onChange={e => setOrgForm({ ...orgForm, kpp: e.target.value })} placeholder="123456789" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ФИО руководителя</Label>
                <Input value={orgForm.director_fio || ""} onChange={e => setOrgForm({ ...orgForm, director_fio: e.target.value })} placeholder="Иванов Иван Иванович" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Должность руководителя</Label>
                <Input value={orgForm.director_position || ""} onChange={e => setOrgForm({ ...orgForm, director_position: e.target.value })} placeholder="Директор" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Юридический адрес</Label>
              <Input value={orgForm.legal_address || ""} onChange={e => setOrgForm({ ...orgForm, legal_address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Фактический адрес</Label>
              <Input value={orgForm.actual_address || ""} onChange={e => setOrgForm({ ...orgForm, actual_address: e.target.value })} />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon name="Phone" size={16} className="text-muted-foreground" />Контакты
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Телефон</Label>
                  <Input value={orgForm.phone || ""} onChange={e => setOrgForm({ ...orgForm, phone: e.target.value })} placeholder="8 (800) 700-89-09" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input value={orgForm.email || ""} onChange={e => setOrgForm({ ...orgForm, email: e.target.value })} placeholder="info@company.ru" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Сайт</Label>
                  <Input value={orgForm.website || ""} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} placeholder="company.ru" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Telegram</Label>
                  <Input value={orgForm.telegram || ""} onChange={e => setOrgForm({ ...orgForm, telegram: e.target.value })} placeholder="@company" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">WhatsApp</Label>
                  <Input value={orgForm.whatsapp || ""} onChange={e => setOrgForm({ ...orgForm, whatsapp: e.target.value })} placeholder="+79001234567" />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon name="Landmark" size={16} className="text-muted-foreground" />Банковские реквизиты
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Наименование банка</Label>
                  <Input value={orgForm.bank_name || ""} onChange={e => setOrgForm({ ...orgForm, bank_name: e.target.value })} placeholder="ПАО Сбербанк" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">БИК</Label>
                    <Input value={orgForm.bik || ""} onChange={e => setOrgForm({ ...orgForm, bik: e.target.value })} placeholder="044525225" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Расчётный счёт</Label>
                    <Input value={orgForm.rs || ""} onChange={e => setOrgForm({ ...orgForm, rs: e.target.value })} placeholder="40702810..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Корр. счёт</Label>
                    <Input value={orgForm.ks || ""} onChange={e => setOrgForm({ ...orgForm, ks: e.target.value })} placeholder="30101810..." />
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={saveOrg} disabled={orgSaving || !orgForm.name} className="w-full gap-2">
              {orgSaving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
              {orgSaving ? "Сохранение..." : (editOrg ? "Сохранить" : "Создать")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;