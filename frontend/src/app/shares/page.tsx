'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';

type ShareRecord = {
  id: string;
  token: string;
  bucketName: string;
  objectKey: string;
  permission: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

function shareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/share/${token}`;
}

export default function SharesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['shares'],
    queryFn: () => apiClient<{ success: boolean; data: ShareRecord[] }>('/shares'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/shares/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] });
      toast({ title: 'Share revoked' });
    },
    onError: (err) => {
      toast({ title: 'Failed to revoke share', description: getErrorMessage(err), variant: 'destructive' });
    },
  });

  const shares = data?.data ?? [];

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <AppShell>
      <Topbar title="Sharing" subtitle="Manage shared object links" />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-destructive">{getErrorMessage(error)}</p>
        ) : shares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No share links yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create shares from the bucket explorer or API.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {shares.map((share) => (
              <Card key={share.id} className={!share.active ? 'opacity-60' : undefined}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {share.bucketName} / {share.objectKey}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {share.permission} · {share.downloadCount}
                      {share.maxDownloads != null ? ` / ${share.maxDownloads}` : ''} downloads
                      {share.expiresAt ? ` · expires ${formatDate(share.expiresAt)}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {formatDate(share.createdAt)}
                      {!share.active && ' · Revoked'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(share.token)}
                      disabled={!share.active}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => revokeMutation.mutate(share.id)}
                      disabled={!share.active || revokeMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Revoke
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
