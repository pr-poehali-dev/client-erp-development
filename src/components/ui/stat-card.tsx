import { Card, CardContent } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: string;
  iconColor?: string;
}

const StatCard = ({ title, value, change, changeType = "neutral", icon, iconColor = "bg-primary/10 text-primary" }: StatCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                <Icon
                  name={changeType === "positive" ? "TrendingUp" : changeType === "negative" ? "TrendingDown" : "Minus"}
                  size={14}
                  className={cn(
                    changeType === "positive" && "text-success",
                    changeType === "negative" && "text-destructive",
                    changeType === "neutral" && "text-muted-foreground"
                  )}
                />
                <span className={cn(
                  "text-xs font-medium",
                  changeType === "positive" && "text-success",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground"
                )}>
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
            <Icon name={icon} size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
