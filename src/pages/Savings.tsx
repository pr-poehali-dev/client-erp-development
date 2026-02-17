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
import api, { Saving, SavingDetail, SavingTransaction, DailyAccrual, Member, SavingsScheduleItem, Organization } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " \u20BD";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const ttLabels: Record<string, string> = { opening: "Открытие", deposit: "Пополнение", withdrawal: "Частичное изъятие", interest_payout: "Выплата %", interest_accrual: "Начисление %", term_change: "Изменение срока", rate_change: "Изменение ставки", early_close: "Досрочное закрытие", closing: "Закрытие" };

const columns: Column<Saving>[] = [
  { key: "contract_no", label: "Договор", className: "font-medium" },
  { key: "member_name", label: "Пайщик" },
  { key: "org_name", label: "Организация", render: (i: Saving) => <span className="text-xs text-muted-foreground">{i.org_short_name || i.org_name || "—"}</span> },
  { key: "amount", label: "Сумма вклада", render: (i: Saving) => fmt(i.amount) },
  { key: "rate", label: "Ставка", render: (i: Saving) => i.rate + "%" },
  { key: "term_months", label: "Срок", render: (i: Saving) => i.term_months + " мес." },
  { key: "accrued_interest", label: "Начислено %", render: (i: Saving) => fmt(i.accrued_interest) },
  { key: "min_balance_pct", label: "Несниж.%", render: (i: Saving) => <span className="text-xs">{i.min_balance_pct > 0 ? i.min_balance_pct + "%" : "—"}</span> },
  { key: "payout_type", label: "Выплата", render: (i: Saving) => <span className="text-xs">{i.payout_type === "monthly" ? "Ежемесячно" : "В конце срока"}</span> },
  { key: "end_date", label: "Окончание", render: (i: Saving) => fmtDate(i.end_date) },
  { key: "status", label: "Статус", render: (i: Saving) => <Badge variant={i.status === "active" ? "default" : "secondary"} className="text-xs">{i.status === "active" ? "Активен" : i.status === "early_closed" ? "Досрочно" : "Закрыт"}</Badge> },
  { key: "id", label: "", render: (i: Saving) => (
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      <button className="p-1 rounded hover:bg-muted" title="Excel" onClick={() => api.export.download("saving", i.id, "xlsx")}><Icon name="FileSpreadsheet" size={14} className="text-green-600" /></button>
      <button className="p-1 rounded hover:bg-muted" title="PDF" onClick={() => api.export.download("saving", i.id, "pdf")}><Icon name="FileText" size={14} className="text-red-500" /></button>
    </div>
  )},
];

