import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import api, { CabinetOverview, LoanDetail, CabinetSavingDetail, Loan, Saving, ShareAccount, ScheduleItem, SavingsScheduleItem } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " \u20BD";
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

const statusLabel: Record<string, string> = { active: "Активен", overdue: "Просрочен", closed: "Закрыт", pending: "Ожидается", paid: "Оплачен", partial: "Частично" };
const statusVariant = (s: string) => s === "active" || s === "paid" ? "default" : s === "overdue" ? "destructive" : "secondary";

const Cabinet = () => {
  const [data, setData] = useState<CabinetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [loanDetail, setLoanDetail] = useState<LoanDetail | null>(null);
  const [savingDetail, setSavingDetail] = useState<CabinetSavingDetail | null>(null);
  const [showLoan, setShowLoan] = useState(false);
  const [showSaving, setShowSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ old: "", new_pw: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const token = localStorage.getItem("cabinet_token") || "";

  useEffect(() => {
    if (!token) { navigate("/cabinet/login"); return; }
    const user = localStorage.getItem("cabinet_user");
    if (user) { try { setUserName(JSON.parse(user).name); } catch { /* skip */ } }
    api.cabinet.overview(token).then(setData).catch(() => {
      localStorage.removeItem("cabinet_token");
      localStorage.removeItem("cabinet_user");
      navigate("/cabinet/login");
    }).finally(() => setLoading(false));
  }, [token, navigate]);

  const handleLogout = async () => {
    await api.auth.logout(token);
    localStorage.removeItem("cabinet_token");
    localStorage.removeItem("cabinet_user");
    navigate("/cabinet/login");
  };

  const openLoan = async (loan: Loan) => {
    const d = await api.cabinet.loanDetail(token, loan.id);
    setLoanDetail(d);
    setShowLoan(true);
  };

  const openSaving = async (s: Saving) => {
    const d = await api.cabinet.savingDetail(token, s.id);
    setSavingDetail(d);
    setShowSaving(true);
  };

  const handleChangePassword = async () => {
    if (pwForm.new_pw.length < 6) {
      toast({ title: "Пароль должен быть не менее 6 символов", variant: "destructive" });
      return;
    }
    if (pwForm.new_pw !== pwForm.confirm) {
      toast({ title: "Пароли не совпадают", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      const res = await api.auth.changePassword(token, pwForm.old, pwForm.new_pw);
      if (res.success) {
        toast({ title: "Пароль изменён" });
        setShowPassword(false);
        setPwForm({ old: "", new_pw: "", confirm: "" });
      }
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
      <Icon name="Loader2" size={40} className="animate-spin text-primary" />
    </div>
  );

  if (!data) return null;

  const totalLoanBalance = data.loans.filter(l => l.status === "active").reduce((s, l) => s + l.balance, 0);
  const totalSavings = data.savings.filter(s => s.status === "active").reduce((s, i) => s + (i.current_balance || i.amount), 0);
  const totalShares = data.shares.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Icon name="Shield" size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">{userName}</div>
              <div className="text-xs text-muted-foreground">{data.info.member_no}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => { setPwForm({ old: "", new_pw: "", confirm: "" }); setShowPassword(true); }}>
              <Icon name="Lock" size={14} />Сменить пароль
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive" onClick={handleLogout}>
              <Icon name="LogOut" size={14} />Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><Icon name="TrendingDown" size={20} className="text-red-500" /></div>
              <div>
                <div className="text-xs text-muted-foreground">Задолженность по займам</div>
                <div className="text-lg font-bold">{fmt(totalLoanBalance)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><Icon name="PiggyBank" size={20} className="text-green-600" /></div>
              <div>
                <div className="text-xs text-muted-foreground">Сбережения</div>
                <div className="text-lg font-bold">{fmt(totalSavings)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Icon name="Wallet" size={20} className="text-blue-600" /></div>
              <div>
                <div className="text-xs text-muted-foreground">Паевые взносы</div>
                <div className="text-lg font-bold">{fmt(totalShares)}</div>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="loans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="loans" className="gap-1.5"><Icon name="FileText" size={14} />Займы ({data.loans.length})</TabsTrigger>
            <TabsTrigger value="savings" className="gap-1.5"><Icon name="PiggyBank" size={14} />Сбережения ({data.savings.length})</TabsTrigger>
            <TabsTrigger value="shares" className="gap-1.5"><Icon name="Wallet" size={14} />Паевые ({data.shares.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="loans" className="space-y-3">
            {data.loans.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">У вас нет договоров займа</Card>
            ) : data.loans.map(loan => (
              <Card key={loan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openLoan(loan)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon name="FileText" size={16} className="text-muted-foreground" />
                      <span className="font-semibold text-sm">{loan.contract_no}</span>
                    </div>
                    <Badge variant={statusVariant(loan.status) as "default"|"destructive"|"secondary"} className="text-xs">{statusLabel[loan.status] || loan.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-xs text-muted-foreground">Сумма</div><div className="font-medium">{fmt(loan.amount)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Ставка</div><div className="font-medium">{loan.rate}%</div></div>
                    <div><div className="text-xs text-muted-foreground">Платёж</div><div className="font-medium">{fmt(loan.monthly_payment)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Остаток</div><div className="font-bold text-primary">{fmt(loan.balance)}</div></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{fmtDate(loan.start_date)} — {fmtDate(loan.end_date)} / {loan.term_months} мес.</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="savings" className="space-y-3">
            {data.savings.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">У вас нет договоров сбережений</Card>
            ) : data.savings.map(s => (
              <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openSaving(s)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon name="PiggyBank" size={16} className="text-muted-foreground" />
                      <span className="font-semibold text-sm">{s.contract_no}</span>
                    </div>
                    <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs">{s.status === "active" ? "Активен" : "Закрыт"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-xs text-muted-foreground">Сумма вклада</div><div className="font-medium">{fmt(s.amount)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Ставка</div><div className="font-medium">{s.rate}%</div></div>
                    <div><div className="text-xs text-muted-foreground">Начислено %</div><div className="font-medium text-green-600">{fmt(s.accrued_interest)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Баланс</div><div className="font-bold text-primary">{fmt(s.current_balance || s.amount)}</div></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{fmtDate(s.start_date)} — {fmtDate(s.end_date)} / {s.term_months} мес. / {s.payout_type === "monthly" ? "Ежемесячно" : "В конце срока"}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="shares" className="space-y-3">
            {data.shares.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">У вас нет паевых счетов</Card>
            ) : data.shares.map((a: ShareAccount) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon name="Wallet" size={16} className="text-muted-foreground" />
                      <span className="font-semibold text-sm">{a.account_no}</span>
                    </div>
                    <Badge variant="default" className="text-xs">Активен</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><div className="text-xs text-muted-foreground">Баланс</div><div className="font-bold text-primary">{fmt(a.balance)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Всего внесено</div><div className="font-medium">{fmt(a.total_in)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Всего выплачено</div><div className="font-medium">{fmt(a.total_out)}</div></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showLoan} onOpenChange={setShowLoan}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Договор {loanDetail?.contract_no}</DialogTitle></DialogHeader>
          {loanDetail && <LoanDetailView loan={loanDetail} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showSaving} onOpenChange={setShowSaving}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Договор {savingDetail?.contract_no}</DialogTitle></DialogHeader>
          {savingDetail && <SavingDetailView saving={savingDetail} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showPassword} onOpenChange={setShowPassword}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Смена пароля</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Текущий пароль</Label>
              <Input type="password" value={pwForm.old} onChange={e => setPwForm(p => ({ ...p, old: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Новый пароль</Label>
              <Input type="password" value={pwForm.new_pw} onChange={e => setPwForm(p => ({ ...p, new_pw: e.target.value }))} placeholder="Минимум 6 символов" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Подтвердите новый пароль</Label>
              <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleChangePassword()} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPassword(false)}>Отмена</Button>
              <Button onClick={handleChangePassword} disabled={savingPw || pwForm.new_pw.length < 6} className="gap-2">
                {savingPw ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Lock" size={16} />}
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LoanDetailView = ({ loan }: { loan: LoanDetail }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div><div className="text-xs text-muted-foreground">Сумма</div><div className="text-sm font-medium">{fmt(loan.amount)}</div></div>
      <div><div className="text-xs text-muted-foreground">Ставка</div><div className="text-sm font-medium">{loan.rate}%</div></div>
      <div><div className="text-xs text-muted-foreground">Срок</div><div className="text-sm font-medium">{loan.term_months} мес.</div></div>
      <div><div className="text-xs text-muted-foreground">Платёж</div><div className="text-sm font-medium">{fmt(loan.monthly_payment)}</div></div>
      <div><div className="text-xs text-muted-foreground">Остаток</div><div className="text-sm font-bold text-primary">{fmt(loan.balance)}</div></div>
    </div>

    <Tabs defaultValue="schedule">
      <TabsList>
        <TabsTrigger value="schedule">График платежей</TabsTrigger>
        <TabsTrigger value="payments">Платежи ({loan.payments.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="mt-3">
        <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0"><tr className="text-xs text-muted-foreground">
              <th className="text-left py-2 px-3">N</th><th className="text-left py-2 px-3">Дата</th>
              <th className="text-right py-2 px-3">Платёж</th><th className="text-right py-2 px-3">Осн. долг</th>
              <th className="text-right py-2 px-3">Проценты</th><th className="text-right py-2 px-3">Остаток</th>
              <th className="text-center py-2 px-3">Статус</th>
            </tr></thead>
            <tbody>{loan.schedule.map((r: ScheduleItem) => (
              <tr key={r.payment_no} className="border-t hover:bg-muted/30">
                <td className="py-2 px-3">{r.payment_no}</td>
                <td className="py-2 px-3">{fmtDate(r.payment_date)}</td>
                <td className="py-2 px-3 text-right font-medium">{fmt(r.payment_amount)}</td>
                <td className="py-2 px-3 text-right">{fmt(r.principal_amount)}</td>
                <td className="py-2 px-3 text-right">{fmt(r.interest_amount)}</td>
                <td className="py-2 px-3 text-right">{fmt(r.balance_after)}</td>
                <td className="py-2 px-3 text-center">
                  <Badge variant={statusVariant(r.status || "pending") as "default"|"destructive"|"secondary"} className="text-xs">
                    {statusLabel[r.status || "pending"] || r.status}
                  </Badge>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="payments" className="mt-3">
        {loan.payments.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">Платежей пока нет</Card>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-xs text-muted-foreground">
                <th className="text-left py-2 px-3">Дата</th><th className="text-right py-2 px-3">Сумма</th>
                <th className="text-right py-2 px-3">Осн. долг</th><th className="text-right py-2 px-3">Проценты</th>
                <th className="text-right py-2 px-3">Штрафы</th>
              </tr></thead>
              <tbody>{loan.payments.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 px-3">{fmtDate(p.payment_date)}</td>
                  <td className="py-2 px-3 text-right font-medium">{fmt(p.amount)}</td>
                  <td className="py-2 px-3 text-right">{fmt(p.principal_part)}</td>
                  <td className="py-2 px-3 text-right">{fmt(p.interest_part)}</td>
                  <td className="py-2 px-3 text-right">{fmt(p.penalty_part)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  </div>
);

const SavingDetailView = ({ saving }: { saving: CabinetSavingDetail }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div><div className="text-xs text-muted-foreground">Сумма вклада</div><div className="text-sm font-medium">{fmt(saving.amount)}</div></div>
      <div><div className="text-xs text-muted-foreground">Ставка</div><div className="text-sm font-medium">{saving.rate}%</div></div>
      <div><div className="text-xs text-muted-foreground">Начислено %</div><div className="text-sm font-medium text-green-600">{fmt(saving.accrued_interest)}</div></div>
      <div><div className="text-xs text-muted-foreground">Баланс</div><div className="text-sm font-bold text-primary">{fmt(saving.current_balance || saving.amount)}</div></div>
    </div>
    <div className="text-xs text-muted-foreground">
      Период: {fmtDate(saving.start_date)} — {fmtDate(saving.end_date)} / {saving.term_months} мес. / {saving.payout_type === "monthly" ? "Ежемесячная выплата %" : "Выплата % в конце срока"}
    </div>

    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">График доходности</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0"><tr className="text-xs text-muted-foreground">
              <th className="text-left py-2 px-3">N</th><th className="text-left py-2 px-3">Период</th>
              <th className="text-right py-2 px-3">Проценты</th><th className="text-right py-2 px-3">Накоплено</th>
              <th className="text-right py-2 px-3">Баланс</th>
            </tr></thead>
            <tbody>{saving.schedule.map((r: SavingsScheduleItem) => (
              <tr key={r.period_no} className="border-t hover:bg-muted/30">
                <td className="py-2 px-3">{r.period_no}</td>
                <td className="py-2 px-3">{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</td>
                <td className="py-2 px-3 text-right font-medium text-green-600">{fmt(r.interest_amount)}</td>
                <td className="py-2 px-3 text-right">{fmt(r.cumulative_interest)}</td>
                <td className="py-2 px-3 text-right font-medium">{fmt(r.balance_after)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default Cabinet;