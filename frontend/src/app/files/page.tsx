'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  Download,
  FileStack,
  Filter,
  HardDrive,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
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
import { TableContainer } from '@/components/ui/table-container';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { apiClient, apiDownloadBlob, apiUpload, saveBlobAsFile } from '@/lib/api-client';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';
import type { StorageBucket, StoredFileRecord } from '@storage/shared';

type FilesListResponse = {
  success: boolean;
  data: StoredFileRecord[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
};

function removeFilesFromListCache(queryClient: QueryClient, ids: string[]) {
  const idSet = new Set(ids);
  queryClient.setQueriesData<FilesListResponse>({ queryKey: ['stored-files'] }, (old) => {
    if (!old?.data) {
      return old;
    }

    const next = old.data.filter((file) => !idSet.has(file.id));
    if (next.length === old.data.length) {
      return old;
    }

    const removedCount = old.data.length - next.length;
    return {
      ...old,
      data: next,
      meta: old.meta
        ? {
            ...old.meta,
            total: Math.max(0, old.meta.total - removedCount),
          }
        : old.meta,
    };
  });
}

export default function FilesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trashed, setTrashed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [extension, setExtension] = useState('');
  const [debouncedExtension, setDebouncedExtension] = useState('');
  const [bucket, setBucket] = useState('');
  const [uploadBucket, setUploadBucket] = useState('');
  const [uploadModule, setUploadModule] = useState('default');
  const [editFile, setEditFile] = useState<StoredFileRecord | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editModule, setEditModule] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedName(name.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [name]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedExtension(extension.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [extension]);

  const { data: bucketsData } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => apiClient<{ success: boolean; data: StorageBucket[] }>('/buckets'),
  });

  const buckets = bucketsData?.data ?? [];

  const { data: modulesData } = useQuery({
    queryKey: ['file-modules', bucket || 'all'],
    queryFn: () =>
      apiClient<{ success: boolean; data: string[] }>('/files/modules', {
        params: bucket ? { bucket } : undefined,
      }),
  });

  const modules = modulesData?.data ?? ['default'];

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: 50,
      // Only send when true — "trashed=false" was coerced to true by Zod previously.
      ...(trashed ? { trashed: true } : {}),
      ...(debouncedName ? { name: debouncedName } : {}),
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(debouncedExtension ? { extension: debouncedExtension } : {}),
      ...(bucket.trim() ? { bucket: bucket.trim() } : {}),
    }),
    [trashed, debouncedName, moduleFilter, debouncedExtension, bucket],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['stored-files', queryParams],
    queryFn: () => apiClient<FilesListResponse>('/files', { params: queryParams }),
    placeholderData: keepPreviousData,
  });

  const files = data?.data ?? [];
  const unavailableTrashCount = trashed
    ? files.filter((file) => file.storageAvailable === false).length
    : 0;
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const moduleCount = modules.length;

  const uploadMutation = useMutation({
    meta: { silentError: true },
    mutationFn: async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) {
        throw new Error('No files selected');
      }
      const targetBucket = uploadBucket || buckets[0]?.name;
      if (!targetBucket) {
        throw new Error('Create or select a bucket first');
      }

      if (selectedFiles.length === 1) {
        const form = new FormData();
        form.append('file', selectedFiles[0], selectedFiles[0].name);
        form.append('bucket', targetBucket);
        form.append('module', uploadModule.trim() || 'default');
        const result = await apiUpload<{
          success: boolean;
          data: { fileId: string };
        }>('/files/upload', form);
        return {
          success: true,
          data: [{ success: true, fileName: selectedFiles[0].name, data: result.data }],
        };
      }

      const form = new FormData();
      selectedFiles.forEach((file) => form.append('files', file, file.name));
      form.append('bucket', targetBucket);
      form.append('module', uploadModule.trim() || 'default');
      return apiUpload<{
        success: boolean;
        data: Array<{ success: boolean; fileName: string; error?: string }>;
      }>('/files/upload/batch', form);
    },
    onSuccess: (res) => {
      const failed = res.data.filter((item) => !item.success);
      queryClient.invalidateQueries({ queryKey: ['stored-files'] });
      queryClient.invalidateQueries({ queryKey: ['file-modules'] });
      if (failed.length) {
        toast({
          title: 'Some uploads failed',
          description: failed
            .map((f) => `${f.fileName}: ${'error' in f ? f.error : 'failed'}`)
            .join('; '),
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Upload complete', description: `${res.data.length} file(s) uploaded` });
      }
    },
    onError: (err) =>
      toast({ title: 'Upload failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    meta: { silentError: true },
    mutationFn: (payload: { ids: string[]; hard?: boolean }) =>
      apiClient('/files', { method: 'DELETE', body: payload }),
    onSuccess: (_data, payload) => {
      setSelected(new Set());
      removeFilesFromListCache(queryClient, payload.ids);
      void queryClient.refetchQueries({ queryKey: ['stored-files'] });
      toast({ title: trashed ? 'Files purged' : 'Files moved to trash' });
    },
    onError: (err) =>
      toast({ title: 'Delete failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const restoreMutation = useMutation({
    meta: { silentError: true },
    mutationFn: (id: string) => apiClient(`/files/${id}/restore`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      removeFilesFromListCache(queryClient, [id]);
      void queryClient.refetchQueries({ queryKey: ['stored-files'] });
      toast({ title: 'File restored' });
    },
    onError: (err) =>
      toast({ title: 'Restore failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const purgeMutation = useMutation({
    meta: { silentError: true },
    mutationFn: (id: string) => apiClient(`/files/${id}/purge`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      removeFilesFromListCache(queryClient, [id]);
      void queryClient.refetchQueries({ queryKey: ['stored-files'] });
      toast({ title: 'File purged' });
    },
    onError: (err) =>
      toast({ title: 'Purge failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    meta: { silentError: true },
    mutationFn: (payload: {
      id: string;
      description: string | null;
      tags: string[];
      module: string;
    }) =>
      apiClient(`/files/${payload.id}`, {
        method: 'PATCH',
        body: {
          description: payload.description,
          tags: payload.tags,
          module: payload.module,
        },
      }),
    onSuccess: () => {
      setEditFile(null);
      queryClient.invalidateQueries({ queryKey: ['stored-files'] });
      queryClient.invalidateQueries({ queryKey: ['file-modules'] });
      toast({ title: 'Metadata updated' });
    },
    onError: (err) =>
      toast({ title: 'Update failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(files.map((file) => file.id)));
  };

  const downloadFile = async (file: StoredFileRecord) => {
    try {
      const blob = await apiDownloadBlob(`/files/${file.id}/download`);
      saveBlobAsFile(blob, file.originalName);
    } catch (err) {
      toast({ title: 'Download failed', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const openEdit = (file: StoredFileRecord) => {
    setEditFile(file);
    setEditDescription(file.description ?? '');
    setEditTags(file.tags.join(', '));
    setEditModule(file.module);
  };

  return (
    <AppShell>
      <Topbar
        title="Files"
        subtitle="Manage registered files, metadata, and trash"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4 sm:mr-2', isFetching && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {!trashed && (
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending || buckets.length === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title={trashed ? 'In trash' : 'Files shown'}
              value={files.length}
              icon={FileStack}
              accent="blue"
            />
            <StatCard
              title="Total size"
              value={formatBytes(totalBytes)}
              icon={HardDrive}
              accent="emerald"
            />
            <StatCard title="Modules" value={moduleCount} icon={Filter} accent="violet" />
          </div>

          <div className="inline-flex rounded-xl border border-border/60 bg-card/60 p-1">
            <button
              type="button"
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                !trashed ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => {
                setTrashed(false);
                setSelected(new Set());
              }}
            >
              Active
            </button>
            <button
              type="button"
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                trashed ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => {
                setTrashed(true);
                setSelected(new Set());
              }}
            >
              Trash
            </button>
          </div>

          {!trashed && (
            <PageSection
              title="Upload"
              description="Batch upload into a bucket with optional module tag"
              icon={Upload}
            >
              <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Bucket</Label>
                  <Select
                    value={uploadBucket || buckets[0]?.name || ''}
                    onChange={(e) => setUploadBucket(e.target.value)}
                  >
                    {buckets.length === 0 && <option value="">No buckets</option>}
                    {buckets.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Module</Label>
                  <Input
                    list="upload-module-options"
                    value={uploadModule}
                    onChange={(e) => setUploadModule(e.target.value)}
                    placeholder="default"
                  />
                  <datalist id="upload-module-options">
                    {modules.map((moduleName) => (
                      <option key={moduleName} value={moduleName} />
                    ))}
                  </datalist>
                </div>
                <Button
                  className="h-10 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending || buckets.length === 0}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadMutation.isPending ? 'Uploading…' : 'Choose files'}
                </Button>
              </div>
            </PageSection>
          )}

          <PageSection
            title="Filters"
            description="Search by name, module, extension, or bucket"
            icon={Filter}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="File name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                <option value="">All modules</option>
                {modules.map((moduleName) => (
                  <option key={moduleName} value={moduleName}>
                    {moduleName}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Extension (pdf)"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
              />
              <Select value={bucket} onChange={(e) => setBucket(e.target.value)}>
                <option value="">All buckets</option>
                {buckets.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          </PageSection>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium">{selected.size} file(s) selected</p>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate({ ids: Array.from(selected), hard: trashed })
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {trashed ? 'Purge selected' : 'Move to trash'}
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              // Snapshot before clearing — FileList is live and empties with value=''.
              const snapshot = Array.from(list);
              e.target.value = '';
              uploadMutation.mutate(snapshot);
            }}
          />

          <PageSection
            title={trashed ? 'Trash' : 'Library'}
            description={
              trashed
                ? unavailableTrashCount > 0
                  ? `${unavailableTrashCount} entr${unavailableTrashCount === 1 ? 'y' : 'ies'} only have metadata left — the object was deleted from the bucket. Use Purge to remove them.`
                  : 'Restore or permanently purge soft-deleted files'
                : 'Registered files with FileId metadata'
            }
            icon={FileStack}
          >
            {isLoading && !data ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : isError ? (
              <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
            ) : files.length === 0 ? (
              <EmptyState
                icon={FileStack}
                message={trashed ? 'Trash is empty' : 'No files yet. Upload to get started.'}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/50">
                <TableContainer>
                  <table className="w-full table-fixed text-sm">
                    <thead className="border-b border-border/60 bg-muted/30">
                      <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.size === files.length && files.length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-4 py-3">Name</th>
                        <th className="w-28 px-4 py-3">Module</th>
                        <th className="w-24 px-4 py-3">Size</th>
                        <th className="w-40 px-4 py-3">Created</th>
                        <th className="w-14 px-2 py-3 text-right sm:w-16 sm:px-3"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr
                          key={file.id}
                          className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(file.id)}
                              onChange={() => toggleSelect(file.id)}
                            />
                          </td>
                          <td className="max-w-0 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                                <FileStack className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate font-medium"
                                  title={file.originalName}
                                >
                                  {file.originalName}
                                </p>
                                <p
                                  className="truncate text-xs text-muted-foreground"
                                  title={file.path}
                                >
                                  {file.path}
                                </p>
                                {trashed && file.storageAvailable === false && (
                                  <p className="mt-1 text-xs text-amber-400">
                                    Removed from bucket — restore unavailable
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex max-w-full truncate rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs"
                              title={file.module}
                            >
                              {file.module}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                            {formatBytes(Number(file.size))}
                          </td>
                          <td
                            className="whitespace-nowrap px-4 py-3 text-muted-foreground"
                            title={formatDate(file.createdAt)}
                          >
                            {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }).format(new Date(file.createdAt))}
                          </td>
                          <td className="px-2 py-3 align-middle sm:px-3">
                            <div className="flex justify-end">
                              <RowActionsMenu
                                items={
                                  !trashed
                                    ? [
                                        {
                                          label: 'Download',
                                          icon: <Download className="h-4 w-4" />,
                                          onClick: () => downloadFile(file),
                                        },
                                        {
                                          label: 'Edit metadata',
                                          icon: <Pencil className="h-4 w-4" />,
                                          onClick: () => openEdit(file),
                                        },
                                        {
                                          label: 'Move to trash',
                                          icon: <Trash2 className="h-4 w-4" />,
                                          destructive: true,
                                          onClick: () =>
                                            deleteMutation.mutate({
                                              ids: [file.id],
                                              hard: false,
                                            }),
                                        },
                                      ]
                                    : [
                                        ...(file.storageAvailable !== false
                                          ? [
                                              {
                                                label: 'Restore',
                                                icon: <RotateCcw className="h-4 w-4" />,
                                                onClick: () => restoreMutation.mutate(file.id),
                                              },
                                            ]
                                          : []),
                                        {
                                          label: 'Purge forever',
                                          icon: <Trash2 className="h-4 w-4" />,
                                          destructive: true,
                                          onClick: () => purgeMutation.mutate(file.id),
                                        },
                                      ]
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableContainer>
              </div>
            )}
          </PageSection>
        </div>
      </div>

      {editFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-semibold">Edit metadata</h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">{editFile.originalName}</p>
            </div>
            <div className="space-y-2">
              <Label>Module</Label>
              <Input value={editModule} onChange={(e) => setEditModule(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="finance, 2026"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditFile(null)}>
                Cancel
              </Button>
              <Button
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editFile.id,
                    module: editModule.trim() || 'default',
                    description: editDescription.trim() || null,
                    tags: editTags
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
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