const Savings = () => {
  const [items, setItems] = useState<Saving[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SavingsScheduleItem[] | null>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<SavingDetail | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), is_cash: false });
  const [showInterest, setShowInterest] = useState(false);
  const [interestForm, setInterestForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });
  const [showEarlyClose, setShowEarlyClose] = useState(false);
  const [showEditTx, setShowEditTx] = useState(false);
  const [editTxForm, setEditTxForm] = useState({ transaction_id: 0, amount: "", transaction_date: "", description: "" });

  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });
  const [showModifyTerm, setShowModifyTerm] = useState(false);
  const [modifyTermForm, setModifyTermForm] = useState({ new_term: "" });
  const [txFilterState, setTxFilterState] = useState<"all" | "transactions" | "accruals">("all");
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillForm, setBackfillForm] = useState({ date_from: "", date_to: new Date().toISOString().slice(0, 10) });

  const [form, setForm] = useState({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", payout_type: "monthly", start_date: new Date().toISOString().slice(0, 10), min_balance_pct: "", org_id: "" });

  const load = () => {
    setLoading(true);
    Promise.all([api.savings.list(), api.members.list()]).then(([s, m]) => { setItems(s); setMembers(m); }).finally(() => setLoading(false));
    api.organizations.list().then(setOrgs).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(s => s.contract_no?.toLowerCase().includes(search.toLowerCase()) || s.member_name?.toLowerCase().includes(search.toLowerCase()));

  const handleCalc = async () => {
    if (!form.amount || !form.rate || !form.term_months) return;
    const res = await api.savings.calcSchedule(Number(form.amount), Number(form.rate), Number(form.term_months), form.payout_type, form.start_date);
    setPreview(res.schedule);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.savings.create({
        contract_no: form.contract_no, member_id: Number(form.member_id),
        amount: Number(form.amount), rate: Number(form.rate), term_months: Number(form.term_months),
        payout_type: form.payout_type, start_date: form.start_date,
        min_balance_pct: form.min_balance_pct ? Number(form.min_balance_pct) : 0,
        org_id: form.org_id ? Number(form.org_id) : undefined,
      });
      toast({ title: "Договор сбережений создан" });
      setShowForm(false);
      setPreview(null);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (s: Saving) => {
    const d = await api.savings.get(s.id);
    setDetail(d);
    setShowDetail(true);
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const d = await api.savings.get(detail.id);
    setDetail(d);
    load();
  };

  const handleDeposit = async () => {
    if (!detail || !depositForm.amount) return;
    setSaving(true);
    try {
      await api.savings.transaction({
        saving_id: detail.id, amount: Number(depositForm.amount),
        transaction_type: "deposit", transaction_date: depositForm.date, is_cash: depositForm.is_cash,
      });
      toast({ title: "Пополнение проведено", description: fmt(Number(depositForm.amount)) });
      setShowDeposit(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleInterestPayout = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await api.savings.interestPayout({
        saving_id: detail.id,
        amount: interestForm.amount ? Number(interestForm.amount) : undefined,
        transaction_date: interestForm.date,
      });
      toast({ title: "Проценты выплачены", description: fmt(res.amount) });
      setShowInterest(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEarlyClose = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await api.savings.earlyClose(detail.id);
      toast({ title: "Вклад досрочно закрыт", description: `Возврат: ${fmt(res.final_amount)}` });
      setShowEarlyClose(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePartialWithdrawal = async () => {
    if (!detail || !withdrawalForm.amount) return;
    setSaving(true);
    try {
      const res = await api.savings.partialWithdrawal({
        saving_id: detail.id, amount: Number(withdrawalForm.amount),
        transaction_date: withdrawalForm.date,
      });
      toast({ title: "Частичное изъятие проведено", description: `Новый баланс: ${fmt(res.new_balance)}` });
      setShowWithdrawal(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleModifyTerm = async () => {
    if (!detail || !modifyTermForm.new_term) return;
    setSaving(true);
    try {
      const res = await api.savings.modifyTerm({ saving_id: detail.id, new_term: Number(modifyTermForm.new_term) });
      toast({ title: "Срок изменён", description: `Новый срок: ${res.new_term} мес., окончание: ${fmtDate(res.new_end_date)}` });
      setShowModifyTerm(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBackfillAccrue = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await api.savings.backfillAccrue({
        saving_id: detail.id,
        date_from: backfillForm.date_from || undefined,
        date_to: backfillForm.date_to,
      });
      toast({ title: "Начисление выполнено", description: `Начислено за ${res.days_accrued} дней: ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(res.total_amount)} ₽` });
      setShowBackfill(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEditTx = (tx: SavingTransaction) => {
    setEditTxForm({
      transaction_id: tx.id,
      amount: String(tx.amount),
      transaction_date: tx.transaction_date,
      description: tx.description || "",
    });
    setShowEditTx(true);
  };

  const handleUpdateTx = async () => {
    setSaving(true);
    try {
      await api.savings.updateTransaction({
        transaction_id: editTxForm.transaction_id,
        amount: Number(editTxForm.amount),
        transaction_date: editTxForm.transaction_date,
        description: editTxForm.description,
      });
      toast({ title: "Операция обновлена" });
      setShowEditTx(false);
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTx = async (tx: SavingTransaction) => {
    if (!confirm(`Удалить операцию "${ttLabels[tx.transaction_type] || tx.transaction_type}" на сумму ${fmt(tx.amount)}?`)) return;
    try {
      await api.savings.deleteTransaction(tx.id);
      toast({ title: "Операция удалена" });
      await refreshDetail();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const handleDeleteContract = async () => {
    if (!detail || !confirm(`УДАЛИТЬ договор ${detail.contract_no} со всеми операциями? Это действие необратимо!`)) return;
    setSaving(true);
    try {
      await api.savings.deleteContract(detail.id);
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

  const handleDeleteAllTransactions = async () => {
    if (!detail || !confirm(`Удалить ВСЕ операции по договору ${detail.contract_no} и сбросить начисления? Это действие необратимо!`)) return;
    setSaving(true);
    try {
      await api.savings.deleteAllTransactions(detail.id);
      toast({ title: "Все операции удалены, начисления сброшены" });
      const d = await api.savings.get(detail.id);
      setDetail(d);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Icon name="Loader2" size={32} className="animate-spin text-primary" /></div>;

  const totalSavings = items.filter(s => s.status === "active").reduce((s, i) => s + i.current_balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Сбережения" description={`${items.filter(s => s.status === "active").length} активных договоров`} actionLabel="Новый договор" actionIcon="Plus" onAction={() => { setForm({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", payout_type: "monthly", start_date: new Date().toISOString().slice(0, 10), min_balance_pct: "", org_id: "" }); setPreview(null); setShowForm(true); }} />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Общая сумма вкладов</div><div className="text-xl font-bold">{fmt(totalSavings)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Активных договоров</div><div className="text-xl font-bold">{items.filter(s => s.status === "active").length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Всего договоров</div><div className="text-xl font-bold">{items.length}</div></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по договору, пайщику..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={openDetail} emptyMessage="Договоры не найдены. Создайте первый договор сбережений." />

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Новый договор сбережений</DialogTitle></DialogHeader>
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
              <div className="space-y-1.5"><Label className="text-xs">Сумма вклада, \u20BD *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ставка, % годовых *</Label><Input type="number" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Срок, месяцев *</Label><Input type="number" value={form.term_months} onChange={e => setForm(p => ({ ...p, term_months: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Вариант выплаты</Label>
                <Select value={form.payout_type} onValueChange={v => setForm(p => ({ ...p, payout_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="end_of_term">В конце срока</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Дата начала</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Неснижаемый остаток, % от суммы (0 = изъятие запрещено)</Label>
              <Input type="number" min="0" max="100" step="1" placeholder="0" value={form.min_balance_pct} onChange={e => setForm(p => ({ ...p, min_balance_pct: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Если указан процент {">"}0, клиент сможет частично снимать средства, но не ниже неснижаемого остатка</p>
            </div>

            <Button variant="outline" onClick={handleCalc} className="gap-2"><Icon name="Calculator" size={16} />Рассчитать график</Button>

            {preview && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">График доходности</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2">N</th><th className="text-left py-2 px-2">Период</th>
                        <th className="text-right py-2 px-2">Проценты</th><th className="text-right py-2 px-2">Накоплено</th>
                        <th className="text-right py-2 px-2">Баланс</th>
                      </tr></thead>
                      <tbody>{preview.map(r => (
                        <tr key={r.period_no} className="border-b last:border-0">
                          <td className="py-1.5 px-2">{r.period_no}</td>
                          <td className="py-1.5 px-2">{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.interest_amount)}</td>
                          <td className="py-1.5 px-2 text-right">{fmt(r.cumulative_interest)}</td>
                          <td className="py-1.5 px-2 text-right font-medium">{fmt(r.balance_after)}</td>
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

      {/* Detail dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Договор {detail?.contract_no}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-6">
              <div className="grid grid-cols-5 gap-4">
                <div><div className="text-xs text-muted-foreground">Пайщик</div><div className="text-sm font-medium">{detail.member_name}</div></div>
                <div><div className="text-xs text-muted-foreground">Сумма</div><div className="text-sm font-medium">{fmt(detail.amount)}</div></div>
                <div><div className="text-xs text-muted-foreground">Ставка</div><div className="text-sm font-medium">{detail.rate}%</div></div>
                <div><div className="text-xs text-muted-foreground">Выплата %</div><div className="text-sm font-medium">{detail.payout_type === "monthly" ? "Ежемесячно" : "В конце срока"}</div></div>
                <div><div className="text-xs text-muted-foreground">Баланс</div><div className="text-sm font-bold text-primary">{fmt(detail.current_balance)}</div></div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div><div className="text-xs text-muted-foreground">Срок</div><div className="text-sm">{detail.term_months} мес.</div></div>
                <div><div className="text-xs text-muted-foreground">Период</div><div className="text-sm">{fmtDate(detail.start_date)} — {fmtDate(detail.end_date)}</div></div>
                <div><div className="text-xs text-muted-foreground">Начислено % (факт.)</div><div className="text-sm font-medium text-green-600">{fmt(detail.total_daily_accrued)}</div></div>
                <div><div className="text-xs text-muted-foreground">Выплачено %</div><div className="text-sm">{fmt(detail.paid_interest)}</div></div>
                <div><div className="text-xs text-muted-foreground">Несниж. остаток</div><div className="text-sm">{detail.min_balance_pct > 0 ? `${detail.min_balance_pct}% (${fmt(detail.amount * detail.min_balance_pct / 100)})` : "Не установлен"}</div></div>
              </div>

              <Tabs defaultValue="schedule">
                <TabsList>
                  <TabsTrigger value="schedule">Плановый график</TabsTrigger>
                  <TabsTrigger value="transactions">Транзакции ({detail.transactions.length})</TabsTrigger>
                  <TabsTrigger value="actions">Действия</TabsTrigger>
                </TabsList>

                <TabsContent value="schedule" className="mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon name="Info" size={14} className="text-blue-500" />
                        Плановый график доходности (информационный)
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Отражает плановые начисления. Фактические проценты начисляются ежедневно на остаток.</p>
                    </CardHeader>
                    <CardContent className="pt-2">
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 px-2">N</th><th className="text-left py-2 px-2">Период</th>
                          <th className="text-right py-2 px-2">Проценты (план)</th><th className="text-right py-2 px-2">Накоплено</th>
                          <th className="text-right py-2 px-2">Баланс</th>
                        </tr></thead>
                        <tbody>{detail.schedule.map(r => (
                          <tr key={r.period_no} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2">{r.period_no}</td>
                            <td className="py-2 px-2">{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</td>
                            <td className="py-2 px-2 text-right">{fmt(r.interest_amount)}</td>
                            <td className="py-2 px-2 text-right">{fmt(r.cumulative_interest)}</td>
                            <td className="py-2 px-2 text-right font-medium">{fmt(r.balance_after)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="transactions" className="mt-4">
                  {(() => {
                    type UnifiedRow = { kind: "tx"; data: SavingTransaction } | { kind: "accrual"; data: DailyAccrual };
                    const accrualRows: UnifiedRow[] = (detail.daily_accruals || []).map(a => ({ kind: "accrual" as const, data: a }));
                    const txRows: UnifiedRow[] = detail.transactions.map(t => ({ kind: "tx" as const, data: t }));
                    const allRows = [...txRows, ...accrualRows].sort((a, b) => {
                      const dA = a.kind === "tx" ? a.data.transaction_date : a.data.accrual_date;
                      const dB = b.kind === "tx" ? b.data.transaction_date : b.data.accrual_date;
                      return dA.localeCompare(dB);
                    });
                    const [txFilter, setTxFilter] = [txFilterState, setTxFilterState];
                    const filtered = txFilter === "all" ? allRows : txFilter === "accruals" ? allRows.filter(r => r.kind === "accrual") : allRows.filter(r => r.kind === "tx");
                    const accrualSum = accrualRows.reduce((s, r) => s + Number(r.data.daily_amount), 0);
                    return <>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-muted-foreground">
                            Записей: <span className="font-medium text-foreground">{filtered.length}</span>
                          </div>
                          <div className="flex rounded-md border overflow-hidden text-xs">
                            <button className={`px-2.5 py-1 ${txFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} onClick={() => setTxFilterState("all")}>Все</button>
                            <button className={`px-2.5 py-1 border-l ${txFilter === "transactions" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} onClick={() => setTxFilterState("transactions")}>Операции</button>
                            <button className={`px-2.5 py-1 border-l ${txFilter === "accruals" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} onClick={() => setTxFilterState("accruals")}>Начисления %</button>
                          </div>
                        </div>
                        {detail.transactions.length > 0 && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => { api.export.download("saving_transactions", detail.id, "xlsx"); toast({ title: "Формируется Excel-выписка по транзакциям..." }); }}>
                              <Icon name="FileSpreadsheet" size={14} className="text-green-600" />
                              <span className="text-xs">Excel</span>
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => { api.export.download("saving_transactions", detail.id, "pdf"); toast({ title: "Формируется PDF-выписка по транзакциям..." }); }}>
                              <Icon name="FileText" size={14} className="text-red-500" />
                              <span className="text-xs">PDF</span>
                            </Button>
                          </div>
                        )}
                      </div>
                      {txFilter === "accruals" && accrualRows.length > 0 && (
                        <Card className="mb-3 border-blue-200 bg-blue-50/50"><CardContent className="py-2.5 px-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Итого начислено за <span className="font-medium text-foreground">{accrualRows.length}</span> дн.</span>
                            <span className="font-semibold text-blue-700">{fmt(accrualSum)}</span>
                          </div>
                        </CardContent></Card>
                      )}
                      {filtered.length === 0 ? (
                        <Card className="p-6 text-center text-muted-foreground text-sm">Записей пока нет</Card>
                      ) : (
                        <Card><CardContent className="pt-4">
                          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card z-10"><tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left py-2 px-2 w-8">№</th>
                              <th className="text-left py-2 px-2">Дата</th>
                              <th className="text-right py-2 px-2">Сумма</th>
                              <th className="text-left py-2 px-2">Тип</th>
                              <th className="text-left py-2 px-2">Описание</th>
                              <th className="text-center py-2 px-2 w-20"></th>
                            </tr></thead>
                            <tbody>{filtered.map((row, idx) => {
                              if (row.kind === "accrual") {
                                const a = row.data;
                                return (
                                  <tr key={"ac-" + a.id} className="border-b last:border-0 hover:bg-blue-50/40">
                                    <td className="py-1.5 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                                    <td className="py-1.5 px-2 text-xs">{fmtDate(a.accrual_date)}</td>
                                    <td className="py-1.5 px-2 text-right text-xs font-medium text-blue-700">+{fmt(Number(a.daily_amount))}</td>
                                    <td className="py-1.5 px-2">
                                      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">
                                        <Icon name="TrendingUp" size={10} className="mr-0.5" />Начисление %
                                      </Badge>
                                    </td>
                                    <td className="py-1.5 px-2 text-[11px] text-muted-foreground">
                                      Баланс: {fmt(Number(a.balance))}, ставка: {Number(a.rate)}%
                                    </td>
                                    <td className="py-1.5 px-2"></td>
                                  </tr>
                                );
                              }
                              const tx = row.data;
                              return (
                                <tr key={"tx-" + tx.id} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="py-2 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                                  <td className="py-2 px-2">{fmtDate(tx.transaction_date)}</td>
                                  <td className="py-2 px-2 text-right font-medium">{tx.amount > 0 ? fmt(tx.amount) : "—"}</td>
                                  <td className="py-2 px-2">
                                    <Badge variant={
                                      tx.transaction_type === "opening" ? "default" :
                                      tx.transaction_type === "deposit" ? "default" :
                                      tx.transaction_type === "interest_payout" ? "secondary" :
                                      tx.transaction_type === "interest_accrual" ? "secondary" :
                                      tx.transaction_type === "withdrawal" || tx.transaction_type === "early_close" ? "destructive" :
                                      "outline"
                                    } className="text-xs">
                                      {ttLabels[tx.transaction_type] || tx.transaction_type}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-2 text-xs text-muted-foreground max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                                  <td className="py-2 px-2 text-center">
                                    {!["opening", "interest_accrual", "term_change", "rate_change"].includes(tx.transaction_type) && (
                                    <div className="flex gap-1 justify-center">
                                      <button className="p-1 rounded hover:bg-muted" title="Редактировать" onClick={() => openEditTx(tx)}><Icon name="Pencil" size={14} className="text-muted-foreground" /></button>
                                      <button className="p-1 rounded hover:bg-destructive/10" title="Удалить" onClick={() => handleDeleteTx(tx)}><Icon name="Trash2" size={14} className="text-destructive/70" /></button>
                                    </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                          </div>
                        </CardContent></Card>
                      )}
                    </>;
                  })()}
                </TabsContent>

                <TabsContent value="actions" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active"} onClick={() => { setDepositForm({ amount: "", date: new Date().toISOString().slice(0, 10), is_cash: false }); setShowDeposit(true); }}>
                      <div className="flex items-center gap-2"><Icon name="PlusCircle" size={16} /><span className="font-medium text-sm">Пополнить вклад</span></div>
                      <span className="text-xs text-muted-foreground">Внести дополнительные средства (график пересчитается)</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active" || detail.max_payout <= 0} onClick={() => { setInterestForm({ amount: "", date: new Date().toISOString().slice(0, 10) }); setShowInterest(true); }}>
                      <div className="flex items-center gap-2"><Icon name="Percent" size={16} /><span className="font-medium text-sm">Выплатить проценты</span></div>
                      <span className="text-xs text-muted-foreground">К выплате: {fmt(detail.max_payout)} (на конец пред. месяца)</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active" || detail.min_balance_pct <= 0} onClick={() => { setWithdrawalForm({ amount: "", date: new Date().toISOString().slice(0, 10) }); setShowWithdrawal(true); }}>
                      <div className="flex items-center gap-2"><Icon name="ArrowDownCircle" size={16} /><span className="font-medium text-sm">Частичное изъятие</span></div>
                      <span className="text-xs text-muted-foreground">{detail.min_balance_pct > 0 ? `Мин. остаток: ${fmt(detail.amount * detail.min_balance_pct / 100)}` : "Не предусмотрено договором"}</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active"} onClick={() => { setModifyTermForm({ new_term: String(detail.term_months) }); setShowModifyTerm(true); }}>
                      <div className="flex items-center gap-2"><Icon name="CalendarClock" size={16} /><span className="font-medium text-sm">Изменить срок</span></div>
                      <span className="text-xs text-muted-foreground">Текущий: {detail.term_months} мес. (график пересчитается)</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active"} onClick={() => { setBackfillForm({ date_from: detail.accrual_last_date ? new Date(new Date(detail.accrual_last_date).getTime() + 86400000).toISOString().slice(0, 10) : detail.start_date, date_to: new Date().toISOString().slice(0, 10) }); setShowBackfill(true); }}>
                      <div className="flex items-center gap-2"><Icon name="Calculator" size={16} /><span className="font-medium text-sm">Начислить проценты вручную</span></div>
                      <span className="text-xs text-muted-foreground">
                        {detail.accrual_days_count > 0
                          ? `Начислено за ${detail.accrual_days_count} дн. (${fmtDate(detail.accrual_first_date || "")} — ${fmtDate(detail.accrual_last_date || "")})`
                          : "Начислений ещё не было"}
                      </span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active" || saving} onClick={async () => {
                      setSaving(true);
                      try {
                        await api.savings.recalcSchedule(detail.id);
                        toast({ title: "График пересчитан" });
                        const d = await api.savings.get(detail.id);
                        setDetail(d);
                        load();
                      } catch (e) { toast({ title: "Ошибка", description: String(e), variant: "destructive" }); }
                      finally { setSaving(false); }
                    }}>
                      <div className="flex items-center gap-2"><Icon name="RefreshCw" size={16} /><span className="font-medium text-sm">Пересчитать график</span></div>
                      <span className="text-xs text-muted-foreground">Пересчитать даты и суммы графика</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" disabled={detail.status !== "active"} onClick={() => setShowEarlyClose(true)}>
                      <div className="flex items-center gap-2"><Icon name="XCircle" size={16} /><span className="font-medium text-sm">Досрочное закрытие</span></div>
                      <span className="text-xs text-muted-foreground">Закрыть вклад до окончания срока</span>
                    </Button>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" onClick={() => { api.export.download("saving", detail.id, "xlsx"); toast({ title: "Формируется Excel-выписка..." }); }}>
                        <div className="flex items-center gap-2"><Icon name="FileSpreadsheet" size={16} /><span className="font-medium text-sm">Выписка Excel</span></div>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" onClick={() => { api.export.download("saving", detail.id, "pdf"); toast({ title: "Формируется PDF-выписка..." }); }}>
                        <div className="flex items-center gap-2"><Icon name="FileText" size={16} /><span className="font-medium text-sm">Выписка PDF</span></div>
                      </Button>
                    </div>
                    {isAdmin && detail.transactions.length > 0 && (
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handleDeleteAllTransactions} disabled={saving}>
                        <div className="flex items-center gap-2"><Icon name="Eraser" size={16} /><span className="font-medium text-sm">Удалить все операции</span></div>
                        <span className="text-xs text-muted-foreground">Сбросить историю операций и начисления</span>
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

      {/* Deposit dialog */}
      <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Пополнение вклада</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Текущий баланс:</span>
                  <span className="font-semibold">{fmt(detail.current_balance)}</span>
                </div>
              </Card>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Дата операции</Label><Input type="date" value={depositForm.date} onChange={e => setDepositForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма пополнения, \u20BD</Label><Input type="number" value={depositForm.amount} onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDeposit(false)}>Отмена</Button>
              <Button onClick={handleDeposit} disabled={saving || !depositForm.amount} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Check" size={16} />}
                Пополнить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interest payout dialog */}
      <Dialog open={showInterest} onOpenChange={setShowInterest}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Выплата процентов</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ставка:</span>
                  <span className="font-semibold">{detail.rate}% годовых</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Начислено (факт.):</span>
                  <span className="font-medium text-green-600">{fmt(detail.total_daily_accrued)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Уже выплачено:</span>
                  <span className="font-medium">{fmt(detail.paid_interest)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1">
                  <span className="text-muted-foreground font-medium">К выплате (макс.):</span>
                  <span className="font-bold text-primary">{fmt(detail.max_payout)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Лимит = начислено на последний день прошлого месяца минус уже выплаченное</p>
              </Card>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Дата выплаты</Label><Input type="date" value={interestForm.date} onChange={e => setInterestForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Сумма, \u20BD (оставьте пустым = макс. допустимая)</Label>
              <Input type="number" step="0.01" value={interestForm.amount} onChange={e => setInterestForm(p => ({ ...p, amount: e.target.value }))} placeholder={detail ? String(detail.max_payout) : ""} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowInterest(false)}>Отмена</Button>
              <Button onClick={handleInterestPayout} disabled={saving} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Check" size={16} />}
                Выплатить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Early close dialog */}
      <Dialog open={showEarlyClose} onOpenChange={setShowEarlyClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Досрочное закрытие вклада</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">При досрочном закрытии проценты пересчитываются по минимальной ставке 0.1% годовых. Ранее выплаченные сверх этого проценты удерживаются из суммы возврата.</p>
            {detail && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Текущий баланс:</span>
                  <span className="font-semibold">{fmt(detail.current_balance)}</span>
                </div>
              </Card>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEarlyClose(false)}>Отмена</Button>
              <Button onClick={handleEarlyClose} disabled={saving} variant="destructive" className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="XCircle" size={16} />}
                Закрыть досрочно
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial withdrawal dialog */}
      <Dialog open={showWithdrawal} onOpenChange={setShowWithdrawal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Частичное изъятие</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Текущий баланс:</span>
                  <span className="font-semibold">{fmt(detail.current_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Неснижаемый остаток ({detail.min_balance_pct}%):</span>
                  <span className="font-medium text-amber-600">{fmt(detail.amount * detail.min_balance_pct / 100)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1">
                  <span className="text-muted-foreground font-medium">Макс. к снятию:</span>
                  <span className="font-bold">{fmt(Math.max(0, detail.current_balance - detail.amount * detail.min_balance_pct / 100))}</span>
                </div>
              </Card>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Дата операции</Label><Input type="date" value={withdrawalForm.date} onChange={e => setWithdrawalForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма изъятия, \u20BD</Label><Input type="number" step="0.01" value={withdrawalForm.amount} onChange={e => setWithdrawalForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowWithdrawal(false)}>Отмена</Button>
              <Button onClick={handlePartialWithdrawal} disabled={saving || !withdrawalForm.amount} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="ArrowDownCircle" size={16} />}
                Провести изъятие
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modify term dialog */}
      <Dialog open={showModifyTerm} onOpenChange={setShowModifyTerm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Изменение срока вклада</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Текущий срок:</span>
                  <span className="font-semibold">{detail.term_months} мес.</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Окончание:</span>
                  <span className="font-medium">{fmtDate(detail.end_date)}</span>
                </div>
              </Card>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Новый срок, месяцев</Label><Input type="number" min="1" value={modifyTermForm.new_term} onChange={e => setModifyTermForm(p => ({ ...p, new_term: e.target.value }))} /></div>
            <p className="text-xs text-muted-foreground">Плановый график будет пересчитан под новый срок</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModifyTerm(false)}>Отмена</Button>
              <Button onClick={handleModifyTerm} disabled={saving || !modifyTermForm.new_term} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backfill accrue dialog */}
      <Dialog open={showBackfill} onOpenChange={setShowBackfill}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Начисление процентов вручную</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail && (
              <Card className="p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Баланс вклада:</span>
                  <span className="font-semibold">{fmt(detail.current_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ставка:</span>
                  <span className="font-medium">{detail.rate}% годовых</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Начислено (факт.):</span>
                  <span className="font-medium text-green-600">{fmt(detail.total_daily_accrued)}</span>
                </div>
                {detail.accrual_days_count > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Период начислений:</span>
                    <span className="font-medium">{fmtDate(detail.accrual_first_date || "")} — {fmtDate(detail.accrual_last_date || "")}</span>
                  </div>
                )}
              </Card>
            )}
            <p className="text-xs text-muted-foreground">Начисление будет выполнено за каждый день в указанном диапазоне на фактический остаток. Дни, за которые уже есть начисление, будут пропущены.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Дата с</Label><Input type="date" value={backfillForm.date_from} onChange={e => setBackfillForm(p => ({ ...p, date_from: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Дата по</Label><Input type="date" value={backfillForm.date_to} onChange={e => setBackfillForm(p => ({ ...p, date_to: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowBackfill(false)}>Отмена</Button>
              <Button onClick={handleBackfillAccrue} disabled={saving} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Calculator" size={16} />}
                Начислить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit transaction dialog */}
      <Dialog open={showEditTx} onOpenChange={setShowEditTx}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Редактирование операции</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Дата операции</Label><Input type="date" value={editTxForm.transaction_date} onChange={e => setEditTxForm(p => ({ ...p, transaction_date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма, \u20BD</Label><Input type="number" step="0.01" value={editTxForm.amount} onChange={e => setEditTxForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Описание</Label><Input value={editTxForm.description} onChange={e => setEditTxForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditTx(false)}>Отмена</Button>
              <Button onClick={handleUpdateTx} disabled={saving || !editTxForm.amount} className="gap-2">
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

export default Savings;