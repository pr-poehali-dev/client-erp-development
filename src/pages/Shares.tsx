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

interface Share {
  id: string;
  accountNo: string;
  memberName: string;
  balance: string;
  totalIn: string;
  totalOut: string;
  lastOperation: string;
  status: string;
  [key: string]: unknown;
}

const mockShares: Share[] = [
  { id: "1", accountNo: "ПС-000001", memberName: "Иванов И.И.", balance: "50 000 ₽", totalIn: "75 000 ₽", totalOut: "25 000 ₽", lastOperation: "10.01.2025", status: "Активен" },
  { id: "2", accountNo: "ПС-000002", memberName: "Петрова А.С.", balance: "25 000 ₽", totalIn: "25 000 ₽", totalOut: "0 ₽", lastOperation: "22.06.2024", status: "Активен" },
  { id: "3", accountNo: "ПС-000003", memberName: "ООО «Рассвет»", balance: "150 000 ₽", totalIn: "200 000 ₽", totalOut: "50 000 ₽", lastOperation: "05.12.2024", status: "Активен" },
  { id: "4", accountNo: "ПС-000004", memberName: "Козлов В.А.", balance: "10 000 ₽", totalIn: "10 000 ₽", totalOut: "0 ₽", lastOperation: "05.09.2023", status: "Активен" },
  { id: "5", accountNo: "ПС-000005", memberName: "Морозова Е.К.", balance: "35 000 ₽", totalIn: "60 000 ₽", totalOut: "25 000 ₽", lastOperation: "18.11.2024", status: "Активен" },
];

const columns: Column<Share>[] = [
  { key: "accountNo", label: "Номер счёта", className: "font-medium" },
  { key: "memberName", label: "Пайщик" },
  { key: "balance", label: "Баланс", className: "font-semibold" },
  { key: "totalIn", label: "Всего внесено" },
  { key: "totalOut", label: "Всего выплачено" },
  { key: "lastOperation", label: "Посл. операция" },
  {
    key: "status",
    label: "Статус",
    render: (item) => (
      <Badge variant="default" className="text-xs">{item.status}</Badge>
    ),
  },
];

const Shares = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showOperation, setShowOperation] = useState(false);

  const filtered = mockShares.filter(
    (s) =>
      s.accountNo.toLowerCase().includes(search.toLowerCase()) ||
      s.memberName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Паевые счета"
        description={`${mockShares.length} счетов, общий фонд 4.87 млн ₽`}
        actionLabel="Открыть счёт"
        actionIcon="Plus"
        onAction={() => setShowForm(true)}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Паевой фонд</div>
          <div className="text-xl font-bold">4.87 млн ₽</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Всего счетов</div>
          <div className="text-xl font-bold">{mockShares.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Средний взнос</div>
          <div className="text-xl font-bold">54 000 ₽</div>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру, пайщику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowOperation(true)}>
          <Icon name="ArrowUpDown" size={16} />
          Операция
        </Button>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="Счета не найдены" />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Открыть паевой счёт</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Пайщик</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Выберите пайщика" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Иванов Иван Иванович (П-001)</SelectItem>
                  <SelectItem value="2">Петрова Анна Сергеевна (П-002)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Сумма паевого взноса, ₽</Label>
              <Input type="number" placeholder="10000" />
            </div>
            <p className="text-xs text-muted-foreground">Номер счёта будет сформирован автоматически</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button className="gap-2">
                <Icon name="Save" size={16} />
                Открыть счёт
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOperation} onOpenChange={setShowOperation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Операция по паевому счёту</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Паевой счёт</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Выберите счёт" /></SelectTrigger>
                <SelectContent>
                  {mockShares.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.accountNo} — {s.memberName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип операции</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Внесение взноса</SelectItem>
                  <SelectItem value="out">Выплата взноса</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Сумма, ₽</Label>
              <Input type="number" placeholder="10000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Дата операции</Label>
              <Input type="date" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowOperation(false)}>Отмена</Button>
              <Button className="gap-2">
                <Icon name="Check" size={16} />
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
