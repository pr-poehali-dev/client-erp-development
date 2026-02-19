import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LoanDetail, ScheduleItem } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " ₽";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

interface LoansActionDialogsProps {
  detail: LoanDetail | null;
  saving: boolean;

  showPayment: boolean;
  setShowPayment: (v: boolean) => void;
  payForm: { amount: string; date: string };
  setPayForm: (v: { amount: string; date: string }) => void;
  handlePayment: (strategy?: string) => void;

  showEarly: boolean;
  setShowEarly: (v: boolean) => void;
  earlyForm: { amount: string; repayment_type: string; date: string };
  setEarlyForm: (v: { amount: string; repayment_type: string; date: string }) => void;
  earlyPreview: ScheduleItem[] | null;
  earlyMonthly: number;
  handleEarlyPreview: () => void;
  handleEarlyRepay: () => void;

  showModify: boolean;
  setShowModify: (v: boolean) => void;
  modifyForm: { new_rate: string; new_term: string };
  setModifyForm: (v: { new_rate: string; new_term: string }) => void;
  modifyPreview: ScheduleItem[] | null;
  modifyMonthly: number;
  handleModifyPreview: () => void;
  handleModify: () => void;

  showEditPayment: boolean;
  setShowEditPayment: (v: boolean) => void;
  editPayForm: { payment_id: number; payment_date: string; amount: string; principal_part: string; interest_part: string; penalty_part: string };
  setEditPayForm: (v: { payment_id: number; payment_date: string; amount: string; principal_part: string; interest_part: string; penalty_part: string }) => void;
  handleEditPayment: () => void;

  showOverpayChoice: boolean;
  setShowOverpayChoice: (v: boolean) => void;
  overpayOptions: Record<string, { new_monthly: number; new_term: number; description: string }>;
  overpayInfo: { overpay_amount: number; current_payment: number; total_amount: number };
  handlePayment: (strategy?: string) => void;
}

const LoansActionDialogs = (props: LoansActionDialogsProps) => {
  const { detail, saving } = props;

  return (
    <>
      <Dialog open={props.showPayment} onOpenChange={props.setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Внести платёж</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Остаток: {detail ? fmt(detail.balance) : "—"}</div>
            <div><Label>Сумма</Label><Input type="number" value={props.payForm.amount} onChange={e => props.setPayForm({ ...props.payForm, amount: e.target.value })} /></div>
            <div><Label>Дата</Label><Input type="date" value={props.payForm.date} onChange={e => props.setPayForm({ ...props.payForm, date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => props.handlePayment()} disabled={saving}>Внести</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.showEarly} onOpenChange={props.setShowEarly}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Досрочное погашение</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Текущий остаток: {detail ? fmt(detail.balance) : "—"}</div>
            <div><Label>Сумма</Label><Input type="number" value={props.earlyForm.amount} onChange={e => props.setEarlyForm({ ...props.earlyForm, amount: e.target.value })} /></div>
            <div><Label>Дата</Label><Input type="date" value={props.earlyForm.date} onChange={e => props.setEarlyForm({ ...props.earlyForm, date: e.target.value })} /></div>
            <div><Label>Тип погашения</Label><Select value={props.earlyForm.repayment_type} onValueChange={v => props.setEarlyForm({ ...props.earlyForm, repayment_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reduce_term">Сократить срок</SelectItem><SelectItem value="reduce_payment">Уменьшить платёж</SelectItem></SelectContent></Select></div>
            <Button onClick={props.handleEarlyPreview} disabled={!props.earlyForm.amount} size="sm" className="w-full">Показать новый график</Button>
            {props.earlyPreview && (
              <Card className="p-3 text-sm">
                <div className="font-medium mb-1">Новый график:</div>
                <div>Новый платёж: {fmt(props.earlyMonthly)}</div>
                <div>Периодов: {props.earlyPreview.length}</div>
              </Card>
            )}
          </div>
          <DialogFooter><Button onClick={props.handleEarlyRepay} disabled={saving}>Погасить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.showModify} onOpenChange={props.setShowModify}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Изменить условия</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Текущая ставка: {detail ? detail.rate + "%" : "—"}, Срок: {detail ? detail.term_months + " мес." : "—"}</div>
            <div><Label>Новая ставка (%, оставить пустым = без изменений)</Label><Input type="number" step="0.01" value={props.modifyForm.new_rate} onChange={e => props.setModifyForm({ ...props.modifyForm, new_rate: e.target.value })} /></div>
            <div><Label>Новый срок (мес., оставить пустым = без изменений)</Label><Input type="number" value={props.modifyForm.new_term} onChange={e => props.setModifyForm({ ...props.modifyForm, new_term: e.target.value })} /></div>
            <Button onClick={props.handleModifyPreview} disabled={!props.modifyForm.new_rate && !props.modifyForm.new_term} size="sm" className="w-full">Показать новый график</Button>
            {props.modifyPreview && (
              <Card className="p-3 text-sm">
                <div className="font-medium mb-1">Новый график:</div>
                <div>Новый платёж: {fmt(props.modifyMonthly)}</div>
                <div>Периодов: {props.modifyPreview.length}</div>
              </Card>
            )}
          </div>
          <DialogFooter><Button onClick={props.handleModify} disabled={saving}>Изменить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.showEditPayment} onOpenChange={props.setShowEditPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактирование платежа</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Дата</Label><Input type="date" value={props.editPayForm.payment_date} onChange={e => props.setEditPayForm({ ...props.editPayForm, payment_date: e.target.value })} /></div>
            <div><Label>Сумма</Label><Input type="number" value={props.editPayForm.amount} onChange={e => props.setEditPayForm({ ...props.editPayForm, amount: e.target.value })} /></div>
            <div><Label>Основной долг</Label><Input type="number" value={props.editPayForm.principal_part} onChange={e => props.setEditPayForm({ ...props.editPayForm, principal_part: e.target.value })} /></div>
            <div><Label>Проценты</Label><Input type="number" value={props.editPayForm.interest_part} onChange={e => props.setEditPayForm({ ...props.editPayForm, interest_part: e.target.value })} /></div>
            <div><Label>Штрафы</Label><Input type="number" value={props.editPayForm.penalty_part} onChange={e => props.setEditPayForm({ ...props.editPayForm, penalty_part: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={props.handleEditPayment} disabled={saving}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.showOverpayChoice} onOpenChange={props.setShowOverpayChoice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Выберите стратегию переплаты</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div>Сумма платежа: <span className="font-medium">{fmt(props.overpayInfo.total_amount)}</span></div>
              <div>Текущий платёж: <span className="font-medium">{fmt(props.overpayInfo.current_payment)}</span></div>
              <div className="text-green-600">Переплата: <span className="font-bold">{fmt(props.overpayInfo.overpay_amount)}</span></div>
            </div>
            <div className="space-y-2">
              {Object.entries(props.overpayOptions).map(([key, opt]) => (
                <Button key={key} variant="outline" className="w-full justify-start h-auto p-3" onClick={() => props.handlePayment(key)}>
                  <div className="text-left">
                    <div className="font-medium">{opt.description}</div>
                    <div className="text-xs text-muted-foreground">Новый платёж: {fmt(opt.new_monthly)} · Срок: {opt.new_term} мес.</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoansActionDialogs;
