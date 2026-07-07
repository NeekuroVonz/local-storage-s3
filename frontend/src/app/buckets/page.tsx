'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, HardDrive, Search, MoreHorizontal, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { formatBytes, formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';
import type { StorageBucket } from '@storage/shared';
import { motion } from 'framer-motion';

export default function BucketsPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['buckets', search],
    queryFn: () =>
      apiClient<{ success: boolean; data: StorageBucket[] }>('/buckets', {
        params: search ? { search } : undefined,
      }),
    meta: { silentError: true },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient('/buckets', { method: 'POST', body: { name, versioning: false, publicAccess: false } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      setShowCreate(false);
      setNewBucketName('');
      toast({ title: 'Bucket created', description: 'Your new bucket is ready.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => apiClient(`/buckets/${name}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      toast({ title: 'Bucket deleted' });
    },
  });

  const buckets = data?.data ?? [];

  return (
    <AppShell>
      <Topbar
        title="Buckets"
        subtitle={`${buckets.length} bucket${buckets.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Bucket
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search buckets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {showCreate && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">Create New Bucket</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="my-bucket-name"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value.toLowerCase())}
              />
              <div className="flex gap-2">
                <Button onClick={() => createMutation.mutate(newBucketName)} disabled={!newBucketName || createMutation.isPending}>
                  Create
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-6 text-center">
            <HardDrive className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h3 className="font-medium">Storage backend unavailable</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {getErrorMessage(error)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ensure Garage is running and update S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY in .env
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : buckets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <HardDrive className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No buckets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first bucket to start storing objects.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Bucket
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {buckets.map((bucket, i) => (
              <motion.div key={bucket.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <Link href={`/buckets/${bucket.name}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <HardDrive className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{bucket.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{formatDate(bucket.creationDate)}</p>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => {
                        if (confirm(`Delete bucket "${bucket.name}"? It must be empty.`)) {
                          deleteMutation.mutate(bucket.name);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{bucket.objectCount.toLocaleString()} objects</span>
                      <span className="font-medium">{formatBytes(bucket.size)}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
