import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: "LayoutDashboard", label: "Дашборд", path: "/" },
  { icon: "Users", label: "Пайщики", path: "/members" },
  { icon: "Landmark", label: "Займы", path: "/loans" },
  { icon: "PiggyBank", label: "Сбережения", path: "/savings" },
  { icon: "Wallet", label: "Паевые счета", path: "/shares" },
  { icon: "BarChart3", label: "Отчётность", path: "/reports" },
  { icon: "Settings", label: "Администрирование", path: "/admin" },
];

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Icon name="Shield" size={20} className="text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <div className="text-sm font-semibold tracking-tight">КПК Система</div>
            <div className="text-[11px] text-sidebar-foreground/50">Управление кооперативом</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon name={item.icon} size={20} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm transition-all"
        >
          <Icon name={collapsed ? "ChevronsRight" : "ChevronsLeft"} size={18} />
          {!collapsed && <span>Свернуть</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
