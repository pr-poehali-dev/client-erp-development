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
import Icon from "@/components/ui/icon";
import MemberSearch from "@/components/ui/member-search";
import { useToast } from "@/hooks/use-toast";
import api, { Saving, Member, SavingsScheduleItem } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

const columns: Column<Saving>[] = [
  { key: "contract_no", label: "Договор", className: "font-medium" },
  { key: "member_name", label: "Пайщик" },
  { key: "amount", label: "Сумма вклада", render: (i: Saving) => fmt(i.amount) },
  { key: "rate", label: "Ставка", render: (i: Saving) => i.rate + "%" },
  { key: "term_months", label: "Срок", render: (i: Saving) => i.term_months + " мес." },
  { key: "accrued_interest", label: "Начислено %", render: (i: Saving) => fmt(i.accrued_interest) },
  { key: "payout_type", label: "Выплата", render: (i: Saving) => <span className="text-xs">{i.payout_type === "monthly" ? "Ежемесячно" : "В конце срока"}</span> },
  { key: "end_date", label: "Окончание", render: (i: Saving) => fmtDate(i.end_date) },
  { key: "status", label: "Статус", render: (i: Saving) => <Badge variant={i.status === "active" ? "default" : "secondary"} className="text-xs">{i.status === "active" ? "Активен" : "Закрыт"}</Badge> },
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SavingsScheduleItem[] | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", payout_type: "monthly", start_date: new Date().toISOString().slice(0, 10) });

  const load = () => {
    setLoading(true);
    Promise.all([api.savings.list(), api.members.list()]).then(([s, m]) => { setItems(s); setMembers(m); }).finally(() => setLoading(false));
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

  if (loading) return <div className="flex items-center justify-center h-64"><Icon name="Loader2" size={32} className="animate-spin text-primary" /></div>;

  const totalSavings = items.filter(s => s.status === "active").reduce((s, i) => s + i.current_balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Сбережения" description={`${items.filter(s => s.status === "active").length} активных договоров`} actionLabel="Новый договор" actionIcon="Plus" onAction={() => { setForm({ contract_no: "", member_id: "", amount: "", rate: "", term_months: "", payout_type: "monthly", start_date: new Date().toISOString().slice(0, 10) }); setPreview(null); setShowForm(true); }} />

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

      <DataTable columns={columns} data={filtered} emptyMessage="Договоры не найдены. Создайте первый договор сбережений." />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Новый договор сбережений</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Пайщик *</Label>
              <MemberSearch members={members} value={form.member_id} onChange={(id) => setForm(p => ({ ...p, member_id: id }))} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Номер договора *</Label><Input value={form.contract_no} onChange={e => setForm(p => ({ ...p, contract_no: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Сумма вклада, ₽ *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
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

            <Button variant="outline" onClick={handleCalc} className="gap-2"><Icon name="Calculator" size={16} />Рассчитать график</Button>

            {preview && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">График доходности</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2">№</th><th className="text-left py-2 px-2">Период</th>
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
    </div>
  );
};

export default Savings;