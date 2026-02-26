import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api, { AuditLogEntry } from "@/lib/api";

const ALL = "_all";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const actionLabels: Record<string, string> = { create: "Создание", update: "Изменение", payment: "Платёж", early_repayment: "Досрочное", modify: "Модификация", transaction: "Операция", early_close: "Досрочное закрытие", login: "Вход", login_failed: "Неудачный вход", logout: "Выход", block: "Блокировка", delete_contract: "Удаление договора", delete_payment: "Удаление платежа", delete_transaction: "Удаление операции", delete_account: "Удаление счета", delete: "Удаление" };
const entityLabels: Record<string, string> = { member: "Пайщик", loan: "Займ", saving: "Сбережение", share: "Паевой счёт", user: "Пользователь", auth: "Авторизация" };

const PAGE_SIZE = 50;

const auditColumns: Column<AuditLogEntry>[] = [
  { key: "created_at", label: "Дата", render: (i) => <span className="text-xs">{fmtDate(i.created_at)}</span> },
  { key: "user_name", label: "Пользователь", render: (i) => <span className="text-xs">{i.user_name || "—"}</span> },
  { key: "action", label: "Действие", render: (i) => <Badge variant="outline" className="text-xs">{actionLabels[i.action] || i.action}</Badge> },
  { key: "entity", label: "Объект", render: (i) => <Badge variant="secondary" className="text-xs">{entityLabels[i.entity] || i.entity}</Badge> },
  { key: "entity_label", label: "Идентификатор", render: (i) => <span className="text-xs font-medium">{i.entity_label || "—"}</span> },
  { key: "details", label: "Детали", render: (i) => <span className="text-xs text-muted-foreground max-w-xs truncate block">{i.details || "—"}</span> },
  { key: "ip", label: "IP", render: (i) => <span className="text-xs">{i.ip || "—"}</span> },
];

const toFilter = (v: string) => v === ALL ? "" : v;

const AdminAuditLog = () => {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterEntity, setFilterEntity] = useState(ALL);
  const [filterAction, setFilterAction] = useState(ALL);
  const [loading, setLoading] = useState(false);

  const load = useCallback((p: number, entity: string, action: string) => {
    setLoading(true);
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
    const e = toFilter(entity);
    const a = toFilter(action);
    if (e) params.filter_entity = e;
    if (a) params.filter_action = a;
    api.audit.list(params)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(0, filterEntity, filterAction);
  }, []);

  const handleApply = () => load(0, filterEntity, filterAction);
  const handlePrev = () => load(page - 1, filterEntity, filterAction);
  const handleNext = () => load(page + 1, filterEntity, filterAction);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="mb-4 flex gap-4">
        <div className="w-48">
          <Label>Объект</Label>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все</SelectItem>
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
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все</SelectItem>
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
        <div className="flex items-end"><Button onClick={handleApply}>Применить</Button></div>
      </div>

      <DataTable columns={auditColumns} data={items} loading={loading} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button size="sm" onClick={handlePrev} disabled={page === 0}>Назад</Button>
          <span className="text-sm py-2">Стр. {page + 1} из {totalPages}</span>
          <Button size="sm" onClick={handleNext} disabled={(page + 1) * PAGE_SIZE >= total}>Вперёд</Button>
        </div>
      )}
    </>
  );
};

export default AdminAuditLog;