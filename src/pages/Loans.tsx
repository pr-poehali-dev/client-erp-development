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
import { useToast } from "@/hooks/use-toast";
import api, { Loan, LoanDetail, Member, ScheduleItem } from "@/lib/api";

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
  { key: "amount", label: "Сумма", render: (i: Loan) => fmt(i.amount) },
  { key: "rate", label: "Ставка", render: (i: Loan) => i.rate + "%" },
  { key: "term_months", label: "Срок", render: (i: Loan) => i.term_months + " мес." },
  { key: "monthly_payment", label: "Платёж", render: (i: Loan) => fmt(i.monthly_payment) },
  { key: "balance", label: "Остаток", render: (i: Loan) => fmt(i.balance) },
  { key: "schedule_type", label: "График", render: (i: Loan) => <span className="text-xs">{i.schedule_type === "annuity" ? "Аннуитет" : "В конце срока"}</span> },
  { key: "status", label: "Статус", render: (i: Loan) => <Badge variant={statusVariant(i.status) as "default"|"destructive"|"secondary"} className="text-xs">{statusLabel[i.status] || i.status}</Badge> },
];

const Loans = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", schedule_type: "annuity", start_date: new Date().toISOString().slice(0, 10) });
  const [preview, setPreview] = useState<ScheduleItem[] | null>(null);
  const [previewMonthly, setPreviewMonthly] = useState(0);
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });

  const load = () => {
    setLoading(true);
    Promise.all([api.loans.list(), api.members.list()]).then(([l, m]) => { setLoans(l); setMembers(m); }).finally(() => setLoading(false));
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

  const handlePayment = async () => {
    if (!detail || !payForm.amount) return;
    setSaving(true);
    try {
      await api.loans.payment({ loan_id: detail.id, payment_date: payForm.date, amount: Number(payForm.amount) });
      toast({ title: "Платёж внесён" });
      setShowPayment(false);
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
      <PageHeader title="Займы" description={`${loans.filter(l => l.status === "active").length} активных из ${loans.length} договоров`} actionLabel="Новый договор" actionIcon="Plus" onAction={() => { setForm({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", schedule_type: "annuity", start_date: new Date().toISOString().slice(0, 10) }); setPreview(null); setShowForm(true); }} />

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
              <Label className="text-xs">Пайщик *</Label>
              <Select value={form.member_id} onValueChange={v => setForm(p => ({ ...p, member_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите пайщика" /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.member_no})</SelectItem>)}</SelectContent>
              </Select>
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
                            <th className="text-right py-2 px-2">Проценты</th><th className="text-right py-2 px-2">Остаток</th>
                            <th className="text-center py-2 px-2">Статус</th>
                          </tr></thead>
                          <tbody>{detail.schedule.map(r => (
                            <tr key={r.payment_no} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="py-2 px-2">{r.payment_no}</td><td className="py-2 px-2">{fmtDate(r.payment_date)}</td>
                              <td className="py-2 px-2 text-right font-medium">{fmt(r.payment_amount)}</td>
                              <td className="py-2 px-2 text-right">{fmt(r.principal_amount)}</td>
                              <td className="py-2 px-2 text-right">{fmt(r.interest_amount)}</td>
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
                        </tr></thead>
                        <tbody>{detail.payments.map(p => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-2 px-2">{fmtDate(p.payment_date)}</td>
                            <td className="py-2 px-2 text-right font-medium">{fmt(p.amount)}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.principal_part)}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.interest_part)}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.penalty_part)}</td>
                            <td className="py-2 px-2 text-xs">{p.payment_type}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1" onClick={() => { setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10) }); setShowPayment(true); }}>
                      <div className="flex items-center gap-2"><Icon name="CreditCard" size={16} /><span className="font-medium text-sm">Внести платёж</span></div>
                      <span className="text-xs text-muted-foreground">Указать дату и сумму платежа</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2"><Icon name="FastForward" size={16} /><span className="font-medium text-sm">Досрочное погашение</span></div>
                      <span className="text-xs text-muted-foreground">Частичное или полное</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2"><Icon name="Settings2" size={16} /><span className="font-medium text-sm">Изменить параметры</span></div>
                      <span className="text-xs text-muted-foreground">Срок, ставка, перерасчёт</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2"><Icon name="FileText" size={16} /><span className="font-medium text-sm">Выписка по счёту</span></div>
                      <span className="text-xs text-muted-foreground">Экспорт в .xlsx и .pdf</span>
                    </Button>
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
            <div className="space-y-1.5"><Label className="text-xs">Дата платежа</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма, ₽</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPayment(false)}>Отмена</Button>
              <Button onClick={handlePayment} disabled={saving || !payForm.amount} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Check" size={16} />}
                Провести
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Loans;
