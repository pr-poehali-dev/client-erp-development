import { useState, useEffect } from "react";
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
import api, { Loan, LoanDetail, LoanPayment, Member, ScheduleItem, Organization } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

const statusLabel: Record<string, string> = { active: "Активен", overdue: "Просрочен", closed: "Закрыт", pending: "Ожидается", paid: "Оплачен", partial: "Частично" };
const statusVariant = (s: string) => {
  if (s === "active" || s === "paid") return "default";
  if (s === "overdue") return "destructive";
  return "secondary";
};

const columns: Column<Loan>[] = [
  { key: "contract_no", label: "Договор", className: "font-medium" },
  { key: "member_name", label: "Пайщик" },
  { key: "org_name", label: "Организация", render: (i: Loan) => <span className="text-xs text-muted-foreground">{i.org_short_name || i.org_name || "—"}</span> },
  { key: "amount", label: "Сумма", render: (i: Loan) => fmt(i.amount) },
  { key: "rate", label: "Ставка", render: (i: Loan) => i.rate + "%" },
  { key: "term_months", label: "Срок", render: (i: Loan) => i.term_months + " мес." },
  { key: "monthly_payment", label: "Платёж", render: (i: Loan) => fmt(i.monthly_payment) },
  { key: "balance", label: "Остаток", render: (i: Loan) => fmt(i.balance) },
  { key: "schedule_type", label: "График", render: (i: Loan) => <span className="text-xs">{i.schedule_type === "annuity" ? "Аннуитет" : "В конце срока"}</span> },
  { key: "status", label: "Статус", render: (i: Loan) => <Badge variant={statusVariant(i.status) as "default"|"destructive"|"secondary"} className="text-xs">{statusLabel[i.status] || i.status}</Badge> },
  { key: "id", label: "", render: (i: Loan) => (
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      <button className="p-1 rounded hover:bg-muted" title="Excel" onClick={() => api.export.download("loan", i.id, "xlsx")}><Icon name="FileSpreadsheet" size={14} className="text-green-600" /></button>
      <button className="p-1 rounded hover:bg-muted" title="PDF" onClick={() => api.export.download("loan", i.id, "pdf")}><Icon name="FileText" size={14} className="text-red-500" /></button>
    </div>
  )},
];

