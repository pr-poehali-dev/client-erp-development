import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { Organization } from "@/lib/api";

interface AdminOrganizationsProps {
  orgs: Organization[];
  loading: boolean;
  onLoad: () => void;
  onCreate: (form: Partial<Organization>) => Promise<void>;
  onUpdate: (id: number, form: Partial<Organization>) => Promise<void>;
  onDelete: (org: Organization) => Promise<void>;
  onUploadLogo: (orgId: number, base64: string, mimeType: string) => Promise<{ logo_url: string }>;
}

const AdminOrganizations = (props: AdminOrganizationsProps) => {
  const { orgs, loading, onLoad, onCreate, onUpdate, onDelete, onUploadLogo } = props;
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState<Partial<Organization>>({});
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    onLoad();
  }, []);

  const loadOrgs = () => {
    onLoad();
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
        await onUpdate(editOrg.id, orgForm);
      } else {
        await onCreate(orgForm);
      }
      setShowOrgForm(false);
      loadOrgs();
    } finally {
      setOrgSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editOrg) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await onUploadLogo(editOrg.id, base64, file.type);
      setOrgForm(prev => ({ ...prev, logo_url: res.logo_url }));
      loadOrgs();
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDelete = async () => {
    if (!editOrg) return;
    await onUpdate(editOrg.id, { logo_url: "" });
    setOrgForm(prev => ({ ...prev, logo_url: "" }));
    loadOrgs();
  };

  const deleteOrg = async (org: Organization) => {
    await onDelete(org);
    loadOrgs();
  };

  return (
    <>
      <div className="mb-4"><Button onClick={() => openOrgForm()}><Icon name="Building2" size={16} className="mr-2" />Создать организацию</Button></div>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Нет организаций</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {orgs.map(org => (
            <Card key={org.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openOrgForm(org)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {org.logo_url && (
                    <img src={org.logo_url} alt={org.name} className="w-12 h-12 object-contain" />
                  )}
                  <div className="flex-1">
                    <CardTitle className="text-base">{org.name}</CardTitle>
                    {org.short_name && <div className="text-xs text-muted-foreground mt-1">{org.short_name}</div>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm">
                {org.inn && <div><span className="text-muted-foreground">ИНН:</span> {org.inn}</div>}
                {org.phone && <div><span className="text-muted-foreground">Телефон:</span> {org.phone}</div>}
                {org.email && <div><span className="text-muted-foreground">Email:</span> {org.email}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showOrgForm} onOpenChange={setShowOrgForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editOrg ? "Редактирование организации" : "Новая организация"}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div><Label>Полное наименование</Label><Input value={orgForm.name || ""} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} /></div>
              <div><Label>Краткое наименование</Label><Input value={orgForm.short_name || ""} onChange={e => setOrgForm({ ...orgForm, short_name: e.target.value })} /></div>
              <div><Label>ИНН</Label><Input value={orgForm.inn || ""} onChange={e => setOrgForm({ ...orgForm, inn: e.target.value })} /></div>
              <div><Label>ОГРН</Label><Input value={orgForm.ogrn || ""} onChange={e => setOrgForm({ ...orgForm, ogrn: e.target.value })} /></div>
              <div><Label>Адрес</Label><Input value={orgForm.address || ""} onChange={e => setOrgForm({ ...orgForm, address: e.target.value })} /></div>
              <div><Label>Телефон</Label><Input value={orgForm.phone || ""} onChange={e => setOrgForm({ ...orgForm, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={orgForm.email || ""} onChange={e => setOrgForm({ ...orgForm, email: e.target.value })} /></div>
              <div><Label>Сайт</Label><Input value={orgForm.website || ""} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} /></div>
              <div><Label>Telegram</Label><Input value={orgForm.telegram || ""} onChange={e => setOrgForm({ ...orgForm, telegram: e.target.value })} placeholder="@username" /></div>
              <div><Label>WhatsApp</Label><Input value={orgForm.whatsapp || ""} onChange={e => setOrgForm({ ...orgForm, whatsapp: e.target.value })} placeholder="+79991234567" /></div>
            </div>
            <div className="space-y-3">
              <div><Label>Директор (ФИО)</Label><Input value={orgForm.director_name || ""} onChange={e => setOrgForm({ ...orgForm, director_name: e.target.value })} /></div>
              <div><Label>Должность директора</Label><Input value={orgForm.director_position || ""} onChange={e => setOrgForm({ ...orgForm, director_position: e.target.value })} /></div>
              <div><Label>БИК банка</Label><Input value={orgForm.bank_bik || ""} onChange={e => setOrgForm({ ...orgForm, bank_bik: e.target.value })} /></div>
              <div><Label>Расчётный счёт</Label><Input value={orgForm.bank_account || ""} onChange={e => setOrgForm({ ...orgForm, bank_account: e.target.value })} /></div>
              <div><Label>Корр. счёт</Label><Input value={orgForm.bank_corr_account || ""} onChange={e => setOrgForm({ ...orgForm, bank_corr_account: e.target.value })} /></div>
              <div><Label>Наименование банка</Label><Input value={orgForm.bank_name || ""} onChange={e => setOrgForm({ ...orgForm, bank_name: e.target.value })} /></div>
              {editOrg && (
                <div>
                  <Label>Логотип</Label>
                  <div className="flex items-center gap-2 mt-2">
                    {orgForm.logo_url ? (
                      <>
                        <img src={orgForm.logo_url} alt="Логотип" className="w-16 h-16 object-contain border rounded" />
                        <Button size="sm" variant="destructive" onClick={handleLogoDelete}><Icon name="Trash2" size={14} className="mr-1" />Удалить</Button>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">Логотип не загружен</div>
                    )}
                  </div>
                  <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="mt-2" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {editOrg && <Button variant="destructive" onClick={() => editOrg && deleteOrg(editOrg)}>Удалить</Button>}
            <Button onClick={saveOrg} disabled={orgSaving || !orgForm.name}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminOrganizations;