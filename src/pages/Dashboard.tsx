import { useState, useEffect } from "react";
import StatCard from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import api, { DashboardStats } from "@/lib/api";

const formatMoney = (val: number) => {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + " млн ₽";
  if (val >= 1000) return (val / 1000).toFixed(0) + " тыс. ₽";
  return val.toFixed(0) + " ₽";
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">Обзор деятельности кооператива</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего пайщиков"
          value={String(stats?.total_members || 0)}
          icon="Users"
          iconColor="bg-primary/10 text-primary"
        />
        <StatCard
          title="Активные займы"
          value={String(stats?.active_loans || 0)}
          change={formatMoney(stats?.loan_portfolio || 0) + " портфель"}
          changeType="neutral"
          icon="Landmark"
          iconColor="bg-orange-100 text-orange-600"
        />
        <StatCard
          title="Сбережения"
          value={formatMoney(stats?.total_savings || 0)}
          icon="PiggyBank"
          iconColor="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Просрочка"
          value={String(stats?.overdue_loans || 0)}
          icon="AlertTriangle"
          iconColor="bg-red-100 text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Landmark" size={18} className="text-primary" />
            </div>
            <div className="text-sm font-semibold">Портфель займов</div>
          </div>
          <div className="text-2xl font-bold">{formatMoney(stats?.loan_portfolio || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Активные договоры: {stats?.active_loans || 0}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Icon name="PiggyBank" size={18} className="text-emerald-600" />
            </div>
            <div className="text-sm font-semibold">Сбережения</div>
          </div>
          <div className="text-2xl font-bold">{formatMoney(stats?.total_savings || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Привлечённые средства</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <Icon name="Wallet" size={18} className="text-violet-600" />
            </div>
            <div className="text-sm font-semibold">Паевой фонд</div>
          </div>
          <div className="text-2xl font-bold">{formatMoney(stats?.total_shares || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Общая сумма взносов</div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
