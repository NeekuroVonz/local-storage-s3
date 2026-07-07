import { cn } from '@/lib/utils';

export function ListItem({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:bg-muted/30',
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
