import { useState } from "react";
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

interface Loan {
  id: string;
  contractNo: string;
  memberName: string;
  amount: string;
  rate: string;
  term: string;
  monthlyPayment: string;
  startDate: string;
  endDate: string;
  balance: string;
  status: string;
  scheduleType: string;
  [key: string]: unknown;
}

const mockLoans: Loan[] = [
  { id: "1", contractNo: "Л-2024-001", memberName: "Иванов И.И.", amount: "500 000 ₽", rate: "18%", term: "12 мес.", monthlyPayment: "45 839 ₽", startDate: "15.01.2024", endDate: "31.01.2025", balance: "287 500 ₽", status: "Активен", scheduleType: "Аннуитет" },
  { id: "2", contractNo: "Л-2024-015", memberName: "Петрова А.С.", amount: "1 200 000 ₽", rate: "16%", term: "24 мес.", monthlyPayment: "58 421 ₽", startDate: "01.03.2024", endDate: "28.02.2026", balance: "980 000 ₽", status: "Активен", scheduleType: "Аннуитет" },
  { id: "3", contractNo: "Л-2024-038", memberName: "Морозова Е.К.", amount: "300 000 ₽", rate: "20%", term: "6 мес.", monthlyPayment: "55 000 ₽", startDate: "10.05.2024", endDate: "30.11.2024", balance: "34 500 ₽", status: "Просрочен", scheduleType: "В конце срока" },
  { id: "4", contractNo: "Л-2024-052", memberName: "Козлов В.А.", amount: "800 000 ₽", rate: "17%", term: "18 мес.", monthlyPayment: "49 876 ₽", startDate: "20.06.2024", endDate: "31.12.2025", balance: "612 000 ₽", status: "Просрочен", scheduleType: "Аннуитет" },
  { id: "5", contractNo: "Л-2024-071", memberName: "ООО «Рассвет»", amount: "2 000 000 ₽", rate: "15%", term: "36 мес.", monthlyPayment: "69 332 ₽", startDate: "01.08.2024", endDate: "31.07.2027", balance: "1 856 000 ₽", status: "Активен", scheduleType: "Аннуитет" },
  { id: "6", contractNo: "Л-2023-120", memberName: "Белов Д.С.", amount: "150 000 ₽", rate: "19%", term: "6 мес.", monthlyPayment: "27 500 ₽", startDate: "01.10.2023", endDate: "31.03.2024", balance: "0 ₽", status: "Закрыт", scheduleType: "Аннуитет" },
];

const scheduleData = [
  { n: 1, date: "31.01.2025", payment: "45 839 ₽", principal: "38 339 ₽", interest: "7 500 ₽", balance: "461 661 ₽", status: "Оплачен" },
  { n: 2, date: "28.02.2025", payment: "45 839 ₽", principal: "38 914 ₽", interest: "6 925 ₽", balance: "422 747 ₽", status: "Оплачен" },
  { n: 3, date: "31.03.2025", payment: "45 839 ₽", principal: "39 498 ₽", interest: "6 341 ₽", balance: "383 249 ₽", status: "Ожидается" },
  { n: 4, date: "30.04.2025", payment: "45 839 ₽", principal: "40 091 ₽", interest: "5 748 ₽", balance: "343 158 ₽", status: "Ожидается" },
  { n: 5, date: "31.05.2025", payment: "45 839 ₽", principal: "40 692 ₽", interest: "5 147 ₽", balance: "302 466 ₽", status: "Ожидается" },
  { n: 6, date: "30.06.2025", payment: "45 839 ₽", principal: "41 303 ₽", interest: "4 536 ₽", balance: "261 163 ₽", status: "Ожидается" },
];

const statusColor = (status: string) => {
  switch (status) {
    case "Активен": return "default";
    case "Просрочен": return "destructive";
    case "Закрыт": return "secondary";
    default: return "outline";
  }
};

const columns: Column<Loan>[] = [
  { key: "contractNo", label: "Договор", className: "font-medium" },
  { key: "memberName", label: "Пайщик" },
  { key: "amount", label: "Сумма" },
  { key: "rate", label: "Ставка" },
  { key: "term", label: "Срок" },
  { key: "monthlyPayment", label: "Платёж" },
  { key: "balance", label: "Остаток" },
  { key: "scheduleType", label: "График", render: (item) => <span className="text-xs">{item.scheduleType}</span> },
  {
    key: "status",
    label: "Статус",
    render: (item) => (
      <Badge variant={statusColor(item.status) as "default" | "destructive" | "secondary" | "outline"} className="text-xs">
        {item.status}
      </Badge>
    ),
  },
];

