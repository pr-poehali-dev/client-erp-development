import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import api, { CabinetProfile } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onSaved: () => void;
}

const FL_FIELDS: { key: keyof CabinetProfile; label: string; type?: string; group: string }[] = [
  { key: "last_name", label: "Фамилия", group: "personal" },
  { key: "first_name", label: "Имя", group: "personal" },
  { key: "middle_name", label: "Отчество", group: "personal" },
  { key: "birth_date", label: "Дата рождения", type: "date", group: "personal" },
  { key: "birth_place", label: "Место рождения", group: "personal" },
  { key: "inn", label: "ИНН", group: "documents" },
  { key: "passport_series", label: "Серия паспорта", group: "documents" },
  { key: "passport_number", label: "Номер паспорта", group: "documents" },
  { key: "passport_dept_code", label: "Код подразделения", group: "documents" },
  { key: "passport_issue_date", label: "Дата выдачи", type: "date", group: "documents" },
  { key: "passport_issued_by", label: "Кем выдан", group: "documents" },
  { key: "registration_address", label: "Адрес регистрации", group: "documents" },
  { key: "phone", label: "Телефон", type: "tel", group: "contacts" },
  { key: "email", label: "Email", type: "email", group: "contacts" },
  { key: "telegram", label: "Telegram", group: "contacts" },
  { key: "extra_phone", label: "Доп. телефон", type: "tel", group: "contacts" },
  { key: "extra_contact_fio", label: "ФИО доп. контакта", group: "contacts" },
  { key: "bank_bik", label: "БИК банка", group: "bank" },
  { key: "bank_account", label: "Расчётный счёт", group: "bank" },
  { key: "spouse_fio", label: "ФИО супруга(и)", group: "family" },
  { key: "spouse_phone", label: "Телефон супруга(и)", type: "tel", group: "family" },
];

const UL_FIELDS: { key: keyof CabinetProfile; label: string; type?: string; group: string }[] = [
  { key: "company_name", label: "Наименование организации", group: "company" },
  { key: "inn", label: "ИНН", group: "company" },
  { key: "director_fio", label: "ФИО руководителя", group: "company" },
  { key: "director_phone", label: "Телефон руководителя", type: "tel", group: "company" },
  { key: "contact_person_fio", label: "ФИО контактного лица", group: "contacts" },
  { key: "contact_person_phone", label: "Телефон контактного лица", type: "tel", group: "contacts" },
  { key: "bank_bik", label: "БИК банка", group: "bank" },
  { key: "bank_account", label: "Расчётный счёт", group: "bank" },
];

const MARITAL_OPTIONS = [
  { value: "", label: "Не указано" },
  { value: "single", label: "Не в браке" },
  { value: "married", label: "В браке" },
  { value: "divorced", label: "Разведён(а)" },
  { value: "widowed", label: "Вдовец/вдова" },
];

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  personal: { label: "Личные данные", icon: "User" },
  documents: { label: "Документы", icon: "FileText" },
  contacts: { label: "Контакты", icon: "Phone" },
  bank: { label: "Банковские реквизиты", icon: "Building2" },
  family: { label: "Семья", icon: "Heart" },
  company: { label: "Организация", icon: "Building" },
};

const CabinetProfileDialog = ({ open, onOpenChange, token, onSaved }: Props) => {
  const [profile, setProfile] = useState<Partial<CabinetProfile>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.cabinet.getProfile(token)
      .then(data => setProfile(data))
      .catch(e => toast({ title: "Ошибка загрузки", description: String(e), variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, token]);

  const handleChange = (key: keyof CabinetProfile, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { member_type, ...data } = profile;
      void member_type;
      await api.cabinet.updateProfile(token, data);
      toast({ title: "Данные сохранены" });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Ошибка сохранения", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isUL = profile.member_type === "UL";
  const fields = isUL ? UL_FIELDS : FL_FIELDS;

  const groups = [...new Set(fields.map(f => f.group))];

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Мои данные</DialogTitle></DialogHeader>
          <div className="flex-1 flex items-center justify-center py-12">
            <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <Icon name="UserPen" size={18} />
            Мои данные
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {groups.map(group => {
            const groupFields = fields.filter(f => f.group === group);
            const info = GROUP_LABELS[group] || { label: group, icon: "Circle" };
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name={info.icon} size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{info.label}</span>
                </div>
                <div className="space-y-3">
                  {groupFields.map(field => (
                    <div key={field.key}>
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <Input
                        type={field.type || "text"}
                        value={profile[field.key] || ""}
                        onChange={e => handleChange(field.key, e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  ))}
                  {group === "family" && !isUL && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Семейное положение</Label>
                      <Select value={profile.marital_status || ""} onValueChange={v => handleChange("marital_status", v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Не указано" /></SelectTrigger>
                        <SelectContent>
                          {MARITAL_OPTIONS.map(o => (
                            <SelectItem key={o.value || "empty"} value={o.value || "none"}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t shrink-0">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CabinetProfileDialog;
