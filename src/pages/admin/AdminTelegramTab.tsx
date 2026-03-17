import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import api, {
  NotificationChannel,
  TelegramSubscriber,
  NotificationHistoryItem,
  NotificationLogEntry,
  NotificationStats,
} from "@/lib/api";

const fmtDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  sending: { label: "Отправляется", variant: "secondary" },
  sent: { label: "Отправлено", variant: "default" },
  error: { label: "Ошибка", variant: "destructive" },
};

const AdminTelegramTab = () => {
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<NotificationChannel | null>(null);
  const [subscribers, setSubscribers] = useState<TelegramSubscriber[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [messages, setMessages] = useState<NotificationHistoryItem[]>([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("send");
  const [form, setForm] = useState({ title: "", body: "", target: "all" });
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logEntries, setLogEntries] = useState<NotificationLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testChatId, setTestChatId] = useState("");
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [channels, subs, st, hist] = await Promise.all([
        api.notifications.channels(),
        api.notifications.telegramSubscribers(),
        api.notifications.stats(),
        api.notifications.history("telegram", 50, 0),
      ]);
      const tgChannel = channels.find(c => c.channel === "telegram");
      setChannel(tgChannel || null);
      if (tgChannel) {
        const s = tgChannel.settings || {};
        setBotToken((s.bot_token as string) || "");
        setWelcomeMsg((s.welcome_message as string) || "");
      }
      setSubscribers(subs);
      setStats(st);
      setMessages(hist.items);
      setMessagesTotal(hist.total);
    } catch (e) {
      toast({ title: "Ошибка загрузки", description: String(e), variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSend = async () => {
    if (!form.body.trim()) {
      toast({ title: "Введите текст сообщения", variant: "destructive" });
      return;
    }
    if (form.target === "selected" && selectedUsers.length === 0) {
      toast({ title: "Выберите получателей", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await api.notifications.sendTelegram({
        title: form.title.trim(),
        body: form.body.trim(),
        target: form.target,
        target_user_ids: form.target === "selected" ? selectedUsers : undefined,
      });
      toast({ title: `Отправлено: ${res.sent}, ошибок: ${res.failed}` });
      setForm({ title: "", body: "", target: "all" });
      setSelectedUsers([]);
      loadData();
    } catch (e) {
      toast({ title: "Ошибка отправки", description: String(e), variant: "destructive" });
    }
    setSending(false);
  };

  const openLog = async (id: number) => {
    setLogLoading(true);
    setShowLog(true);
    try {
      const entries = await api.notifications.historyLog(id);
      setLogEntries(entries);
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
    setLogLoading(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.notifications.saveChannel("telegram", channel?.enabled, {
        bot_token: botToken,
        welcome_message: welcomeMsg,
      });
      toast({ title: "Настройки сохранены" });
      loadData();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
    setSavingSettings(false);
  };

  const toggleEnabled = async () => {
    try {
      await api.notifications.saveChannel("telegram", !channel?.enabled);
      loadData();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const handleTest = async () => {
    if (!testChatId.trim()) {
      toast({ title: "Введите Chat ID", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      await api.notifications.testTelegram(testChatId.trim());
      toast({ title: "Тестовое сообщение отправлено" });
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
    setTesting(false);
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Icon name="Users" size={20} className="text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.telegram_subscribers || 0}</div>
              <div className="text-xs text-muted-foreground">Подписчиков</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Icon name="Send" size={20} className="text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.telegram_messages || 0}</div>
              <div className="text-xs text-muted-foreground">Рассылок</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: channel?.enabled ? "#f0fdf4" : "#fef2f2" }}>
              <Icon name={channel?.enabled ? "CheckCircle" : "XCircle"} size={20} className={channel?.enabled ? "text-green-500" : "text-red-500"} />
            </div>
            <div>
              <div className="text-sm font-medium">{channel?.enabled ? "Включён" : "Отключён"}</div>
              <div className="text-xs text-muted-foreground">Статус канала</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="send">Отправить</TabsTrigger>
          <TabsTrigger value="history">История ({messagesTotal})</TabsTrigger>
          <TabsTrigger value="subscribers">Подписчики ({subscribers.length})</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="Send" size={18} />
                Новая рассылка в Telegram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Заголовок (необязательно)</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Будет выделен жирным" maxLength={100} />
              </div>
              <div>
                <Label>Текст сообщения</Label>
                <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Текст для отправки в Telegram..." rows={4} maxLength={4000} />
              </div>
              <div>
                <Label>Получатели</Label>
                <Select value={form.target} onValueChange={v => setForm({ ...form, target: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все подписчики ({subscribers.length})</SelectItem>
                    <SelectItem value="selected">Выбранные</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.target === "selected" && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {subscribers.map(s => (
                    <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedUsers.includes(s.user_id)} onCheckedChange={() => toggleUser(s.user_id)} />
                      <span className="text-sm">{s.name || s.first_name || s.username}</span>
                      {s.username && <span className="text-xs text-muted-foreground">@{s.username}</span>}
                    </label>
                  ))}
                  {subscribers.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Нет подписчиков</div>}
                </div>
              )}
              <Button onClick={handleSend} disabled={sending || !form.body.trim()}>
                {sending ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : <Icon name="Send" size={16} className="mr-2" />}
                Отправить
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Нет отправленных сообщений</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Заголовок</TableHead>
                      <TableHead>Текст</TableHead>
                      <TableHead className="text-center">Отпр.</TableHead>
                      <TableHead className="text-center">Ошиб.</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map(m => {
                      const st = statusMap[m.status] || { label: m.status, variant: "secondary" as const };
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(m.created_at)}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">{m.title || "—"}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{m.body}</TableCell>
                          <TableCell className="text-center text-sm">{m.sent_count}</TableCell>
                          <TableCell className="text-center text-sm">{m.failed_count}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => openLog(m.id)}>
                              <Icon name="FileText" size={14} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscribers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {subscribers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Нет подписчиков</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Chat ID</TableHead>
                      <TableHead>Пайщик</TableHead>
                      <TableHead>Подписка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{s.first_name || "—"}</TableCell>
                        <TableCell className="text-sm">{s.username ? `@${s.username}` : "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{s.chat_id}</TableCell>
                        <TableCell className="text-sm">{s.name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(s.subscribed_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Icon name="Settings" size={18} />
                  Настройки Telegram
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-normal text-muted-foreground">{channel?.enabled ? "Вкл" : "Выкл"}</span>
                  <Switch checked={channel?.enabled || false} onCheckedChange={toggleEnabled} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Токен бота</Label>
                <Input type="password" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456:ABC-DEF..." />
                <p className="text-xs text-muted-foreground mt-1">Получите у @BotFather в Telegram</p>
              </div>
              <div>
                <Label>Приветственное сообщение</Label>
                <Textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} placeholder="Текст при подписке на бота" rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings && <Icon name="Loader2" size={16} className="animate-spin mr-2" />}
                  Сохранить
                </Button>
              </div>
              <div className="border-t pt-4 mt-4">
                <Label>Тест отправки</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={testChatId} onChange={e => setTestChatId(e.target.value)} placeholder="Chat ID" className="max-w-[200px]" />
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : <Icon name="Send" size={16} className="mr-2" />}
                    Тест
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showLog} onOpenChange={setShowLog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Детали доставки</DialogTitle></DialogHeader>
          {logLoading ? (
            <div className="flex justify-center py-6"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Ошибка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{e.user_name || `ID ${e.user_id}`}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "sent" ? "default" : "destructive"}>
                          {e.status === "sent" ? "Доставлено" : "Ошибка"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.error_text || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {logEntries.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Нет записей</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLog(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTelegramTab;
