'use client';

import { useQuery } from '@tanstack/react-query';
import {
  HardDrive,
  FileStack,
  Database,
  Upload,
  Download,
  Users,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import type { DashboardStats, ActivityLogEntry } from '@storage/shared';

export default function DashboardPage() {
  const { data: statsResponse, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () =>
      apiClient<{ success: boolean; data: DashboardStats & { storageConnected?: boolean } }>(
        '/dashboard/stats',
      ),
  });

  const { data: activityResponse } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => apiClient<{ success: boolean; data: ActivityLogEntry[] }>('/dashboard/activity'),
  });

  const stats = statsResponse?.data;
  const activity = activityResponse?.data ?? [];

  return (
    <AppShell>
      <Topbar title="Dashboard" subtitle="Storage overview and recent activity" />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : (
            <>
              {stats?.storageConnected === false && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Storage backend is unavailable. Check that Garage is running and S3 credentials
                  in <code className="rounded bg-black/20 px-1.5 py-0.5 text-xs">.env</code> are
                  configured.
                </div>
              )}

              <div>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Storage
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Total Buckets"
                    value={stats?.totalBuckets ?? 0}
                    icon={HardDrive}
                    accent="blue"
                  />
                  <StatCard
                    title="Total Objects"
                    value={stats?.totalObjects?.toLocaleString() ?? 0}
                    icon={FileStack}
                    accent="violet"
                  />
                  <StatCard
                    title="Storage Used"
                    value={formatBytes(stats?.storageUsed ?? 0)}
                    icon={Database}
                    accent="emerald"
                  />
                  <StatCard
                    title="Storage Growth"
                    value={`${(stats?.storageGrowth ?? 0).toFixed(1)}%`}
                    icon={TrendingUp}
                    subtitle="vs yesterday"
                    accent="amber"
                  />
                </div>
              </div>

              <div>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity today
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Uploads Today"
                    value={stats?.uploadsToday ?? 0}
                    icon={Upload}
                    accent="sky"
                  />
                  <StatCard
                    title="Downloads Today"
                    value={stats?.downloadsToday ?? 0}
                    icon={Download}
                    accent="rose"
                  />
                  <StatCard
                    title="Active Users"
                    value={stats?.activeUsers ?? 0}
                    icon={Users}
                    accent="violet"
                  />
                  <StatCard
                    title="Bandwidth"
                    value={formatBytes(stats?.bandwidthUsed ?? 0)}
                    icon={TrendingUp}
                    accent="slate"
                  />
                </div>
              </div>

              <Card className="border-border/60 bg-card/80 shadow-sm">
                <CardHeader className="border-b border-border/60 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <CardTitle>Recent Activity</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {activity.length === 0 ? (
                    <EmptyState icon={Activity} message="No recent activity yet" />
                  ) : (
                    <div className="space-y-2">
                      {activity.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize">
                              {item.action.toLowerCase().replace('_', ' ')}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.user?.firstName} {item.user?.lastName} · {item.resource}
                            </p>
                          </div>
                          <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString()}
                          </time>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
