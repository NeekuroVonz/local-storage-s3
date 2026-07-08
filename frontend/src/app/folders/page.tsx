'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  FolderOpen,
  FolderPlus,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSection } from '@/components/ui/page-section';
import { StatCard } from '@/components/ui/stat-card';
import { apiClient } from '@/lib/api-client';
import { cn, formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';
import type { Project, StorageBucket, StorageFolderRecord } from '@storage/shared';

type FoldersResponse = {
  success: boolean;
  data: StorageFolderRecord[];
};

type ProjectRow = Project & {
  buckets?: Array<{ bucketName: string }>;
};

export default function FoldersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [rootsOnly, setRootsOnly] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editFolder, setEditFolder] = useState<StorageFolderRecord | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    bucketName: '',
    projectId: '',
  });
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  const { data: bucketsData } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => apiClient<{ success: boolean; data: StorageBucket[] }>('/buckets'),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient<{ success: boolean; data: ProjectRow[] }>('/projects'),
  });

  const buckets = bucketsData?.data ?? [];
  const projects = projectsData?.data ?? [];

  const listParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(rootsOnly ? { rootsOnly: true } : {}),
      ...(projectId ? { projectId } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
    }),
    [rootsOnly, projectId, search],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['storage-folders', listParams],
    queryFn: () => {
      if (search.trim()) {
        return apiClient<FoldersResponse>('/folders/search', { params: listParams });
      }
      return apiClient<FoldersResponse>('/folders', { params: listParams });
    },
  });

  const { data: bindingsData } = useQuery({
    queryKey: ['folder-bindings', projectId],
    queryFn: () =>
      apiClient<FoldersResponse>('/folders/bindings', { params: { projectId } }),
    enabled: Boolean(projectId),
  });

  const folders = data?.data ?? [];
  const bindings = bindingsData?.data ?? [];
  const rootCount = folders.filter((folder) => !folder.parentId).length;
  const inUseCount = folders.filter(
    (folder) => (folder.fileCount ?? 0) > 0 || (folder.childCount ?? 0) > 0,
  ).length;

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient('/folders', {
        method: 'POST',
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          bucketName: form.bucketName || buckets[0]?.name,
          ...(form.projectId ? { projectId: form.projectId } : {}),
        },
      }),
    onSuccess: () => {
      setShowCreate(false);
      setForm({ code: '', name: '', bucketName: '', projectId: '' });
      queryClient.invalidateQueries({ queryKey: ['storage-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-bindings'] });
      toast({ title: 'Folder created' });
    },
    onError: (err) =>
      toast({ title: 'Create failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient(`/folders/${editFolder!.id}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          code: editCode.trim(),
        },
      }),
    onSuccess: () => {
      setEditFolder(null);
      queryClient.invalidateQueries({ queryKey: ['storage-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-bindings'] });
      toast({ title: 'Folder updated' });
    },
    onError: (err) =>
      toast({ title: 'Update failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/folders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-bindings'] });
      toast({ title: 'Folder deleted' });
    },
    onError: (err) =>
      toast({ title: 'Delete failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  return (
    <AppShell>
      <Topbar
        title="Folders"
        subtitle="Organize storage with roots, bindings, and in-use protection"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={buckets.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New folder
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Folders" value={folders.length} icon={FolderOpen} accent="sky" />
            <StatCard title="Root folders" value={rootCount} icon={FolderKanban} accent="violet" />
            <StatCard title="In use" value={inUseCount} icon={Link2} accent="amber" />
          </div>

          <PageSection
            title="Browse"
            description="Filter by project, search code/name, or show roots only"
            icon={Search}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
              <div className="relative md:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search code or name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="md:col-span-4">
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={() => setRootsOnly((value) => !value)}
                  className={cn(
                    'flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm shadow-sm transition-colors',
                    rootsOnly
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/70 bg-background/70 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] leading-none',
                      rootsOnly
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {rootsOnly ? '✓' : ''}
                  </span>
                  Roots only
                </button>
              </div>
            </div>
          </PageSection>

          {projectId && (
            <PageSection
              title="Project bindings"
              description="Root folders linked to the selected project"
              icon={Link2}
            >
              {bindings.length === 0 ? (
                <EmptyState icon={Link2} message="No root folders bound to this project yet" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bindings.map((folder) => (
                    <span
                      key={folder.id}
                      className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-primary"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="font-medium">{folder.name}</span>
                      <span className="text-primary/70">{folder.code}</span>
                    </span>
                  ))}
                </div>
              )}
            </PageSection>
          )}

          {showCreate && (
            <PageSection
              title="Create folder"
              description="Code must be unique within a project scope"
              icon={FolderPlus}
              action={
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="invoices"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Invoices"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bucket</Label>
                  <Select
                    value={form.bucketName || buckets[0]?.name || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, bucketName: e.target.value }))}
                  >
                    {buckets.map((bucket) => (
                      <option key={bucket.name} value={bucket.name}>
                        {bucket.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bind to project</Label>
                  <Select
                    value={form.projectId}
                    onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button
                className="mt-4"
                disabled={
                  !form.code.trim() ||
                  !form.name.trim() ||
                  createMutation.isPending ||
                  buckets.length === 0
                }
                onClick={() => createMutation.mutate()}
              >
                Create folder
              </Button>
            </PageSection>
          )}

          <PageSection
            title="All folders"
            description="Rename or delete only when the folder is not in use"
            icon={FolderOpen}
          >
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : isError ? (
              <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
            ) : folders.length === 0 ? (
              <EmptyState icon={FolderOpen} message="No folders yet. Create one to organize files." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {folders.map((folder) => {
                  const inUse = (folder.fileCount ?? 0) > 0 || (folder.childCount ?? 0) > 0;
                  return (
                    <div
                      key={folder.id}
                      className="group flex flex-col justify-between rounded-xl border border-border/60 bg-background/40 p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            folder.parentId
                              ? 'bg-sky-500/10 text-sky-400'
                              : 'bg-violet-500/10 text-violet-400',
                          )}
                        >
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-semibold">{folder.name}</h4>
                            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                              {folder.code}
                            </span>
                            {!folder.parentId && (
                              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                                root
                              </span>
                            )}
                            {folder.projectId && (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                bound
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {folder.bucketName} · {folder.prefix || '/'}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {folder.fileCount ?? 0} files · {folder.childCount ?? 0} children ·{' '}
                            {formatDate(folder.createdAt)}
                            {inUse ? ' · in use' : ' · available'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-1 border-t border-border/40 pt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Rename"
                          onClick={() => {
                            setEditFolder(folder);
                            setEditName(folder.name);
                            setEditCode(folder.code);
                          }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={inUse || deleteMutation.isPending}
                          title={inUse ? 'Delete blocked while in use' : 'Delete'}
                          onClick={() => deleteMutation.mutate(folder.id)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PageSection>
        </div>
      </div>

      {editFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-semibold">Rename folder</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Only available when the folder is not in use
              </p>
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditFolder(null)}>
                Cancel
              </Button>
              <Button
                disabled={!editName.trim() || !editCode.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
