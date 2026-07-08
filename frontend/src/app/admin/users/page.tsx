'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Shield, Users as UsersIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSection } from '@/components/ui/page-section';
import { TableContainer } from '@/components/ui/table-container';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';
import type { PaginatedResponse, Project } from '@storage/shared';

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
  projects?: Array<{ id: string; name: string; slug: string; role: string }>;
};

type RoleRow = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [manageUser, setManageUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    projectIds: [] as string[],
    projectRole: 'MEMBER' as 'OWNER' | 'MEMBER',
  });
  const [editRoleId, setEditRoleId] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () =>
      apiClient<PaginatedResponse<UserRow>>('/users', {
        params: { page: 1, limit: 50, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
      }),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient<{ success: boolean; data: RoleRow[] }>('/roles'),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient<{ success: boolean; data: Project[] }>('/projects'),
  });

  const users = data?.data ?? [];
  const roles = rolesData?.data ?? [];
  const projects = projectsData?.data ?? [];

  const defaultRoleId = useMemo(
    () => roles.find((role) => role.name === 'operator')?.id ?? roles[0]?.id ?? '',
    [roles],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient('/users', {
        method: 'POST',
        body: {
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          roleId: form.roleId || defaultRoleId,
          status: form.status,
          projectIds: form.projectIds,
          projectRole: form.projectRole,
        },
      }),
    onSuccess: () => {
      setShowCreate(false);
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        roleId: defaultRoleId,
        status: 'ACTIVE',
        projectIds: [],
        projectRole: 'MEMBER',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User created' });
    },
    onError: (err) =>
      toast({ title: 'Create failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const roleMutation = useMutation({
    mutationFn: () =>
      apiClient(`/users/${manageUser!.id}/role`, {
        method: 'PATCH',
        body: { roleId: editRoleId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Role updated' });
    },
    onError: (err) =>
      toast({ title: 'Update role failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: () =>
      apiClient(`/users/${manageUser!.id}/status`, {
        method: 'PATCH',
        body: { status: editStatus },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Status updated' });
    },
    onError: (err) =>
      toast({
        title: 'Update status failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  });

  const projectsMutation = useMutation({
    mutationFn: () =>
      apiClient(`/users/${manageUser!.id}/projects`, {
        method: 'PATCH',
        body: {
          projectIds: editProjectIds,
          // Backend preserves existing OWNER/MEMBER per project when possible.
          projectRole: 'MEMBER',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Projects updated' });
    },
    onError: (err) =>
      toast({
        title: 'Update projects failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  });

  const openManage = (user: UserRow) => {
    setManageUser(user);
    setEditRoleId(user.role.id);
    setEditStatus(user.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED');
    setEditProjectIds(user.projects?.map((project) => project.id) ?? []);
  };

  const toggleProject = (projectId: string, list: string[], setList: (value: string[]) => void) => {
    setList(
      list.includes(projectId) ? list.filter((id) => id !== projectId) : [...list, projectId],
    );
  };

  return (
    <AppShell>
      <Topbar
        title="Users"
        subtitle="Create accounts, assign roles, and project access"
        actions={
          <Button
            size="sm"
            onClick={() => {
              setShowCreate(true);
              setForm((prev) => ({ ...prev, roleId: prev.roleId || defaultRoleId }));
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New user
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {showCreate && (
            <PageSection
              title="Create user"
              description="Role = platform permissions. Projects = which buckets the user can access."
              icon={Shield}
              action={
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="user@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Min 8 chars, upper/lower/number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.roleId || defaultRoleId}
                    onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
                      }))
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project role</Label>
                  <Select
                    value={form.projectRole}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        projectRole: e.target.value as 'OWNER' | 'MEMBER',
                      }))
                    }
                  >
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Owner</option>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Assign projects (buckets come with project)</Label>
                  <div className="grid gap-2 rounded-lg border border-border/60 bg-background/40 p-3 sm:grid-cols-2">
                    {projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No projects yet</p>
                    ) : (
                      projects.map((project) => (
                        <label key={project.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.projectIds.includes(project.id)}
                            onChange={() =>
                              toggleProject(project.id, form.projectIds, (next) =>
                                setForm((prev) => ({ ...prev, projectIds: next })),
                              )
                            }
                          />
                          {project.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <Button
                className="mt-4"
                disabled={
                  createMutation.isPending ||
                  !form.email.trim() ||
                  !form.password ||
                  !form.firstName.trim() ||
                  !form.lastName.trim() ||
                  !(form.roleId || defaultRoleId)
                }
                onClick={() => createMutation.mutate()}
              >
                Create user
              </Button>
            </PageSection>
          )}

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
                  <table className="w-full table-fixed text-sm">
                    <thead className="border-b border-border/60 bg-muted/30">
                      <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="w-28 px-4 py-3">Role</th>
                        <th className="w-28 px-4 py-3">Status</th>
                        <th className="hidden px-4 py-3 md:table-cell">Projects</th>
                        <th className="hidden w-40 px-4 py-3 lg:table-cell">Last login</th>
                        <th className="w-14 px-2 py-3 text-right sm:w-16 sm:px-3"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20"
                        >
                          <td className="max-w-0 px-4 py-3 font-medium">
                            <p className="truncate" title={`${user.firstName} ${user.lastName}`}>
                              {user.firstName} {user.lastName}
                            </p>
                          </td>
                          <td className="max-w-0 px-4 py-3 text-muted-foreground">
                            <p className="truncate" title={user.email}>
                              {user.email}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs">
                              {user.role.displayName}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize">
                            {user.status.toLowerCase().replace(/_/g, ' ')}
                          </td>
                          <td className="hidden max-w-0 px-4 py-3 text-muted-foreground md:table-cell">
                            <p
                              className="truncate"
                              title={(user.projects ?? []).map((p) => p.name).join(', ')}
                            >
                              {(user.projects ?? []).length
                                ? (user.projects ?? []).map((p) => p.name).join(', ')
                                : '—'}
                            </p>
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                            {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
                          </td>
                          <td className="px-2 py-3 align-middle sm:px-3">
                            <div className="flex justify-end">
                              <RowActionsMenu
                                items={[
                                  {
                                    label: 'Manage access',
                                    icon: <Shield className="h-4 w-4" />,
                                    onClick: () => openManage(user),
                                  },
                                ]}
                              />
                            </div>
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

      {manageUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-semibold">Manage access</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {manageUser.firstName} {manageUser.lastName} · {manageUser.email}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform role</Label>
                <Select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)}>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.displayName}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={roleMutation.isPending || editRoleId === manageUser.role.id}
                  onClick={() => roleMutation.mutate()}
                >
                  Save role
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={statusMutation.isPending || editStatus === manageUser.status}
                  onClick={() => statusMutation.mutate()}
                >
                  Save status
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Projects (bucket access)</Label>
              <div className="grid max-h-48 gap-2 overflow-auto rounded-lg border border-border/60 bg-background/40 p-3 sm:grid-cols-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editProjectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id, editProjectIds, setEditProjectIds)}
                    />
                    {project.name}
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={projectsMutation.isPending}
                onClick={() => projectsMutation.mutate()}
              >
                Save project assignments
              </Button>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setManageUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
