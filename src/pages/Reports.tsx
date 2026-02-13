import PageHeader from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";

const reportCards = [
  {
    icon: "FileBarChart",
    title: "Баланс пайщика",
    desc: "Список договоров, остатки, проценты и штрафы за период",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: "FileText",
    title: "Выписка по займу",
    desc: "Детальные транзакции по договору займа",
    color: "bg-orange-100 text-orange-600",
  },
  {
    icon: "FileText",
    title: "Выписка по сбережениям",
    desc: "Транзакции по договору сбережений",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: "BarChart3",
    title: "Портфель займов",
    desc: "Общая аналитика по портфелю займов",
    color: "bg-violet-100 text-violet-600",
  },
  {
    icon: "PieChart",
    title: "Структура вкладов",
    desc: "Распределение по срокам и ставкам",
    color: "bg-pink-100 text-pink-600",
  },
  {
    icon: "AlertTriangle",
    title: "Просроченная задолженность",
    desc: "Реестр просроченных платежей и штрафов",
    color: "bg-red-100 text-red-600",
  },
];

const Reports = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Отчётность и аналитика"
        description="Формирование отчётов и выписок"
      />

      <Card className="p-5">
        <div className="flex items-end gap-4">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label className="text-xs">Период с</Label>
            <Input type="date" defaultValue="2024-01-01" />
          </div>
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label className="text-xs">Период по</Label>
            <Input type="date" defaultValue="2025-02-13" />
          </div>
          <Button className="gap-2">
            <Icon name="RefreshCw" size={16} />
            Применить
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((report, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${report.color}`}>
                  <Icon name={report.icon} size={20} />
                </div>
                <CardTitle className="text-sm">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">{report.desc}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Icon name="Eye" size={14} />
                  Просмотр
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Icon name="FileSpreadsheet" size={14} />
                  .xlsx
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Icon name="FileDown" size={14} />
                  .pdf
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reports;
