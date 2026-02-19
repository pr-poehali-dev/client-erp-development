import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import MemberSearch from "@/components/ui/member-search";
import { Member, SavingsScheduleItem, Organization } from "@/lib/api";
import api from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

interface SavingsCreateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: {
    contract_no: string;
    member_id: string;
    amount: string;
    rate: string;
    term_months: string;
    payout_type: string;
    start_date: string;
    min_balance_pct: string;
    org_id: string;
  };
  setForm: (v: {
    contract_no: string;
    member_id: string;
    amount: string;
    rate: string;
    term_months: string;
    payout_type: string;
    start_date: string;
    min_balance_pct: string;
    org_id: string;
  }) => void;
  members: Member[];
  orgs: Organization[];
  saving: boolean;
  onCreate: () => void;
}

const SavingsCreateDialog = (props: SavingsCreateDialogProps) => {
  const { open, onOpenChange, form, setForm, members, orgs, saving, onCreate } = props;
  const [preview, setPreview] = useState<SavingsScheduleItem[] | null>(null);

  const handleCalc = async () => {
    if (!form.amount || !form.rate || !form.term_months) return;
    const res = await api.savings.calcSchedule(Number(form.amount), Number(form.rate), Number(form.term_months), form.payout_type, form.start_date);
    setPreview(res.schedule);
  };

  const handleCreate = () => {
    onCreate();
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Новый договор сбережений</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div><Label>Номер договора (авто)</Label><Input value={form.contract_no} onChange={e => setForm({ ...form, contract_no: e.target.value })} /></div>
            <div><Label>Пайщик</Label><MemberSearch members={members} value={form.member_id} onChange={v => setForm({ ...form, member_id: v })} /></div>
            <div><Label>Сумма вклада</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Ставка (%)</Label><Input type="number" step="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
            <div><Label>Срок (мес.)</Label><Input type="number" value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} /></div>
            <div><Label>Выплата процентов</Label><Select value={form.payout_type} onValueChange={v => setForm({ ...form, payout_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Ежемесячно</SelectItem><SelectItem value="end_of_term">В конце срока</SelectItem></SelectContent></Select></div>
            <div><Label>Дата начала</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Неснижаемый остаток (%)</Label><Input type="number" step="0.01" value={form.min_balance_pct} onChange={e => setForm({ ...form, min_balance_pct: e.target.value })} placeholder="0" /></div>
            <div><Label>Организация</Label><Select value={form.org_id} onValueChange={v => setForm({ ...form, org_id: v })}><SelectTrigger><SelectValue placeholder="Выберите организацию" /></SelectTrigger><SelectContent><SelectItem value="">Без организации</SelectItem>{orgs.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.short_name || o.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2">
            <Button onClick={handleCalc} disabled={!form.amount || !form.rate || !form.term_months} className="w-full"><Icon name="Calculator" size={16} className="mr-2" />Рассчитать график</Button>
            {preview && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">График доходности</CardTitle></CardHeader>
                <CardContent className="max-h-80 overflow-y-auto">
                  <div className="space-y-1 text-xs">
                    {preview.map((p, i) => (
                      <div key={i} className="flex justify-between border-b pb-1">
                        <span>{fmtDate(p.period_end)}</span>
                        <span className="font-medium">{fmt(p.interest_amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-bold">
                      <span>Итого:</span>
                      <span>{fmt(preview.reduce((s, p) => s + p.interest_amount, 0))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <DialogFooter><Button onClick={handleCreate} disabled={saving || !form.member_id}>Создать</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SavingsCreateDialog;
