import StatCard from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";

const recentActivity = [
  { type: "loan", desc: "Новый договор займа №Л-2024-087", member: "Иванов И.И.", time: "10 мин назад", icon: "Landmark", color: "text-primary" },
  { type: "saving", desc: "Пополнение вклада +500 000 ₽", member: "Петрова А.С.", time: "25 мин назад", icon: "PiggyBank", color: "text-success" },
  { type: "payment", desc: "Внесён платёж по займу 45 200 ₽", member: "Сидоров К.М.", time: "1 час назад", icon: "CreditCard", color: "text-primary" },
  { type: "member", desc: "Зарегистрирован новый пайщик", member: "ООО «Рассвет»", time: "2 часа назад", icon: "UserPlus", color: "text-warning" },
  { type: "overdue", desc: "Просрочка платежа по займу №Л-2024-052", member: "Козлов В.А.", time: "3 часа назад", icon: "AlertTriangle", color: "text-destructive" },
];

const overdueLoans = [
  { member: "Козлов В.А.", contract: "Л-2024-052", days: 15, amount: "67 800 ₽" },
  { member: "Морозова Е.К.", contract: "Л-2024-038", days: 8, amount: "34 500 ₽" },
  { member: "Белов Д.С.", contract: "Л-2024-071", days: 3, amount: "12 900 ₽" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">Обзор деятельности кооператива</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего пайщиков"
          value="1 247"
          change="+12 за месяц"
          changeType="positive"
          icon="Users"
          iconColor="bg-primary/10 text-primary"
        />
        <StatCard
          title="Активные займы"
          value="342"
          change="85.4 млн ₽ портфель"
          changeType="neutral"
          icon="Landmark"
          iconColor="bg-orange-100 text-orange-600"
        />
        <StatCard
          title="Сбережения"
          value="58.2 млн ₽"
          change="+3.1 млн за месяц"
          changeType="positive"
          icon="PiggyBank"
          iconColor="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Просрочка"
          value="3"
          change="115 200 ₽ сумма"
          changeType="negative"
          icon="AlertTriangle"
          iconColor="bg-red-100 text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Последние операции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentActivity.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center ${item.color}`}>
                  <Icon name={item.icon} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.desc}</p>
                  <p className="text-xs text-muted-foreground">{item.member}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Просроченные займы</CardTitle>
              <Badge variant="destructive" className="text-xs">{overdueLoans.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueLoans.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border bg-destructive/5 border-destructive/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{item.member}</span>
                  <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                    {item.days} дн.
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Договор {item.contract}</span>
                  <span className="text-sm font-semibold text-destructive">{item.amount}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="TrendingUp" size={18} className="text-primary" />
            </div>
            <div className="text-sm font-semibold">Доход за месяц</div>
          </div>
          <div className="text-2xl font-bold">2.34 млн ₽</div>
          <div className="text-xs text-muted-foreground mt-1">Проценты по займам</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Icon name="ArrowDownLeft" size={18} className="text-emerald-600" />
            </div>
            <div className="text-sm font-semibold">Выдано займов</div>
          </div>
          <div className="text-2xl font-bold">12.5 млн ₽</div>
          <div className="text-xs text-muted-foreground mt-1">За текущий месяц</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <Icon name="Wallet" size={18} className="text-violet-600" />
            </div>
            <div className="text-sm font-semibold">Паевой фонд</div>
          </div>
          <div className="text-2xl font-bold">4.87 млн ₽</div>
          <div className="text-xs text-muted-foreground mt-1">Общая сумма взносов</div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
