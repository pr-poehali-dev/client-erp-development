import { useState } from "react";
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

interface Saving {
  id: string;
  contractNo: string;
  memberName: string;
  amount: string;
  rate: string;
  term: string;
  accrued: string;
  startDate: string;
  endDate: string;
  payoutType: string;
  status: string;
  [key: string]: unknown;
}

const mockSavings: Saving[] = [
  { id: "1", contractNo: "С-2024-001", memberName: "Петрова А.С.", amount: "1 000 000 ₽", rate: "12%", term: "12 мес.", accrued: "45 000 ₽", startDate: "01.02.2024", endDate: "01.02.2025", payoutType: "Ежемесячно", status: "Активен" },
  { id: "2", contractNo: "С-2024-010", memberName: "Морозова Е.К.", amount: "500 000 ₽", rate: "14%", term: "24 мес.", accrued: "87 500 ₽", startDate: "15.03.2024", endDate: "15.03.2026", payoutType: "В конце срока", status: "Активен" },
  { id: "3", contractNo: "С-2024-018", memberName: "Иванов И.И.", amount: "2 500 000 ₽", rate: "11%", term: "6 мес.", accrued: "68 750 ₽", startDate: "01.05.2024", endDate: "01.11.2024", payoutType: "Ежемесячно", status: "Активен" },
  { id: "4", contractNo: "С-2023-055", memberName: "Белов Д.С.", amount: "300 000 ₽", rate: "10%", term: "12 мес.", accrued: "30 000 ₽", startDate: "01.06.2023", endDate: "01.06.2024", payoutType: "В конце срока", status: "Закрыт" },
];

const columns: Column<Saving>[] = [
  { key: "contractNo", label: "Договор", className: "font-medium" },
  { key: "memberName", label: "Пайщик" },
  { key: "amount", label: "Сумма вклада" },
  { key: "rate", label: "Ставка" },
  { key: "term", label: "Срок" },
  { key: "accrued", label: "Начислено %" },
  { key: "payoutType", label: "Выплата", render: (item) => <span className="text-xs">{item.payoutType}</span> },
  { key: "endDate", label: "Окончание" },
  {
    key: "status",
    label: "Статус",
    render: (item) => (
      <Badge variant={item.status === "Активен" ? "default" : "secondary"} className="text-xs">
        {item.status}
      </Badge>
    ),
  },
];

const Savings = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = mockSavings.filter(
    (s) =>
      s.contractNo.toLowerCase().includes(search.toLowerCase()) ||
      s.memberName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Сбережения"
        description={`${mockSavings.filter(s => s.status === "Активен").length} активных договоров`}
        actionLabel="Новый договор"
        actionIcon="Plus"
        onAction={() => setShowForm(true)}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Общая сумма вкладов</div>
          <div className="text-xl font-bold">58.2 млн ₽</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Средняя ставка</div>
          <div className="text-xl font-bold">11.8%</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Начислено % за месяц</div>
          <div className="text-xl font-bold">572 000 ₽</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Истекает в этом месяце</div>
          <div className="text-xl font-bold text-warning">3</div>
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

      <DataTable columns={columns} data={filtered} emptyMessage="Договоры не найдены" />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый договор сбережений</DialogTitle>
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
              <Input placeholder="С-2024-020" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Сумма вклада, ₽</Label>
                <Input type="number" placeholder="1000000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ставка, % годовых</Label>
                <Input type="number" placeholder="12" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Срок, месяцев</Label>
                <Input type="number" placeholder="12" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Вариант выплаты</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
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
    </div>
  );
};

export default Savings;
