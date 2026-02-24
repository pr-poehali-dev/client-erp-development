import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ReconciliationReport, ReconciliationScheduleRow } from "@/lib/api";
import Icon from "@/components/ui/icon";

const fmt = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (d: string) => {
  if (!d) return "—";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
};

const statusLabel: Record<string, string> = {
  paid: "Оплачен",
  partial: "Частично",
  overdue: "Просрочен",
  pending: "Ожидается",
};
const statusVariant = (s: string): "default" | "destructive" | "warning" | "secondary" => {
  if (s === "paid") return "default";
  if (s === "overdue") return "destructive";
  if (s === "partial") return "warning";
  return "secondary";
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loanId: number;
  contractNo: string;
}

const LoanReconciliationReport = ({ open, onOpenChange, loanId, contractNo }: Props) => {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) {
      setReport(null);
      setExpandedRows(new Set());
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    api.loans.reconciliationReport(loanId)
      .then(setReport)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [open, loanId]);

  const toggleRow = (paymentNo: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(paymentNo)) { next.delete(paymentNo); } else { next.add(paymentNo); }
      return next;
    });
  };

  const exportToExcel = () => {
    if (!report) return;
    const { loan, schedule, summary: s } = report;
    const n = (v: number) => String(v).replace(".", ",");
    const d = (v: string) => { if (!v) return ""; const p = v.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : v; };
    const row = (cells: (string | number)[]) => cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";");

    const lines: string[] = [];
    lines.push(row(["Отчёт по сверке платежей"]));
    lines.push(row(["Договор", loan.contract_no]));
    lines.push(row(["Заёмщик", loan.member_name]));
    lines.push(row(["Сумма займа", n(loan.amount)]));
    lines.push(row(["Ставка", loan.rate + "%"]));
    lines.push(row(["Срок", loan.term_months + " мес."]));
    lines.push(row(["Начало", d(loan.start_date)]));
    lines.push(row(["Окончание", d(loan.end_date)]));
    lines.push(row([""]));
    lines.push(row(["ПЛАН VS ФАКТ"]));
    lines.push(row(["По плану", n(s.total_plan)]));
    lines.push(row(["Оплачено", n(s.total_paid)]));
    lines.push(row(["Разница", n(s.total_diff)]));
    lines.push(row(["Просроченный долг", n(s.total_overdue)]));
    lines.push(row([""]));

    lines.push(row(["№", "Плановая дата", "Сумма (план)", "ОД (план)", "% (план)", "Штраф (план)", "Оплачено", "Разница", "Статус", "Дата оплаты"]));
    for (const r of schedule) {
      const statusTxt = r.status === "paid" ? "Оплачен" : r.status === "partial" ? "Частично" : r.status === "overdue" ? "Просрочен" : "Ожидается";
      lines.push(row([r.payment_no, d(r.plan_date), n(r.plan_total), n(r.plan_principal), n(r.plan_interest), n(r.plan_penalty), n(r.paid_amount), n(r.plan_total - r.paid_amount), statusTxt, r.paid_date ? d(r.paid_date) : ""]));
    }
    lines.push(row(["ИТОГО", "", n(s.total_plan), "", "", "", n(s.total_paid), n(s.total_diff), "", ""]));
    lines.push(row([""]));

    lines.push(row(["РАСШИФРОВКА ПЛАТЕЖЕЙ ПО ПЕРИОДАМ"]));
    lines.push(row(["№ периода", "Плановая дата", "Дата платежа (факт)", "Засчитано", "ОД", "%", "Штраф"]));
    for (const r of schedule) {
      if (r.payments.length === 0) {
        lines.push(row([r.payment_no, d(r.plan_date), "—", "0", "0", "0", "0"]));
      } else {
        for (const p of r.payments) {
          lines.push(row([r.payment_no, d(r.plan_date), d(p.fact_date), n(p.amount), n(p.principal), n(p.interest), n(p.penalty)]));
        }
      }
    }

    const bom = "\uFEFF";
    const csv = bom + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Сверка_${loan.contract_no}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { summary } = report || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Icon name="FileSearch" size={18} />
              Сверка платежей — {contractNo}
            </DialogTitle>
            {report && (
              <Button size="sm" variant="outline" onClick={exportToExcel}>
                <Icon name="Download" size={14} className="mr-1" />Скачать CSV
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Icon name="Loader2" size={18} className="animate-spin" />
            Формирование отчёта...
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm py-4 text-center">{error}</div>
        )}

        {report && summary && (
          <div className="space-y-4">
            {/* Сводка */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground mb-1">По плану</div>
                  <div className="text-lg font-bold">{fmt(summary.total_plan)}</div>
                  <div className="text-xs text-muted-foreground">{summary.periods_total} периодов</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground mb-1">Фактически оплачено</div>
                  <div className="text-lg font-bold text-green-600">{fmt(summary.total_paid)}</div>
                  <div className="text-xs text-muted-foreground">{summary.periods_paid} оплачено</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground mb-1">Разница</div>
                  <div className={`text-lg font-bold ${summary.total_diff > 0 ? "text-red-600" : "text-green-600"}`}>
                    {summary.total_diff > 0 ? "−" : ""}{fmt(Math.abs(summary.total_diff))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {summary.periods_partial > 0 && `${summary.periods_partial} частично`}
                    {summary.periods_partial > 0 && summary.periods_overdue > 0 && ", "}
                    {summary.periods_overdue > 0 && `${summary.periods_overdue} просрочено`}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground mb-1">Просроченный долг</div>
                  <div className={`text-lg font-bold ${summary.total_overdue > 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmt(summary.total_overdue)}
                  </div>
                  <div className="text-xs text-muted-foreground">{summary.periods_pending} ожидается</div>
                </CardContent>
              </Card>
            </div>

            {/* Список периодов */}
            <div className="border rounded-lg overflow-hidden">
              {/* Заголовок */}
              <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_2rem] gap-0 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div className="px-3 py-2">№</div>
                <div className="px-3 py-2">Плановая дата</div>
                <div className="px-3 py-2 text-right">По плану</div>
                <div className="px-3 py-2 text-right hidden md:block">ОД / %</div>
                <div className="px-3 py-2 text-right">Оплачено</div>
                <div className="px-3 py-2 text-center">Статус</div>
                <div className="px-3 py-2"></div>
              </div>

              {report.schedule.map((row: ReconciliationScheduleRow) => {
                const diff = row.plan_total - row.paid_amount;
                const isExpanded = expandedRows.has(row.payment_no);
                const hasPayments = row.payments.length > 0;

                return (
                  <div key={row.payment_no} className="border-b last:border-b-0">
                    {/* Строка периода */}
                    <div
                      className={`grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_2rem] gap-0 text-sm transition-colors
                        ${hasPayments ? "cursor-pointer hover:bg-muted/30" : ""}
                        ${row.status === "overdue" ? "bg-red-50/50" : row.status === "partial" ? "bg-yellow-50/30" : ""}`}
                      onClick={() => hasPayments && toggleRow(row.payment_no)}
                    >
                      <div className="px-3 py-2 text-muted-foreground">{row.payment_no}</div>
                      <div className="px-3 py-2 font-medium">{fmtDate(row.plan_date)}</div>
                      <div className="px-3 py-2 text-right">{fmt(row.plan_total)}</div>
                      <div className="px-3 py-2 text-right hidden md:block text-muted-foreground text-xs">
                        <div>{fmt(row.plan_principal)}</div>
                        <div>{fmt(row.plan_interest)}</div>
                      </div>
                      <div className="px-3 py-2 text-right font-medium">
                        <div>{row.paid_amount > 0 ? fmt(row.paid_amount) : "—"}</div>
                        {Math.abs(diff) > 0.01 && (
                          <div className={`text-xs ${diff > 0.01 ? "text-red-600" : "text-green-600"}`}>
                            {diff > 0 ? "−" : "+"}{fmt(Math.abs(diff))}
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 flex items-center justify-center">
                        <Badge variant={statusVariant(row.status)} className="text-xs">
                          {statusLabel[row.status] || row.status}
                        </Badge>
                      </div>
                      <div className="px-3 py-2 flex items-center justify-center text-muted-foreground">
                        {hasPayments && (
                          <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} />
                        )}
                      </div>
                    </div>

                    {/* Детализация */}
                    {isExpanded && hasPayments && (
                      <div className="bg-muted/10 border-t px-4 py-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Платежи, закрывающие период №{row.payment_no}:
                        </div>
                        <div className="space-y-1">
                          <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground font-medium pb-1 border-b">
                            <div>Дата факт.</div>
                            <div className="text-right">Засчитано</div>
                            <div className="text-right">ОД</div>
                            <div className="text-right">%</div>
                            <div className="text-right">Штраф</div>
                          </div>
                          {row.payments.map((p, idx) => {
                            // Отклонение: сумма внесённого платежа vs засчитано в этот период
                            // (если платёж покрывал несколько периодов — суммы различаются)
                            const diffAmount = p.fact_amount - p.amount;
                            const hasDiff = Math.abs(diffAmount) > 0.01;
                            return (
                              <div key={idx}>
                                <div className="grid grid-cols-5 gap-2 text-xs py-1 border-b border-muted/40">
                                  <div className="font-medium">{fmtDate(p.fact_date)}</div>
                                  <div className="text-right font-semibold text-green-700">{fmt(p.amount)}</div>
                                  <div className="text-right">{fmt(p.principal)}</div>
                                  <div className="text-right">{fmt(p.interest)}</div>
                                  <div className="text-right">{p.penalty > 0 ? fmt(p.penalty) : "—"}</div>
                                </div>
                                {hasDiff && (
                                  <div className="grid grid-cols-5 gap-2 text-xs py-0.5 border-b border-dashed border-muted/40 italic text-muted-foreground">
                                    <div>внесено всего</div>
                                    <div className="text-right text-blue-600">{fmt(p.fact_amount)}</div>
                                    <div colSpan={3} className="text-right text-muted-foreground">остаток пошёл на др. периоды</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Итого */}
              <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_2rem] gap-0 bg-muted/50 border-t-2 text-sm font-semibold">
                <div className="px-3 py-2 col-span-2">Итого</div>
                <div className="px-3 py-2 text-right">{fmt(summary.total_plan)}</div>
                <div className="px-3 py-2 hidden md:block"></div>
                <div className="px-3 py-2 text-right text-green-700">{fmt(summary.total_paid)}</div>
                <div className={`px-3 py-2 text-center text-xs ${summary.total_diff > 0.01 ? "text-red-600" : "text-green-600"}`}>
                  {Math.abs(summary.total_diff) > 0.01 ? (summary.total_diff > 0 ? "−" : "+") + fmt(Math.abs(summary.total_diff)) : "✓"}
                </div>
                <div></div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Нажмите на строку периода чтобы увидеть какие платежи его закрывают
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoanReconciliationReport;