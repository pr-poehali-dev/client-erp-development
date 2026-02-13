import Icon from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск пайщиков, договоров..."
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Icon name="Bell" size={20} className="text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>
        <div className="w-px h-8 bg-border mx-2" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="User" size={16} className="text-primary" />
          </div>
          <div className="text-sm">
            <div className="font-medium">Администратор</div>
            <div className="text-xs text-muted-foreground">admin@kpk.ru</div>
          </div>
          <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
        </div>
      </div>
    </header>
  );
};

export default Header;