const Loans = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const filtered = mockLoans.filter(
    (l) =>
      l.contractNo.toLowerCase().includes(search.toLowerCase()) ||
      l.memberName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Займы"
        description={`${mockLoans.filter(l => l.status === "Активен").length} активных из ${mockLoans.length} договоров`}
        actionLabel="Новый договор"
        actionIcon="Plus"
        onAction={() => setShowForm(true)}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Портфель займов</div>
          <div className="text-xl font-bold">85.4 млн ₽</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Средняя ставка</div>
          <div className="text-xl font-bold">17.2%</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Просроченных</div>
          <div className="text-xl font-bold text-destructive">2</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Собрано % за месяц</div>
          <div className="text-xl font-bold text-success">1.23 млн ₽</div>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по договору, пайщику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Icon name="Filter" size={16} />
          Фильтры
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(loan) => { setSelectedLoan(loan); setShowDetail(true); }}
        emptyMessage="Договоры не найдены"
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый договор займа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Пайщик</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Выберите пайщика" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Иванов Иван Иванович (П-001)</SelectItem>
                  <SelectItem value="2">Петрова Анна Сергеевна (П-002)</SelectItem>
                  <SelectItem value="3">ООО «Рассвет» (П-003)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Номер договора</Label>
              <Input placeholder="Л-2024-088" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Сумма займа, ₽</Label>
                <Input type="number" placeholder="500000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ставка, % годовых</Label>
                <Input type="number" placeholder="18" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Срок, месяцев</Label>
                <Input type="number" placeholder="12" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Вариант графика</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annuity">Аннуитет</SelectItem>
                    <SelectItem value="end">В конце срока</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button className="gap-2">
                <Icon name="Calculator" size={16} />
                Рассчитать и сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Договор {selectedLoan?.contractNo}</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Пайщик</div>
                  <div className="text-sm font-medium">{selectedLoan.memberName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Сумма</div>
                  <div className="text-sm font-medium">{selectedLoan.amount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Ставка</div>
                  <div className="text-sm font-medium">{selectedLoan.rate}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Остаток</div>
                  <div className="text-sm font-bold text-primary">{selectedLoan.balance}</div>
                </div>
              </div>

              <Tabs defaultValue="schedule">
                <TabsList>
                  <TabsTrigger value="schedule">График платежей</TabsTrigger>
                  <TabsTrigger value="payments">Платежи</TabsTrigger>
                  <TabsTrigger value="actions">Действия</TabsTrigger>
                </TabsList>

                <TabsContent value="schedule" className="mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">График платежей ({selectedLoan.scheduleType})</CardTitle>
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Icon name="Download" size={14} />
                          Экспорт
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left py-2 px-2">№</th>
                              <th className="text-left py-2 px-2">Дата</th>
                              <th className="text-right py-2 px-2">Платёж</th>
                              <th className="text-right py-2 px-2">Осн. долг</th>
                              <th className="text-right py-2 px-2">Проценты</th>
                              <th className="text-right py-2 px-2">Остаток</th>
                              <th className="text-center py-2 px-2">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scheduleData.map((row) => (
                              <tr key={row.n} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-2 px-2">{row.n}</td>
                                <td className="py-2 px-2">{row.date}</td>
                                <td className="py-2 px-2 text-right font-medium">{row.payment}</td>
                                <td className="py-2 px-2 text-right">{row.principal}</td>
                                <td className="py-2 px-2 text-right">{row.interest}</td>
                                <td className="py-2 px-2 text-right">{row.balance}</td>
                                <td className="py-2 px-2 text-center">
                                  <Badge
                                    variant={row.status === "Оплачен" ? "default" : "outline"}
                                    className="text-xs"
                                  >
                                    {row.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  <Card className="p-6">
                    <div className="text-center text-muted-foreground">
                      <Icon name="CreditCard" size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Внесение платежей будет доступно после подключения бэкенда</p>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="actions" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <Icon name="CreditCard" size={16} />
                        <span className="font-medium text-sm">Внести платёж</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Указать дату и сумму платежа</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <Icon name="FastForward" size={16} />
                        <span className="font-medium text-sm">Досрочное погашение</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Частичное или полное</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <Icon name="Settings2" size={16} />
                        <span className="font-medium text-sm">Изменить параметры</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Срок, ставка, перерасчёт</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <Icon name="FileText" size={16} />
                        <span className="font-medium text-sm">Выписка по счёту</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Экспорт в .xlsx и .pdf</span>
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Loans;
