import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
  action?: { label: string; onClick: () => void; icon?: string };
  children?: React.ReactNode;
}

const PageHeader = ({ title, description, actionLabel, actionIcon, onAction, action, children }: PageHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {(actionLabel || action) && (
          <Button onClick={action?.onClick || onAction} className="gap-2">
            {(action?.icon || actionIcon) && <Icon name={action?.icon || actionIcon || ""} size={16} />}
            {action?.label || actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default PageHeader;