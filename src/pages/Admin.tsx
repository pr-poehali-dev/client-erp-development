import React, { useState, useEffect } from "react";
import PageHeader from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import api, { StaffUser, AuditLogEntry, Member, Organization } from "@/lib/api";
import AdminUserManagement from "./admin/AdminUserManagement";
import AdminAuditLog from "./admin/AdminAuditLog";
import AdminOrganizations from "./admin/AdminOrganizations";

type UserRow = StaffUser & { [key: string]: unknown };

const Admin = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPwChange, setShowPwChange] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "" });
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditFilter, setAuditFilter] = useState({ entity: "", action: "" });
  const [auditLoading, setAuditLoading] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);

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
    api.organizations.list().then(setOrgs).catch(() => {});
  };

  const handleCreateUser = async (form: { login: string; name: string; role: string; password: string; email: string; phone: string }) => {
    await api.users.create(form);
    toast({ title: "Пользователь создан" });
    load();
  };

  const handleCreateClient = async (form: { login: string; name: string; password: string; phone: string; member_id: string }) => {
    await api.users.create({ ...form, role: "client", member_id: Number(form.member_id) });
    toast({ title: "Клиент создан" });
    load();
  };

  const handleEditUser = async (userId: number, form: { name: string; role: string; login: string; email: string; phone: string; status: string; password: string; member_id: string }) => {
    const updates: Record<string, unknown> = { name: form.name, login: form.login, email: form.email, phone: form.phone, status: form.status };
    if (form.role) updates.role = form.role;
    if (form.member_id) updates.member_id = Number(form.member_id);
    if (form.password) updates.password = form.password;
    await api.users.update(userId, updates);
    toast({ title: "Пользователь обновлён" });
    load();
  };

  const handleDeleteUser = async (userId: number) => {
    const u = users.find(x => x.id === userId);
    if (!u || !confirm(`Удалить пользователя "${u.name}"?`)) return;
    await api.users.delete(userId);
    toast({ title: "Пользователь удалён" });
    load();
  };

  const handleBlockUser = async (userId: number) => {
    const u = users.find(x => x.id === userId);
    if (!u) return;
    const newStatus = u.status === "active" ? "blocked" : "active";
    await api.users.update(userId, { status: newStatus });
    toast({ title: newStatus === "blocked" ? "Пользователь заблокирован" : "Пользователь разблокирован" });
    load();
  };

  const handlePwChange = async () => {
    if (!pwForm.old_password || !pwForm.new_password) return;
    try {
      await api.users.changePassword(pwForm.old_password, pwForm.new_password);
      toast({ title: "Пароль изменён" });
      setShowPwChange(false);
      setPwForm({ old_password: "", new_password: "" });
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const handleCreateOrg = async (form: Partial<Organization>) => {
    await api.organizations.create(form);
    toast({ title: "Организация создана" });
  };

  const handleUpdateOrg = async (id: number, form: Partial<Organization>) => {
    await api.organizations.update({ id, ...form } as Organization & { id: number });
    toast({ title: "Организация обновлена" });
  };

  const handleDeleteOrg = async (org: Organization) => {
    if (!confirm(`Удалить организацию "${org.name}"?`)) return;
    await api.organizations.delete(org.id);
    toast({ title: "Организация удалена" });
  };

  const handleUploadLogo = async (orgId: number, base64: string, mimeType: string) => {
    const res = await api.organizations.uploadLogo(orgId, base64, mimeType);
    toast({ title: "Логотип загружен" });
    return res;
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Администрирование"
        actionLabel="Сменить пароль"
        actionIcon="KeyRound"
        onAction={() => setShowPwChange(true)}
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="audit">Журнал</TabsTrigger>
          <TabsTrigger value="organizations">Организации</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUserManagement
            users={users}
            members={members}
            loading={loading}
            currentUserId={currentUser?.id}
            onCreate={handleCreateUser}
            onCreateClient={handleCreateClient}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onBlock={handleBlockUser}
          />
        </TabsContent>

        <TabsContent value="audit">
          <AdminAuditLog onLoad={loadAudit} />
        </TabsContent>

        <TabsContent value="organizations">
          <AdminOrganizations
            onLoad={loadOrgs}
            onCreate={handleCreateOrg}
            onUpdate={handleUpdateOrg}
            onDelete={handleDeleteOrg}
            onUploadLogo={handleUploadLogo}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={showPwChange} onOpenChange={setShowPwChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Смена пароля</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Текущий пароль</Label><Input type="password" value={pwForm.old_password} onChange={e => setPwForm({ ...pwForm, old_password: e.target.value })} /></div>
            <div><Label>Новый пароль</Label><Input type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handlePwChange} disabled={!pwForm.old_password || !pwForm.new_password}>Изменить</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