const Loans = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showEarly, setShowEarly] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [form, setForm] = useState({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", schedule_type: "annuity", start_date: new Date().toISOString().slice(0, 10), org_id: "" });
  const [preview, setPreview] = useState<ScheduleItem[] | null>(null);
  const [previewMonthly, setPreviewMonthly] = useState(0);
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });
  const [earlyForm, setEarlyForm] = useState({ amount: "", repayment_type: "reduce_term", date: new Date().toISOString().slice(0, 10) });
  const [earlyPreview, setEarlyPreview] = useState<ScheduleItem[] | null>(null);
  const [earlyMonthly, setEarlyMonthly] = useState(0);
  const [modifyForm, setModifyForm] = useState({ new_rate: "", new_term: "" });
  const [modifyPreview, setModifyPreview] = useState<ScheduleItem[] | null>(null);
  const [modifyMonthly, setModifyMonthly] = useState(0);
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [editPayForm, setEditPayForm] = useState({ payment_id: 0, payment_date: "", amount: "", principal_part: "", interest_part: "", penalty_part: "" });
  const [showOverpayChoice, setShowOverpayChoice] = useState(false);
  const [overpayOptions, setOverpayOptions] = useState<Record<string, { new_monthly: number; new_term: number; description: string }>>({});
  const [overpayInfo, setOverpayInfo] = useState({ overpay_amount: 0, current_payment: 0, total_amount: 0 });

  const load = () => {
    setLoading(true);
    Promise.all([api.loans.list(), api.members.list()]).then(([l, m]) => { setLoans(l); setMembers(m); }).finally(() => setLoading(false));
    api.organizations.list().then(setOrgs).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filtered = loans.filter(l => l.contract_no?.toLowerCase().includes(search.toLowerCase()) || l.member_name?.toLowerCase().includes(search.toLowerCase()));

  const handleCalc = async () => {
    if (!form.amount || !form.rate || !form.term_months) return;
    const res = await api.loans.calcSchedule(Number(form.amount), Number(form.rate), Number(form.term_months), form.schedule_type, form.start_date);
    setPreview(res.schedule);
    setPreviewMonthly(res.monthly_payment);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.loans.create({
        contract_no: form.contract_no, member_id: Number(form.member_id),
        amount: Number(form.amount), rate: Number(form.rate), term_months: Number(form.term_months),
        schedule_type: form.schedule_type, start_date: form.start_date,
        org_id: form.org_id ? Number(form.org_id) : undefined,
      });
      toast({ title: "Договор займа создан" });
      setShowForm(false);
      setPreview(null);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (loan: Loan) => {
    const d = await api.loans.get(loan.id);
    setDetail(d);
    setShowDetail(true);
  };

  const handlePayment = async (strategy?: string) => {
    if (!detail || !payForm.amount) return;
    setSaving(true);
    try {
      const res = await api.loans.payment({
        loan_id: detail.id, payment_date: payForm.date,
        amount: Number(payForm.amount), overpay_strategy: strategy,
      });
      if (res.needs_choice && res.options) {
        setOverpayOptions(res.options);
        setOverpayInfo({
          overpay_amount: res.overpay_amount || 0,
          current_payment: res.current_payment || 0,
          total_amount: res.total_amount || 0,
        });
        setShowPayment(false);
        setShowOverpayChoice(true);
        return;
      }
      const parts = [`Осн. долг: ${fmt(res.principal_part || 0)}`, `Проценты: ${fmt(res.interest_part || 0)}`];
      if ((res.penalty_part || 0) > 0) parts.push(`Штрафы: ${fmt(res.penalty_part || 0)}`);
      let title = "Платёж внесён";
      if (res.new_balance === 0) {
        title = "Займ полностью погашен";
      } else if (res.schedule_recalculated && res.auto_recalculated) {
        title = "Платёж внесён, проценты пересчитаны";
        parts.push(`Новый платёж: ${fmt(res.new_monthly || 0)}`);
      } else if (res.schedule_recalculated) {
        title = "Платёж внесён, график пересчитан";
        parts.push(`Новый платёж: ${fmt(res.new_monthly || 0)}`);
      }
      toast({ title, description: parts.join(" · ") });
      setShowPayment(false);
      setShowOverpayChoice(false);
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEarlyPreview = async () => {
    if (!detail || !earlyForm.amount) return;
    const newBalance = detail.balance - Number(earlyForm.amount);
    if (newBalance <= 0) {
      setEarlyPreview(null);
      setEarlyMonthly(0);
      return;
    }
    const remainingPeriods = detail.schedule.filter(s => s.status !== "paid").length;
    let remainingTerm: number;
    if (earlyForm.repayment_type === "reduce_payment") {
      remainingTerm = Math.max(remainingPeriods, 1);
    } else {
      if (detail.monthly_payment > 0) {
        let bestTerm = Math.max(remainingPeriods, 1);
        for (let t = 1; t <= remainingPeriods; t++) {
          try {
            const test = await api.loans.calcSchedule(newBalance, detail.rate, t, detail.schedule_type, earlyForm.date);
            if (test.monthly_payment >= detail.monthly_payment * 0.9) {
              bestTerm = t;
              break;
            }
          } catch { break; }
        }
        remainingTerm = Math.max(bestTerm, 1);
      } else {
        remainingTerm = Math.max(remainingPeriods, 1);
      }
    }
    const res = await api.loans.calcSchedule(newBalance, detail.rate, remainingTerm, detail.schedule_type, earlyForm.date);
    setEarlyPreview(res.schedule);
    setEarlyMonthly(res.monthly_payment);
  };

  const handleEarlyRepayment = async () => {
    if (!detail || !earlyForm.amount) return;
    setSaving(true);
    try {
      await api.loans.earlyRepayment({
        loan_id: detail.id, amount: Number(earlyForm.amount),
        repayment_type: earlyForm.repayment_type, payment_date: earlyForm.date,
      });
      const isFullClose = Number(earlyForm.amount) >= detail.balance;
      toast({ title: isFullClose ? "Займ полностью погашен" : "Досрочное погашение проведено" });
      setShowEarly(false);
      setEarlyPreview(null);
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleModifyPreview = async () => {
    if (!detail) return;
    const rate = modifyForm.new_rate ? Number(modifyForm.new_rate) : detail.rate;
    const term = modifyForm.new_term ? Number(modifyForm.new_term) : detail.term_months;
    const res = await api.loans.calcSchedule(detail.balance, rate, term, detail.schedule_type, new Date().toISOString().slice(0, 10));
    setModifyPreview(res.schedule);
    setModifyMonthly(res.monthly_payment);
  };

  const handleModify = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.loans.modify({
        loan_id: detail.id,
        new_rate: modifyForm.new_rate ? Number(modifyForm.new_rate) : undefined,
        new_term: modifyForm.new_term ? Number(modifyForm.new_term) : undefined,
      });
      toast({ title: "Параметры договора изменены" });
      setShowModify(false);
      setModifyPreview(null);
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEditPayment = (p: LoanPayment) => {
    setEditPayForm({
      payment_id: p.id,
      payment_date: p.payment_date,
      amount: String(p.amount),
      principal_part: String(p.principal_part),
      interest_part: String(p.interest_part),
      penalty_part: String(p.penalty_part),
    });
    setShowEditPayment(true);
  };

  const handleUpdatePayment = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.loans.updatePayment({
        payment_id: editPayForm.payment_id,
        payment_date: editPayForm.payment_date,
        amount: Number(editPayForm.amount),
        principal_part: Number(editPayForm.principal_part),
        interest_part: Number(editPayForm.interest_part),
        penalty_part: Number(editPayForm.penalty_part),
      });
      toast({ title: "Платёж обновлён" });
      setShowEditPayment(false);
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (p: LoanPayment) => {
    if (!detail || !confirm(`Удалить платёж от ${fmtDate(p.payment_date)} на сумму ${fmt(p.amount)}?`)) return;
    try {
      await api.loans.deletePayment(p.id);
      toast({ title: "Платёж удалён" });
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const handleDeleteContract = async () => {
    if (!detail || !confirm(`УДАЛИТЬ договор ${detail.contract_no} со всеми платежами и графиком? Это действие необратимо!`)) return;
    setSaving(true);
    try {
      await api.loans.deleteContract(detail.id);
      toast({ title: "Договор удалён" });
      setShowDetail(false);
      setDetail(null);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllPayments = async () => {
    if (!detail || !confirm(`Удалить ВСЕ платежи по договору ${detail.contract_no} и сбросить остаток? Это действие необратимо!`)) return;
    setSaving(true);
    try {
      await api.loans.deleteAllPayments(detail.id);
      toast({ title: "Все платежи удалены, остаток восстановлен" });
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFixSchedule = async () => {
    if (!detail || !confirm(`Исправить график по договору ${detail.contract_no}? Будут удалены дубли и пересчитаны статусы.`)) return;
    setSaving(true);
    try {
      const res = await api.loans.fixSchedule(detail.id);
      toast({ title: "График исправлен", description: `Удалено дублей: ${res.removed_duplicates}, баланс: ${res.new_balance.toLocaleString("ru")} ₽` });
      const d = await api.loans.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Icon name="Loader2" size={32} className="animate-spin text-primary" /></div>;

  const totalPortfolio = loans.filter(l => l.status === "active").reduce((s, l) => s + l.balance, 0);
  const avgRate = loans.length ? loans.reduce((s, l) => s + l.rate, 0) / loans.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Займы" description={`${loans.filter(l => l.status === "active").length} активных из ${loans.length} договоров`} actionLabel="Новый договор" actionIcon="Plus" onAction={() => { setForm({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", schedule_type: "annuity", start_date: new Date().toISOString().slice(0, 10), org_id: "" }); setPreview(null); setShowForm(true); }} />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Портфель займов</div><div className="text-xl font-bold">{fmt(totalPortfolio)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Средняя ставка</div><div className="text-xl font-bold">{avgRate.toFixed(1)}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Просроченных</div><div className="text-xl font-bold text-destructive">{loans.filter(l => l.status === "overdue").length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Всего договоров</div><div className="text-xl font-bold">{loans.length}</div></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по договору, пайщику..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={openDetail} emptyMessage="Договоры не найдены. Создайте первый договор займа." />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Новый договор займа</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Организация *</Label>
              <Select value={String(form.org_id || "")} onValueChange={v => setForm(p => ({ ...p, org_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите организацию" /></SelectTrigger>
                <SelectContent>
                  {orgs.map(o => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.short_name || o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Пайщик *</Label>
              <MemberSearch members={members} value={form.member_id} onChange={(id) => setForm(p => ({ ...p, member_id: id }))} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Номер договора *</Label><Input value={form.contract_no} onChange={e => setForm(p => ({ ...p, contract_no: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Сумма займа, ₽ *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ставка, % годовых *</Label><Input type="number" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Срок, месяцев *</Label><Input type="number" value={form.term_months} onChange={e => setForm(p => ({ ...p, term_months: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Вариант графика</Label>
                <Select value={form.schedule_type} onValueChange={v => setForm(p => ({ ...p, schedule_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annuity">Аннуитет</SelectItem>
                    <SelectItem value="end_of_term">В конце срока</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Дата начала</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
            </div>

            <Button variant="outline" onClick={handleCalc} className="gap-2"><Icon name="Calculator" size={16} />Рассчитать график</Button>

            {preview && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ежемесячный платёж: {fmt(previewMonthly)}</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2">№</th><th className="text-left py-2 px-2">Дата</th>
                        <th className="text-right py-2 px-2">Платёж</th><th className="text-right py-2 px-2">Осн. долг</th>
                        <th className="text-right py-2 px-2">Проценты</th><th className="text-right py-2 px-2">Остаток</th>
                      </tr></thead>
                      <tbody>{preview.map(r => (
                        <tr key={r.payment_no} className="border-b last:border-0">
                          <td className="py-1.5 px-2">{r.payment_no}</td><td className="py-1.5 px-2">{fmtDate(r.payment_date)}</td>
                          <td className="py-1.5 px-2 text-right font-medium">{fmt(r.payment_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.principal_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.interest_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.balance_after)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button onClick={handleCreate} disabled={saving || !form.contract_no || !form.member_id || !form.amount} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
                Сохранить договор
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Договор {detail?.contract_no}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-6">
              <div className="grid grid-cols-5 gap-4">
                <div><div className="text-xs text-muted-foreground">Пайщик</div><div className="text-sm font-medium">{detail.member_name}</div></div>
                <div><div className="text-xs text-muted-foreground">Сумма</div><div className="text-sm font-medium">{fmt(detail.amount)}</div></div>
                <div><div className="text-xs text-muted-foreground">Ставка</div><div className="text-sm font-medium">{detail.rate}%</div></div>
                <div><div className="text-xs text-muted-foreground">Срок</div><div className="text-sm font-medium">{detail.term_months} мес.</div></div>
                <div><div className="text-xs text-muted-foreground">Остаток</div><div className="text-sm font-bold text-primary">{fmt(detail.balance)}</div></div>
              </div>

              <Tabs defaultValue="schedule">
                <TabsList>
                  <TabsTrigger value="schedule">График платежей</TabsTrigger>
                  <TabsTrigger value="payments">История платежей</TabsTrigger>
                  <TabsTrigger value="actions">Действия</TabsTrigger>
                </TabsList>

                <TabsContent value="schedule" className="mt-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2 px-2">№</th><th className="text-left py-2 px-2">Дата</th>
                            <th className="text-right py-2 px-2">Платёж</th><th className="text-right py-2 px-2">Осн. долг</th>
                            <th className="text-right py-2 px-2">Проценты</th><th className="text-right py-2 px-2">Пени</th>
                            <th className="text-right py-2 px-2">Остаток</th>
                            <th className="text-center py-2 px-2">Статус</th>
                          </tr></thead>
                          <tbody>{detail.schedule.map(r => (
                            <tr key={r.payment_no} className={`border-b last:border-0 hover:bg-muted/30 ${r.status === "overdue" ? "bg-red-50" : ""}`}>
                              <td className="py-2 px-2">{r.payment_no}</td><td className="py-2 px-2">{fmtDate(r.payment_date)}</td>
                              <td className="py-2 px-2 text-right font-medium">{fmt(r.payment_amount)}</td>
                              <td className="py-2 px-2 text-right">{fmt(r.principal_amount)}</td>
                              <td className="py-2 px-2 text-right">{fmt(r.interest_amount)}</td>
                              <td className={`py-2 px-2 text-right ${(r.penalty_amount || 0) > 0 ? "text-red-600 font-medium" : ""}`}>{fmt(r.penalty_amount || 0)}</td>
                              <td className="py-2 px-2 text-right">{fmt(r.balance_after)}</td>
                              <td className="py-2 px-2 text-center">
                                <Badge variant={statusVariant(r.status || "pending") as "default"|"destructive"|"secondary"} className="text-xs">{statusLabel[r.status || "pending"] || r.status}</Badge>
                              </td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  {detail.payments.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground text-sm">Платежей пока нет</Card>
                  ) : (
                    <Card><CardContent className="pt-4">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 px-2">Дата</th><th className="text-right py-2 px-2">Сумма</th>
                          <th className="text-right py-2 px-2">Осн. долг</th><th className="text-right py-2 px-2">Проценты</th>
                          <th className="text-right py-2 px-2">Штрафы</th><th className="text-left py-2 px-2">Тип</th>
                          <th className="text-center py-2 px-2 w-20"></th>
                        </tr></thead>
                        <tbody>{detail.payments.map(p => (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2">{fmtDate(p.payment_date)}</td>
                            <td className="py-2 px-2 text-right font-medium">{fmt(p.amount)}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.principal_part)}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.interest_part)}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.penalty_part)}</td>
                            <td className="py-2 px-2 text-xs">{p.payment_type === "regular" ? "Обычный" : p.payment_type === "early_full" ? "Досрочное полное" : p.payment_type === "early_partial" ? "Досрочное частичное" : p.payment_type}</td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <button className="p-1 rounded hover:bg-muted" title="Редактировать" onClick={() => openEditPayment(p)}><Icon name="Pencil" size={14} className="text-muted-foreground" /></button>
                                <button className="p-1 rounded hover:bg-destructive/10" title="Удалить" onClick={() => handleDeletePayment(p)}><Icon name="Trash2" size={14} className="text-destructive/70" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status === "closed"} onClick={() => { setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10) }); setShowPayment(true); }}>
                      <div className="flex items-center gap-2"><Icon name="CreditCard" size={16} /><span className="font-medium text-sm">Внести платёж</span></div>
                      <span className="text-xs text-muted-foreground">Указать дату и сумму платежа</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status === "closed"} onClick={() => { setEarlyForm({ amount: "", repayment_type: "reduce_term", date: new Date().toISOString().slice(0, 10) }); setEarlyPreview(null); setShowEarly(true); }}>
                      <div className="flex items-center gap-2"><Icon name="FastForward" size={16} /><span className="font-medium text-sm">Досрочное погашение</span></div>
                      <span className="text-xs text-muted-foreground">Частичное или полное, с пересчётом графика</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status === "closed"} onClick={() => { setModifyForm({ new_rate: String(detail.rate), new_term: String(detail.term_months) }); setModifyPreview(null); setShowModify(true); }}>
                      <div className="flex items-center gap-2"><Icon name="Settings2" size={16} /><span className="font-medium text-sm">Изменить параметры</span></div>
                      <span className="text-xs text-muted-foreground">Срок, ставка, перерасчёт графика</span>
                    </Button>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" onClick={() => { api.export.download("loan", detail.id, "xlsx"); toast({ title: "Формируется Excel-выписка..." }); }}>
                        <div className="flex items-center gap-2"><Icon name="FileSpreadsheet" size={16} /><span className="font-medium text-sm">Выписка Excel</span></div>
                        <span className="text-xs text-muted-foreground">Скачать .xlsx с графиком и платежами</span>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" onClick={() => { api.export.download("loan", detail.id, "pdf"); toast({ title: "Формируется PDF-выписка..." }); }}>
                        <div className="flex items-center gap-2"><Icon name="FileText" size={16} /><span className="font-medium text-sm">Выписка PDF</span></div>
                        <span className="text-xs text-muted-foreground">Скачать .pdf для печати</span>
                      </Button>
                    </div>
                    {isAdmin && detail.payments.length > 0 && (
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handleDeleteAllPayments} disabled={saving}>
                        <div className="flex items-center gap-2"><Icon name="Eraser" size={16} /><span className="font-medium text-sm">Удалить все платежи</span></div>
                        <span className="text-xs text-muted-foreground">Сбросить историю платежей и восстановить остаток</span>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={handleFixSchedule} disabled={saving}>
                        <div className="flex items-center gap-2"><Icon name="Wrench" size={16} /><span className="font-medium text-sm">Исправить график</span></div>
                        <span className="text-xs text-muted-foreground">Удалить дубли и пересчитать статусы платежей</span>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1 border-destructive/50 text-destructive hover:bg-destructive/5" onClick={handleDeleteContract} disabled={saving}>
                        <div className="flex items-center gap-2"><Icon name="Trash2" size={16} /><span className="font-medium text-sm">Удалить договор</span></div>
                        <span className="text-xs text-muted-foreground">Полностью удалить договор со всеми данными</span>
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Внести платёж</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Текущий остаток:</span>
                  <span className="font-semibold">{fmt(detail.balance)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Ежемесячный платёж:</span>
                  <span className="font-medium">{fmt(detail.monthly_payment)}</span>
                </div>
              </Card>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Дата платежа</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма, ₽</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} placeholder={detail ? String(Math.round(detail.monthly_payment)) : ""} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPayment(false)}>Отмена</Button>
              <Button onClick={() => handlePayment()} disabled={saving || !payForm.amount} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Check" size={16} />}
                Провести
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOverpayChoice} onOpenChange={v => { if (!v) setShowOverpayChoice(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Icon name="AlertTriangle" size={20} className="text-amber-500" />Переплата по платежу</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p>Сумма платежа <span className="font-semibold">{fmt(overpayInfo.total_amount)}</span> превышает текущий платёж по графику <span className="font-semibold">{fmt(overpayInfo.current_payment)}</span>.</p>
              <p>Переплата: <span className="font-semibold text-amber-600">{fmt(overpayInfo.overpay_amount)}</span></p>
            </div>
            <p className="text-sm text-muted-foreground">Выберите, как распорядиться переплатой:</p>
            <div className="space-y-2">
              {overpayOptions.reduce_payment && (
                <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => handlePayment("reduce_payment")} disabled={saving}>
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2"><Icon name="ArrowDown" size={14} />Уменьшить платёж</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Новый платёж: {fmt(overpayOptions.reduce_payment.new_monthly)}, срок: {overpayOptions.reduce_payment.new_term} мес.</div>
                  </div>
                </Button>
              )}
              {overpayOptions.reduce_term && (
                <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => handlePayment("reduce_term")} disabled={saving}>
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2"><Icon name="Clock" size={14} />Сократить срок</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Новый платёж: {fmt(overpayOptions.reduce_term.new_monthly)}, срок: {overpayOptions.reduce_term.new_term} мес.</div>
                  </div>
                </Button>
              )}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => { setShowOverpayChoice(false); setShowPayment(true); }}>
              <Icon name="ArrowLeft" size={14} className="mr-2" />Назад
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEarly} onOpenChange={v => { setShowEarly(v); if (!v) setEarlyPreview(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Досрочное погашение</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Договор:</span> <span className="font-semibold">{detail.contract_no}</span></div>
                  <div><span className="text-muted-foreground">Остаток:</span> <span className="font-semibold text-primary">{fmt(detail.balance)}</span></div>
                  <div><span className="text-muted-foreground">Платёж:</span> <span className="font-medium">{fmt(detail.monthly_payment)}</span></div>
                </div>
              </Card>
            )}

            <div className="space-y-1.5"><Label className="text-xs">Дата погашения</Label><Input type="date" value={earlyForm.date} onChange={e => setEarlyForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Сумма досрочного погашения, ₽</Label>
              <Input type="number" value={earlyForm.amount} onChange={e => setEarlyForm(p => ({ ...p, amount: e.target.value }))} placeholder={detail ? String(Math.round(detail.balance)) : ""} />
              {detail && earlyForm.amount && Number(earlyForm.amount) >= detail.balance && (
                <p className="text-xs text-success font-medium flex items-center gap-1"><Icon name="CheckCircle" size={12} />Полное погашение займа</p>
              )}
              {detail && earlyForm.amount && Number(earlyForm.amount) < detail.balance && (
                <p className="text-xs text-muted-foreground">Новый остаток: {fmt(detail.balance - Number(earlyForm.amount))}</p>
              )}
            </div>

            {detail && earlyForm.amount && Number(earlyForm.amount) < detail.balance && (
              <div className="space-y-1.5">
                <Label className="text-xs">Вариант пересчёта</Label>
                <Select value={earlyForm.repayment_type} onValueChange={v => setEarlyForm(p => ({ ...p, repayment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reduce_term">
                      <div className="flex flex-col"><span>Сократить срок</span><span className="text-xs text-muted-foreground">Платёж останется прежним</span></div>
                    </SelectItem>
                    <SelectItem value="reduce_payment">
                      <div className="flex flex-col"><span>Уменьшить платёж</span><span className="text-xs text-muted-foreground">Срок останется прежним</span></div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {detail && earlyForm.amount && Number(earlyForm.amount) < detail.balance && (
              <Button variant="outline" onClick={handleEarlyPreview} className="gap-2"><Icon name="Calculator" size={16} />Рассчитать новый график</Button>
            )}

            {earlyPreview && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Новый график: платёж {fmt(earlyMonthly)}, {earlyPreview.length} мес.</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2">№</th><th className="text-left py-2 px-2">Дата</th>
                        <th className="text-right py-2 px-2">Платёж</th><th className="text-right py-2 px-2">Осн. долг</th>
                        <th className="text-right py-2 px-2">Проценты</th><th className="text-right py-2 px-2">Остаток</th>
                      </tr></thead>
                      <tbody>{earlyPreview.map(r => (
                        <tr key={r.payment_no} className="border-b last:border-0">
                          <td className="py-1.5 px-2">{r.payment_no}</td><td className="py-1.5 px-2">{fmtDate(r.payment_date)}</td>
                          <td className="py-1.5 px-2 text-right font-medium">{fmt(r.payment_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.principal_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.interest_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.balance_after)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEarly(false)}>Отмена</Button>
              <Button onClick={handleEarlyRepayment} disabled={saving || !earlyForm.amount} className="gap-2" variant={detail && earlyForm.amount && Number(earlyForm.amount) >= detail.balance ? "default" : "default"}>
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Check" size={16} />}
                {detail && earlyForm.amount && Number(earlyForm.amount) >= detail.balance ? "Полностью погасить" : "Провести досрочное погашение"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showModify} onOpenChange={v => { setShowModify(v); if (!v) setModifyPreview(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Изменение параметров договора</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Договор:</span> <span className="font-semibold">{detail.contract_no}</span></div>
                  <div><span className="text-muted-foreground">Остаток:</span> <span className="font-semibold text-primary">{fmt(detail.balance)}</span></div>
                  <div><span className="text-muted-foreground">Текущая ставка:</span> <span className="font-medium">{detail.rate}%</span></div>
                  <div><span className="text-muted-foreground">Текущий срок:</span> <span className="font-medium">{detail.term_months} мес.</span></div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Новая ставка, % годовых</Label>
                <Input type="number" step="0.1" value={modifyForm.new_rate} onChange={e => setModifyForm(p => ({ ...p, new_rate: e.target.value }))} />
                {detail && modifyForm.new_rate && Number(modifyForm.new_rate) !== detail.rate && (
                  <p className="text-xs text-muted-foreground">
                    {Number(modifyForm.new_rate) < detail.rate ? "↓" : "↑"} Изменение с {detail.rate}% на {modifyForm.new_rate}%
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Новый срок, месяцев</Label>
                <Input type="number" value={modifyForm.new_term} onChange={e => setModifyForm(p => ({ ...p, new_term: e.target.value }))} />
                {detail && modifyForm.new_term && Number(modifyForm.new_term) !== detail.term_months && (
                  <p className="text-xs text-muted-foreground">
                    Изменение с {detail.term_months} на {modifyForm.new_term} мес.
                  </p>
                )}
              </div>
            </div>

            <Button variant="outline" onClick={handleModifyPreview} className="gap-2"><Icon name="Calculator" size={16} />Рассчитать новый график</Button>

            {modifyPreview && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Новый график: платёж {fmt(modifyMonthly)}</CardTitle>
                    {detail && (
                      <Badge variant={modifyMonthly < detail.monthly_payment ? "default" : "destructive"} className="text-xs">
                        {modifyMonthly < detail.monthly_payment ? "↓" : "↑"} {fmt(Math.abs(modifyMonthly - detail.monthly_payment))}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2">№</th><th className="text-left py-2 px-2">Дата</th>
                        <th className="text-right py-2 px-2">Платёж</th><th className="text-right py-2 px-2">Осн. долг</th>
                        <th className="text-right py-2 px-2">Проценты</th><th className="text-right py-2 px-2">Остаток</th>
                      </tr></thead>
                      <tbody>{modifyPreview.map(r => (
                        <tr key={r.payment_no} className="border-b last:border-0">
                          <td className="py-1.5 px-2">{r.payment_no}</td><td className="py-1.5 px-2">{fmtDate(r.payment_date)}</td>
                          <td className="py-1.5 px-2 text-right font-medium">{fmt(r.payment_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.principal_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.interest_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.balance_after)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModify(false)}>Отмена</Button>
              <Button onClick={handleModify} disabled={saving || (!modifyForm.new_rate && !modifyForm.new_term)} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
                Сохранить изменения
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPayment} onOpenChange={setShowEditPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Редактирование платежа</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Дата платежа</Label><Input type="date" value={editPayForm.payment_date} onChange={e => setEditPayForm(p => ({ ...p, payment_date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Общая сумма, ₽</Label><Input type="number" step="0.01" value={editPayForm.amount} onChange={e => setEditPayForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Осн. долг, ₽</Label><Input type="number" step="0.01" value={editPayForm.principal_part} onChange={e => setEditPayForm(p => ({ ...p, principal_part: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Проценты, ₽</Label><Input type="number" step="0.01" value={editPayForm.interest_part} onChange={e => setEditPayForm(p => ({ ...p, interest_part: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Штрафы, ₽</Label><Input type="number" step="0.01" value={editPayForm.penalty_part} onChange={e => setEditPayForm(p => ({ ...p, penalty_part: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditPayment(false)}>Отмена</Button>
              <Button onClick={handleUpdatePayment} disabled={saving || !editPayForm.amount} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Loans;