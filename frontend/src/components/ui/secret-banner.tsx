import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

export function SecretBanner({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="mb-2 text-sm font-medium text-amber-100/90">{title}</p>
      <code className="block max-h-40 overflow-auto rounded-md bg-black/20 p-3 text-xs leading-relaxed text-amber-50/90">
        {value}
      </code>
      <Button
        size="sm"
        variant="secondary"
        className="mt-3"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast({ title: 'Copied to clipboard' });
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
    </div>
  );
}
