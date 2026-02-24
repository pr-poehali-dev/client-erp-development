import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import MemberSearch from "@/components/ui/member-search";
import { Member, Organization } from "@/lib/api";

interface EditForm {
  contract_no: string;
  member_id: string;
  amount: string;
  rate: string;
  term_months: string;
  payout_type: string;
  start_date: string;
  min_balance_pct: string;
  org_id: string;
}

interface SavingsEditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: EditForm;
  setForm: (v: EditForm) => void;
  members: Member[];
  orgs: Organization[];
  saving: boolean;
  onSave: () => void;
}

const SavingsEditDialog = (props: SavingsEditDialogProps) => {
  const { open, onOpenChange, form, setForm, members, orgs, saving, onSave } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle><Icon name="Pencil" size={18} className="inline mr-2" />Редактирование договора</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Номер договора</Label><Input value={form.contract_no} onChange={e => setForm({ ...form, contract_no: e.target.value })} /></div>
          <div><Label>Пайщик</Label><MemberSearch members={members} value={form.member_id} onChange={v => setForm({ ...form, member_id: v })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Сумма вклада</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Ставка (%)</Label><Input type="number" step="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Срок (мес.)</Label><Input type="number" value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} /></div>
            <div><Label>Выплата процентов</Label><Select value={form.payout_type} onValueChange={v => setForm({ ...form, payout_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Ежемесячно</SelectItem><SelectItem value="end_of_term">В конце срока</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Дата начала</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Неснижаемый остаток (%)</Label><Input type="number" step="0.01" value={form.min_balance_pct} onChange={e => setForm({ ...form, min_balance_pct: e.target.value })} placeholder="0" /></div>
          </div>
          <div><Label>Организация</Label><Select value={form.org_id || "none"} onValueChange={v => setForm({ ...form, org_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Выберите организацию" /></SelectTrigger><SelectContent><SelectItem value="none">Без организации</SelectItem>{orgs.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.short_name || o.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
            <Icon name="AlertTriangle" size={14} className="inline mr-1" />
            После сохранения график начислений будет автоматически пересчитан.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSave} disabled={saving || !form.member_id || !form.amount || !form.rate || !form.term_months}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SavingsEditDialog;
