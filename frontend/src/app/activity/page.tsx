'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer } from '@/components/ui/table-container';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import type { ActivityLogEntry, PaginatedResponse } from '@storage/shared';

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['activity', page],
    queryFn: () =>
      apiClient<PaginatedResponse<ActivityLogEntry>>('/activity', {
        params: { page, limit },
      }),
  });

  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <AppShell>
      <Topbar title="Activity" subtitle="Audit log of storage operations" />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ActivityIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-destructive">{getErrorMessage(error)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Activity log requires the audit:read permission (admin or manager).
            </p>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No activity recorded yet</p>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <TableContainer>
                  <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr className="text-left text-muted-foreground">
                      <th className="p-3">Action</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Resource</th>
                      <th className="p-3 w-48">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="p-3 font-medium capitalize">
                          {entry.action.toLowerCase().replace(/_/g, ' ')}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {entry.user
                            ? `${entry.user.firstName} ${entry.user.lastName}`
                            : entry.userId}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {entry.resource}
                          {entry.resourceId ? ` · ${entry.resourceId}` : ''}
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </TableContainer>
              </CardContent>
            </Card>

            {meta && meta.totalPages > 1 && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages} ({meta.total} entries)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasPreviousPage}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
