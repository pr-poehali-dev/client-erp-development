import { useState } from "react";
import PageHeader from "@/components/ui/page-header";
import DataTable, { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Icon from "@/components/ui/icon";

interface Member {
  id: string;
  type: string;
  name: string;
  inn: string;
  phone: string;
  email: string;
  status: string;
  loans: number;
  savings: number;
  joinDate: string;
  [key: string]: unknown;
}

const mockMembers: Member[] = [
  { id: "П-001", type: "ФЛ", name: "Иванов Иван Иванович", inn: "770123456789", phone: "+7 (900) 123-45-67", email: "ivanov@mail.ru", status: "Активен", loans: 2, savings: 1, joinDate: "15.03.2023" },
  { id: "П-002", type: "ФЛ", name: "Петрова Анна Сергеевна", inn: "770987654321", phone: "+7 (900) 987-65-43", email: "petrova@mail.ru", status: "Активен", loans: 1, savings: 2, joinDate: "22.06.2023" },
  { id: "П-003", type: "ЮЛ", name: "ООО «Рассвет»", inn: "7701234567", phone: "+7 (495) 111-22-33", email: "info@rassvet.ru", status: "Активен", loans: 3, savings: 0, joinDate: "10.01.2024" },
  { id: "П-004", type: "ФЛ", name: "Козлов Виктор Андреевич", inn: "770555444333", phone: "+7 (900) 555-44-33", email: "kozlov@mail.ru", status: "Заблокирован", loans: 1, savings: 0, joinDate: "05.09.2023" },
  { id: "П-005", type: "ФЛ", name: "Морозова Елена Константиновна", inn: "770666777888", phone: "+7 (900) 666-77-88", email: "morozova@mail.ru", status: "Активен", loans: 0, savings: 1, joinDate: "18.11.2023" },
  { id: "П-006", type: "ЮЛ", name: "ИП Сидоров К.М.", inn: "770111222333", phone: "+7 (495) 222-33-44", email: "sidorov@biz.ru", status: "Активен", loans: 1, savings: 1, joinDate: "02.02.2024" },
];

const columns: Column<Member>[] = [
  { key: "id", label: "Номер" },
  {
    key: "type",
    label: "Тип",
    render: (item) => (
      <Badge variant={item.type === "ФЛ" ? "secondary" : "outline"} className="text-xs">
        {item.type}
      </Badge>
    ),
  },
  { key: "name", label: "Наименование / ФИО", className: "font-medium" },
  { key: "inn", label: "ИНН" },
  { key: "phone", label: "Телефон" },
  {
    key: "status",
    label: "Статус",
    render: (item) => (
      <Badge variant={item.status === "Активен" ? "default" : "destructive"} className="text-xs">
        {item.status}
      </Badge>
    ),
  },
  { key: "loans", label: "Займы", className: "text-center" },
  { key: "savings", label: "Вклады", className: "text-center" },
  { key: "joinDate", label: "Дата вступления" },
];

const Members = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [memberType, setMemberType] = useState("fl");

  const filtered = mockMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.inn.includes(search) ||
      m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Пайщики"
        description={`Всего ${mockMembers.length} пайщиков в системе`}
        actionLabel="Добавить пайщика"
        actionIcon="UserPlus"
        onAction={() => setShowForm(true)}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по ФИО, ИНН, номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Icon name="Filter" size={16} />
          Фильтры
        </Button>
        <Button variant="outline" className="gap-2">
          <Icon name="Download" size={16} />
          Экспорт
        </Button>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="Пайщики не найдены" />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый пайщик</DialogTitle>
          </DialogHeader>

          <Tabs value={memberType} onValueChange={setMemberType}>
            <TabsList className="w-full">
              <TabsTrigger value="fl" className="flex-1">Физическое лицо</TabsTrigger>
              <TabsTrigger value="ul" className="flex-1">Юридическое лицо</TabsTrigger>
            </TabsList>

            <TabsContent value="fl" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Фамилия</Label>
                  <Input placeholder="Иванов" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Имя</Label>
                  <Input placeholder="Иван" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Отчество</Label>
                  <Input placeholder="Иванович" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата рождения</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Место рождения</Label>
                  <Input placeholder="г. Москва" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ИНН</Label>
                <Input placeholder="770123456789" maxLength={12} />
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Паспортные данные</div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Серия</Label>
                  <Input placeholder="4500" maxLength={4} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Номер</Label>
                  <Input placeholder="123456" maxLength={6} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Код подразделения</Label>
                  <Input placeholder="770-001" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата выдачи</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Кем выдан</Label>
                <Input placeholder="ОВД района..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес регистрации</Label>
                <Input placeholder="г. Москва, ул. ..." />
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Контактная информация</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Мобильный телефон</Label>
                  <Input placeholder="+7 (900) 000-00-00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input placeholder="email@mail.ru" type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telegram</Label>
                  <Input placeholder="@username" />
                </div>
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Банковские реквизиты</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">БИК</Label>
                  <Input placeholder="044525225" maxLength={9} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Расчётный счёт</Label>
                  <Input placeholder="40817810000000000000" maxLength={20} />
                </div>
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Дополнительная информация</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Семейное положение</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="married">Женат/Замужем</SelectItem>
                      <SelectItem value="single">Холост/Не замужем</SelectItem>
                      <SelectItem value="divorced">Разведён(а)</SelectItem>
                      <SelectItem value="widowed">Вдовец/Вдова</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Доп. телефон</Label>
                  <Input placeholder="+7 (900) 000-00-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ФИО супруга(и)</Label>
                  <Input placeholder="Иванова Мария Петровна" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Телефон супруга(и)</Label>
                  <Input placeholder="+7 (900) 000-00-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ФИО доп. контакта</Label>
                  <Input placeholder="Петров Пётр Петрович" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
                <Button className="gap-2">
                  <Icon name="Save" size={16} />
                  Сохранить
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="ul" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ИНН организации</Label>
                <Input placeholder="7701234567" maxLength={10} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Наименование компании</Label>
                <Input placeholder='ООО «Рассвет»' />
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Руководитель</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ФИО руководителя</Label>
                  <Input placeholder="Иванов Иван Иванович" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Телефон руководителя</Label>
                  <Input placeholder="+7 (900) 000-00-00" />
                </div>
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Контактное лицо</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ФИО контактного лица</Label>
                  <Input placeholder="Петров Пётр Петрович" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Телефон контактного лица</Label>
                  <Input placeholder="+7 (900) 000-00-00" />
                </div>
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Банковские реквизиты</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">БИК</Label>
                  <Input placeholder="044525225" maxLength={9} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Расчётный счёт</Label>
                  <Input placeholder="40702810000000000000" maxLength={20} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
                <Button className="gap-2">
                  <Icon name="Save" size={16} />
                  Сохранить
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Members;
