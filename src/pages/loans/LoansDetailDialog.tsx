import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import DataTable, { Column } from "@/components/ui/data-table";
import { LoanDetail, LoanPayment, ScheduleItem } from "@/lib/api";
import LoanReconciliationReport from "./LoanReconciliationReport";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

const statusLabel: Record<string, string> = { active: "Активен", overdue: "Просрочен", closed: "Закрыт", pending: "Ожидается", paid: "Оплачен", partial: "Частично оплачен" };
const statusVariant = (s: string) => {
  if (s === "active" || s === "paid") return "default";
  if (s === "overdue") return "destructive";
  if (s === "partial") return "warning";
  return "secondary";
};

interface LoansDetailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: LoanDetail | null;
  isAdmin: boolean;
  isManager: boolean;
  onPayment: () => void;
  onEarlyRepay: () => void;
  onModify: () => void;
  onEditPayment: (p: LoanPayment) => void;
  onDeletePayment: (id: number) => void;
  onDeleteContract: () => void;
  onRebuildSchedule: () => void;
  onCheckStatus: () => void;
  onRecalcStatuses: () => void;
}

const LoansDetailDialog = (props: LoansDetailDialogProps) => {
  const { open, onOpenChange, detail, isAdmin, isManager } = props;
  const [reconciliationOpen, setReconciliationOpen] = useState(false);

  if (!detail) return null;

  const scheduleCols: Column<ScheduleItem>[] = [
    { key: "period_no", label: "№" },
    { key: "payment_date", label: "Дата", render: (s: ScheduleItem) => fmtDate(s.payment_date) },
    { key: "payment_amount", label: "Платёж", render: (s: ScheduleItem) => fmt(s.payment_amount) },
    { key: "principal_amount", label: "Осн. долг", render: (s: ScheduleItem) => fmt(s.principal_amount) },
    { key: "interest_amount", label: "Проценты", render: (s: ScheduleItem) => fmt(s.interest_amount) },
    { key: "balance_after", label: "Остаток", render: (s: ScheduleItem) => fmt(s.balance_after) },
    { key: "status", label: "Статус", render: (s: ScheduleItem) => {
      const debt = (s.status === "partial" || s.status === "overdue") ? s.payment_amount - (s.paid_amount ?? 0) : 0;
      return (
        <div className="flex flex-col gap-0.5">
          <Badge variant={statusVariant(s.status) as "default"|"destructive"|"secondary"|"warning"} className="text-xs w-fit">{statusLabel[s.status] || s.status}</Badge>
          {debt > 0.01 && <span className="text-xs text-red-500 font-medium">−{fmt(debt)}</span>}
        </div>
      );
    }},
  ];

  const paymentCols: Column<LoanPayment>[] = [
    { key: "payment_date", label: "Дата", render: (p: LoanPayment) => fmtDate(p.payment_date) },
    { key: "amount", label: "Сумма", render: (p: LoanPayment) => fmt(p.amount) },
    { key: "principal_part", label: "Осн. долг", render: (p: LoanPayment) => fmt(p.principal_part) },
    { key: "interest_part", label: "Проценты", render: (p: LoanPayment) => fmt(p.interest_part) },
    { key: "penalty_part", label: "Штрафы", render: (p: LoanPayment) => p.penalty_part > 0 ? fmt(p.penalty_part) : "—" },
    { key: "description", label: "Примечание", render: (p: LoanPayment) => <span className="text-xs text-muted-foreground">{p.description || "—"}</span> },
    { key: "id", label: "", render: (p: LoanPayment) => (isAdmin || isManager) ? (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => props.onEditPayment(p)} className="p-1 rounded hover:bg-muted"><Icon name="Pencil" size={14} /></button>
        {isAdmin && <button onClick={() => props.onDeletePayment(p.id)} className="p-1 rounded hover:bg-muted text-red-600"><Icon name="Trash2" size={14} /></button>}
      </div>
    ) : null }
  ];

  return (
    <>
    <LoanReconciliationReport
      open={reconciliationOpen}
      onOpenChange={setReconciliationOpen}
      loanId={detail.id}
      contractNo={detail.contract_no}
    />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div>
            <DialogTitle>{detail.contract_no}</DialogTitle>
            <div className="text-sm text-muted-foreground mt-1">{detail.member_name}</div>
          </div>
          <Badge variant={statusVariant(detail.status) as "default"|"destructive"|"secondary"|"warning"}>{statusLabel[detail.status] || detail.status}</Badge>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Сумма займа</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(detail.amount)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Остаток</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(detail.balance)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ежемесячный платёж</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(detail.monthly_payment)}</div></CardContent></Card>
        </div>

        <div className="grid md:grid-cols-4 gap-2 text-sm">
          <div><span className="text-muted-foreground">Ставка:</span> <span className="font-medium">{detail.rate}%</span></div>
          <div><span className="text-muted-foreground">Срок:</span> <span className="font-medium">{detail.term_months} мес.</span></div>
          <div><span className="text-muted-foreground">Начало:</span> <span className="font-medium">{fmtDate(detail.start_date)}</span></div>
          <div><span className="text-muted-foreground">Окончание:</span> <span className="font-medium">{fmtDate(detail.end_date)}</span></div>
        </div>

        {(isAdmin || isManager) && (
          <div className="flex flex-wrap gap-2 justify-between">
            {(detail.status === "active" || detail.status === "overdue") && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={props.onPayment}><Icon name="DollarSign" size={14} className="mr-1" />Внести платёж</Button>
                <Button size="sm" onClick={props.onEarlyRepay}><Icon name="Zap" size={14} className="mr-1" />Досрочное погашение</Button>
                <Button size="sm" onClick={props.onModify}><Icon name="Settings" size={14} className="mr-1" />Изменить условия</Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setReconciliationOpen(true)}>
                <Icon name="FileSearch" size={14} className="mr-1" />Сверка платежей
              </Button>
              {isAdmin && <>
                <Button size="sm" variant="outline" onClick={props.onRecalcStatuses}><Icon name="RotateCw" size={14} className="mr-1" />Пересчитать статусы</Button>
                <Button size="sm" variant="outline" onClick={props.onCheckStatus}><Icon name="Bug" size={14} className="mr-1" />Проверить статусы</Button>
                <Button size="sm" variant="outline" onClick={props.onRebuildSchedule}><Icon name="RefreshCw" size={14} className="mr-1" />Пересоздать график</Button>
                <Button size="sm" variant="destructive" onClick={props.onDeleteContract}><Icon name="Trash2" size={14} className="mr-1" />Удалить договор</Button>
              </>}
            </div>
          </div>
        )}

        <Tabs defaultValue="schedule">
          <TabsList>
            <TabsTrigger value="schedule">График</TabsTrigger>
            <TabsTrigger value="payments">Платежи</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <DataTable columns={scheduleCols} data={detail.schedule || []} />
          </TabsContent>

          <TabsContent value="payments">
            <DataTable columns={paymentCols} data={detail.payments || []} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default LoansDetailDialog;