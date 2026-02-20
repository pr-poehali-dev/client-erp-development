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

const payTypeLabel: Record<string, string> = {
  regular: "Регулярный",
  early_partial: "Досрочный (частичный)",
  early_full: "Досрочный (полный)",
  manual: "Ручной",
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

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
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

    // Сводка
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

    // График
    lines.push(row(["№", "Плановая дата", "Сумма (план)", "ОД (план)", "% (план)", "Штраф (план)", "Оплачено", "Разница", "Статус", "Дата оплаты"]));
    for (const r of schedule) {
      const statusTxt = r.status === "paid" ? "Оплачен" : r.status === "partial" ? "Частично" : r.status === "overdue" ? "Просрочен" : "Ожидается";
      lines.push(row([r.payment_no, d(r.plan_date), n(r.plan_total), n(r.plan_principal), n(r.plan_interest), n(r.plan_penalty), n(r.paid_amount), n(r.plan_total - r.paid_amount), statusTxt, r.paid_date ? d(r.paid_date) : ""]));
    }
    lines.push(row(["ИТОГО", "", n(s.total_plan), "", "", "", n(s.total_paid), n(s.total_diff), "", ""]));
    lines.push(row([""]));

    // Расшифровка
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

            {/* Таблица */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">№</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Плановая дата</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Сумма по плану</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">ОД</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">%</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Оплачено</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Разница</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Статус</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {report.schedule.map((row: ReconciliationScheduleRow) => {
                    const diff = row.plan_total - row.paid_amount;
                    const isExpanded = expandedRows.has(row.id);
                    const hasPayments = row.payments.length > 0;
                    return (
                      <>
                        <tr
                          key={row.id}
                          className={`border-t transition-colors ${hasPayments ? "cursor-pointer hover:bg-muted/30" : ""} ${row.status === "overdue" ? "bg-red-50/50" : row.status === "partial" ? "bg-yellow-50/30" : ""}`}
                          onClick={() => hasPayments && toggleRow(row.id)}
                        >
                          <td className="px-3 py-2 text-muted-foreground">{row.payment_no}</td>
                          <td className="px-3 py-2 font-medium">{fmtDate(row.plan_date)}</td>
                          <td className="px-3 py-2 text-right">{fmt(row.plan_total)}</td>
                          <td className="px-3 py-2 text-right hidden md:table-cell text-muted-foreground">{fmt(row.plan_principal)}</td>
                          <td className="px-3 py-2 text-right hidden md:table-cell text-muted-foreground">{fmt(row.plan_interest)}</td>
                          <td className="px-3 py-2 text-right font-medium">{row.paid_amount > 0 ? fmt(row.paid_amount) : "—"}</td>
                          <td className={`px-3 py-2 text-right hidden md:table-cell font-medium ${diff > 0.01 ? "text-red-600" : diff < -0.01 ? "text-green-600" : "text-muted-foreground"}`}>
                            {Math.abs(diff) > 0.01 ? (diff > 0 ? "−" : "+") + fmt(Math.abs(diff)) : "0"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={statusVariant(row.status)} className="text-xs">
                              {statusLabel[row.status] || row.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground">
                            {hasPayments && (
                              <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} />
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasPayments && (
                          <tr key={`${row.id}-detail`} className="border-t bg-muted/20">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Платежи, закрывающие период №{row.payment_no}:</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left pb-1 pr-4">Дата факт.</th>
                                    <th className="text-right pb-1 pr-4">Засчитано</th>
                                    <th className="text-right pb-1 pr-4">ОД</th>
                                    <th className="text-right pb-1 pr-4">%</th>
                                    <th className="text-right pb-1">Штраф</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.payments.map((p, idx) => {
                                    const overpay = p.fact_amount - p.amount;
                                    return (
                                      <>
                                        <tr key={idx} className="border-t border-muted">
                                          <td className="py-1 pr-4 font-medium">{fmtDate(p.fact_date)}</td>
                                          <td className="py-1 pr-4 text-right font-semibold text-green-700">{fmt(p.amount)}</td>
                                          <td className="py-1 pr-4 text-right">{fmt(p.principal)}</td>
                                          <td className="py-1 pr-4 text-right">{fmt(p.interest)}</td>
                                          <td className="py-1 text-right">{p.penalty > 0 ? fmt(p.penalty) : "—"}</td>
                                        </tr>
                                        {p.fact_amount > 0 && (
                                          <tr key={`${idx}-fact`} className="border-t border-dashed border-muted/60 bg-muted/10">
                                            <td className="py-1 pr-4 text-muted-foreground italic">Итого внесено</td>
                                            <td className="py-1 pr-4 text-right font-semibold">{fmt(p.fact_amount)}</td>
                                            <td colSpan={2} className="py-1 pr-4 text-right text-muted-foreground text-xs">
                                              {Math.abs(overpay) > 0.005 && (overpay > 0
                                                ? <span className="text-green-600">переплата +{fmt(overpay)}</span>
                                                : <span className="text-red-600">недоплата −{fmt(Math.abs(overpay))}</span>
                                              )}
                                            </td>
                                            <td></td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/50 border-t-2">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-semibold">Итого</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(summary.total_plan)}</td>
                    <td className="px-3 py-2 hidden md:table-cell"></td>
                    <td className="px-3 py-2 hidden md:table-cell"></td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(summary.total_paid)}</td>
                    <td className={`px-3 py-2 text-right font-semibold hidden md:table-cell ${summary.total_diff > 0.01 ? "text-red-600" : "text-green-600"}`}>
                      {Math.abs(summary.total_diff) > 0.01 ? (summary.total_diff > 0 ? "−" : "+") + fmt(Math.abs(summary.total_diff)) : "0"}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
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