import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const accentStyles = {
  blue: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/20',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/20',
  rose: 'bg-rose-500/15 text-rose-400 ring-rose-500/20',
  slate: 'bg-muted text-muted-foreground ring-border',
} as const;

export type StatAccent = keyof typeof accentStyles;

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  accent = 'slate',
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  accent?: StatAccent;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
              {subtitle && (
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
              accentStyles[accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
