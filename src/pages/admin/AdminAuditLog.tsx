import { useState, useEffect } from "react";
import DataTable, { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditLogEntry } from "@/lib/api";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const actionLabels: Record<string, string> = { create: "Создание", update: "Изменение", payment: "Платёж", early_repayment: "Досрочное", modify: "Модификация", transaction: "Операция", early_close: "Досрочное закрытие", login: "Вход", login_failed: "Неудачный вход", logout: "Выход", block: "Блокировка", delete_contract: "Удаление договора", delete_payment: "Удаление платежа", delete_transaction: "Удаление операции", delete_account: "Удаление счета", delete: "Удаление" };
const entityLabels: Record<string, string> = { member: "Пайщик", loan: "Займ", saving: "Сбережение", share: "Паевой счёт", user: "Пользователь", auth: "Авторизация" };

const auditColumns: Column<AuditLogEntry>[] = [
  { key: "created_at", label: "Дата", render: (i) => <span className="text-xs">{fmtDate(i.created_at)}</span> },
  { key: "user_name", label: "Пользователь", render: (i) => <span className="text-xs">{i.user_name || "—"}</span> },
  { key: "action", label: "Действие", render: (i) => <Badge variant="outline" className="text-xs">{actionLabels[i.action] || i.action}</Badge> },
  { key: "entity", label: "Объект", render: (i) => <Badge variant="secondary" className="text-xs">{entityLabels[i.entity] || i.entity}</Badge> },
  { key: "entity_label", label: "Идентификатор", render: (i) => <span className="text-xs font-medium">{i.entity_label || "—"}</span> },
  { key: "details", label: "Детали", render: (i) => <span className="text-xs text-muted-foreground">{i.details || "—"}</span> },
  { key: "ip", label: "IP", render: (i) => <span className="text-xs">{i.ip || "—"}</span> },
];

interface AdminAuditLogProps {
  onLoad: (page: number) => void;
}

const AdminAuditLog = (props: AdminAuditLogProps) => {
  const { onLoad } = props;
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditFilter, setAuditFilter] = useState({ entity: "", action: "" });
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    onLoad(0);
  }, []);

  return (
    <>
      <div className="mb-4 flex gap-4">
        <div className="w-48">
          <Label>Объект</Label>
          <Select value={auditFilter.entity} onValueChange={v => setAuditFilter({ ...auditFilter, entity: v })}>
            <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все</SelectItem>
              <SelectItem value="member">Пайщик</SelectItem>
              <SelectItem value="loan">Займ</SelectItem>
              <SelectItem value="saving">Сбережение</SelectItem>
              <SelectItem value="share">Паевой счёт</SelectItem>
              <SelectItem value="user">Пользователь</SelectItem>
              <SelectItem value="auth">Авторизация</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label>Действие</Label>
          <Select value={auditFilter.action} onValueChange={v => setAuditFilter({ ...auditFilter, action: v })}>
            <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все</SelectItem>
              <SelectItem value="create">Создание</SelectItem>
              <SelectItem value="update">Изменение</SelectItem>
              <SelectItem value="delete">Удаление</SelectItem>
              <SelectItem value="payment">Платёж</SelectItem>
              <SelectItem value="transaction">Операция</SelectItem>
              <SelectItem value="login">Вход</SelectItem>
              <SelectItem value="logout">Выход</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end"><Button onClick={() => onLoad(0)}>Применить</Button></div>
      </div>

      <DataTable columns={auditColumns} data={auditLog} loading={auditLoading} />

      {auditTotal > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button size="sm" onClick={() => onLoad(auditPage - 1)} disabled={auditPage === 0}>Назад</Button>
          <span className="text-sm py-2">Стр. {auditPage + 1} из {Math.ceil(auditTotal / 50)}</span>
          <Button size="sm" onClick={() => onLoad(auditPage + 1)} disabled={(auditPage + 1) * 50 >= auditTotal}>Вперёд</Button>
        </div>
      )}
    </>
  );
};

export default AdminAuditLog;
