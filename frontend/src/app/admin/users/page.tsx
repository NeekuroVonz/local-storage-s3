'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Users as UsersIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TableContainer } from '@/components/ui/table-container';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import type { PaginatedResponse } from '@storage/shared';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string; displayName: string };
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as unknown as { usersTimeout?: ReturnType<typeof setTimeout> }).usersTimeout);
    (window as unknown as { usersTimeout?: ReturnType<typeof setTimeout> }).usersTimeout = setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () =>
      apiClient<PaginatedResponse<UserRow>>('/users', {
        params: { page: 1, limit: 50, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
      }),
  });

  const users = data?.data ?? [];

  return (
    <AppShell>
      <Topbar title="Users" subtitle="Manage platform users and roles" />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="border-border/60 bg-card/50 pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState icon={UsersIcon} message={getErrorMessage(error)} />
          ) : users.length === 0 ? (
            <EmptyState icon={UsersIcon} message="No users found" />
          ) : (
            <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-0">
                <TableContainer>
                  <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/30">
                    <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-3 font-medium">
                          {user.firstName} {user.lastName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">{user.role.displayName}</td>
                        <td className="px-4 py-3 capitalize">
                          {user.status.toLowerCase().replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
