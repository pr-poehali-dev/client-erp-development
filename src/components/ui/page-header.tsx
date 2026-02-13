import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
}

const PageHeader = ({ title, description, actionLabel, actionIcon, onAction }: PageHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actionLabel && (
        <Button onClick={onAction} className="gap-2">
          {actionIcon && <Icon name={actionIcon} size={16} />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default PageHeader;
