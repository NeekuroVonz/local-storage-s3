import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  message,
  className,
}: {
  icon?: LucideIcon;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center',
        className,
      )}
    >
      {Icon && <Icon className="mb-2 h-8 w-8 text-muted-foreground/40" />}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
