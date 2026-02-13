import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/page-header";
import DataTable, { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import MemberSearch from "@/components/ui/member-search";
import { useToast } from "@/hooks/use-toast";
import api, { ShareAccount, Member } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";

const columns: Column<ShareAccount>[] = [
  { key: "account_no", label: "Номер счёта", className: "font-medium" },
  { key: "member_name", label: "Пайщик" },
  { key: "balance", label: "Баланс", className: "font-semibold", render: (i: ShareAccount) => fmt(i.balance) },
  { key: "total_in", label: "Всего внесено", render: (i: ShareAccount) => fmt(i.total_in) },
  { key: "total_out", label: "Всего выплачено", render: (i: ShareAccount) => fmt(i.total_out) },
  { key: "status", label: "Статус", render: (i: ShareAccount) => <Badge variant="default" className="text-xs">{i.status === "active" ? "Активен" : i.status}</Badge> },
  { key: "id", label: "", render: (i: ShareAccount) => (
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      <button className="p-1 rounded hover:bg-muted" title="Excel" onClick={() => api.export.download("share", i.id, "xlsx")}><Icon name="FileSpreadsheet" size={14} className="text-green-600" /></button>
      <button className="p-1 rounded hover:bg-muted" title="PDF" onClick={() => api.export.download("share", i.id, "pdf")}><Icon name="FileText" size={14} className="text-red-500" /></button>
    </div>
  )},
];

const Shares = () => {
  const [accounts, setAccounts] = useState<ShareAccount[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showOp, setShowOp] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [createForm, setCreateForm] = useState({ member_id: "", amount: "" });
  const [opForm, setOpForm] = useState({ account_id: "", type: "in", amount: "", date: new Date().toISOString().slice(0, 10) });

  const load = () => {
    setLoading(true);
    Promise.all([api.shares.list(), api.members.list()]).then(([s, m]) => { setAccounts(s); setMembers(m); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = accounts.filter(a => a.account_no?.toLowerCase().includes(search.toLowerCase()) || a.member_name?.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.shares.create({ member_id: Number(createForm.member_id), amount: Number(createForm.amount) });
      toast({ title: "Паевой счёт открыт" });
      setShowForm(false);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleOp = async () => {
    setSaving(true);
    try {
      await api.shares.transaction({
        account_id: Number(opForm.account_id), amount: Number(opForm.amount),
        transaction_type: opForm.type, transaction_date: opForm.date,
      });
      toast({ title: opForm.type === "in" ? "Взнос внесён" : "Выплата проведена" });
      setShowOp(false);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Icon name="Loader2" size={32} className="animate-spin text-primary" /></div>;

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Паевые счета" description={`${accounts.length} счетов`} actionLabel="Открыть счёт" actionIcon="Plus" onAction={() => { setCreateForm({ member_id: "", amount: "" }); setShowForm(true); }} />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Паевой фонд</div><div className="text-xl font-bold">{fmt(totalBalance)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Всего счетов</div><div className="text-xl font-bold">{accounts.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">Средний взнос</div><div className="text-xl font-bold">{accounts.length ? fmt(totalBalance / accounts.length) : "0 ₽"}</div></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по номеру, пайщику..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" className="gap-2" onClick={() => { setOpForm({ account_id: "", type: "in", amount: "", date: new Date().toISOString().slice(0, 10) }); setShowOp(true); }}>
          <Icon name="ArrowUpDown" size={16} />Операция
        </Button>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="Счета не найдены. Откройте первый паевой счёт." />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Открыть паевой счёт</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Пайщик *</Label>
              <MemberSearch members={members} value={createForm.member_id} onChange={(id) => setCreateForm(p => ({ ...p, member_id: id }))} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма паевого взноса, ₽</Label><Input type="number" value={createForm.amount} onChange={e => setCreateForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <p className="text-xs text-muted-foreground">Номер счёта будет сформирован автоматически</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button onClick={handleCreate} disabled={saving || !createForm.member_id} className="gap-2">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
                Открыть счёт
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOp} onOpenChange={setShowOp}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Операция по паевому счёту</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Паевой счёт *</Label>
              <Select value={opForm.account_id} onValueChange={v => setOpForm(p => ({ ...p, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите счёт" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.account_no} — {a.member_name} ({fmt(a.balance)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип операции</Label>
              <Select value={opForm.type} onValueChange={v => setOpForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Внесение взноса</SelectItem>
                  <SelectItem value="out">Выплата взноса</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Сумма, ₽ *</Label><Input type="number" value={opForm.amount} onChange={e => setOpForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Дата операции</Label><Input type="date" value={opForm.date} onChange={e => setOpForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowOp(false)}>Отмена</Button>
              <Button onClick={handleOp} disabled={saving || !opForm.account_id || !opForm.amount} className="gap-2">
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

export default Shares;