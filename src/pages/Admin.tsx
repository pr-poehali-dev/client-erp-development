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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  [key: string]: unknown;
}

const mockUsers: User[] = [
  { id: "1", name: "Сергей Администраторов", email: "admin@kpk.ru", role: "Администратор", status: "Активен", lastLogin: "13.02.2025 09:15" },
  { id: "2", name: "Мария Менеджерова", email: "manager@kpk.ru", role: "Менеджер", status: "Активен", lastLogin: "13.02.2025 08:30" },
  { id: "3", name: "Алексей Операторов", email: "operator@kpk.ru", role: "Менеджер", status: "Активен", lastLogin: "12.02.2025 17:45" },
  { id: "4", name: "Иванов Иван Иванович", email: "ivanov@mail.ru", role: "Клиент", status: "Активен", lastLogin: "10.02.2025 14:20" },
  { id: "5", name: "Петрова Анна Сергеевна", email: "petrova@mail.ru", role: "Клиент", status: "Не активирован", lastLogin: "—" },
];

const roleColor = (role: string) => {
  switch (role) {
    case "Администратор": return "destructive";
    case "Менеджер": return "default";
    case "Клиент": return "secondary";
    default: return "outline";
  }
};

const columns: Column<User>[] = [
  { key: "name", label: "Имя", className: "font-medium" },
  { key: "email", label: "Email" },
  {
    key: "role",
    label: "Роль",
    render: (item) => (
      <Badge variant={roleColor(item.role) as "default" | "destructive" | "secondary" | "outline"} className="text-xs">
        {item.role}
      </Badge>
    ),
  },
  {
    key: "status",
    label: "Статус",
    render: (item) => (
      <Badge variant={item.status === "Активен" ? "default" : "outline"} className="text-xs">
        {item.status}
      </Badge>
    ),
  },
  { key: "lastLogin", label: "Последний вход" },
];

const Admin = () => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Администрирование"
        description="Управление пользователями и ролями"
        actionLabel="Добавить пользователя"
        actionIcon="UserPlus"
        onAction={() => setShowForm(true)}
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="roles">Роли и права</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Всего пользователей</div>
              <div className="text-xl font-bold">{mockUsers.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Администраторов</div>
              <div className="text-xl font-bold">{mockUsers.filter(u => u.role === "Администратор").length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Менеджеров</div>
              <div className="text-xl font-bold">{mockUsers.filter(u => u.role === "Менеджер").length}</div>
            </Card>
          </div>

          <DataTable columns={columns} data={mockUsers} emptyMessage="Пользователи не найдены" />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <Icon name="ShieldCheck" size={16} className="text-red-600" />
                  </div>
                  <CardTitle className="text-sm">Администратор</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Полный доступ к системе</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Управление пользователями</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Управление ролями</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Все операции</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Отчётность</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="UserCog" size={16} className="text-primary" />
                  </div>
                  <CardTitle className="text-sm">Менеджер</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Просмотр и добавление пайщиков</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Оформление договоров</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Внесение платежей</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Просмотр отчётов</li>
                  <li className="flex items-center gap-2"><Icon name="X" size={12} className="text-destructive" /> Управление пользователями</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon name="User" size={16} className="text-muted-foreground" />
                  </div>
                  <CardTitle className="text-sm">Клиент</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Личный кабинет</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Просмотр своих договоров</li>
                  <li className="flex items-center gap-2"><Icon name="Check" size={12} className="text-success" /> Просмотр графиков</li>
                  <li className="flex items-center gap-2"><Icon name="X" size={12} className="text-destructive" /> Создание договоров</li>
                  <li className="flex items-center gap-2"><Icon name="X" size={12} className="text-destructive" /> Отчётность</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">ФИО</Label>
              <Input placeholder="Иванов Иван Иванович" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input placeholder="user@kpk.ru" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input placeholder="+7 (900) 000-00-00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Роль</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Выберите роль" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="manager">Менеджер</SelectItem>
                  <SelectItem value="client">Клиент</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button className="gap-2">
                <Icon name="UserPlus" size={16} />
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
