'use client';

import { use, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  Folder,
  File,
  ChevronRight,
  Home,
  Grid3X3,
  List,
  Trash2,
  Download,
  FolderPlus,
  Upload,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Code,
  Archive,
  ExternalLink,
  Link2,
  Copy,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar, UploadButton } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { TableContainer } from '@/components/ui/table-container';
import { apiClient, apiUpload } from '@/lib/api-client';
import {
  copyObjectUrl,
  copyS3Uri,
  downloadObject,
  downloadObjectsAsZip,
  openObject,
} from '@/lib/storage-actions';
import { formatBytes, formatDate, getFileIcon, cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { useUIStore, useUploadStore } from '@/stores';
import { toast } from '@/components/ui/toaster';
import type { ListObjectsResult } from '@storage/shared';

type ExplorerItem = {
  key: string;
  name: string;
  isFolder: boolean;
  size?: number;
  lastModified?: string;
};

type ActionDialog = 'rename' | 'copy' | 'move' | null;

const iconMap = {
  image: ImageIcon,
  document: FileText,
  video: Film,
  audio: Music,
  code: Code,
  archive: Archive,
  file: File,
};

function FileIcon({ name, isFolder }: { name: string; isFolder: boolean }) {
  if (isFolder) return <Folder className="h-5 w-5 text-amber-500" />;
  const type = getFileIcon(name);
  const Icon = iconMap[type as keyof typeof iconMap] ?? File;
  return <Icon className="h-5 w-5 text-muted-foreground" />;
}

export default function BucketExplorerPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: bucketName } = use(params);
  const searchParams = useSearchParams();
  const [prefix, setPrefix] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [actionTargetKey, setActionTargetKey] = useState('');
  const [actionDestination, setActionDestination] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { viewMode, setViewMode } = useUIStore();
  const { queue, addToQueue, updateStatus } = useUploadStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefixParam = searchParams.get('prefix');
    if (prefixParam !== null) {
      setPrefix(prefixParam);
    }
  }, [searchParams]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['objects', bucketName, prefix],
    queryFn: () =>
      apiClient<{ success: boolean; data: ListObjectsResult }>(
        `/buckets/${bucketName}/objects`,
        { params: { prefix, delimiter: '/', maxKeys: 100 } },
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (keys: string[]) =>
      apiClient(`/buckets/${bucketName}/objects`, { method: 'DELETE', body: { keys } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      setSelectedKeys(new Set());
      toast({ title: 'Deleted successfully' });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (folderName: string) => {
      const normalized = folderName.trim().replace(/^\/+|\/+$/g, '');
      if (!normalized) {
        throw new Error('Folder name is required');
      }
      const folderPrefix = `${prefix}${normalized}/`;
      return apiClient(`/buckets/${bucketName}/objects/folder`, {
        method: 'POST',
        body: { prefix: folderPrefix },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      setNewFolderName('');
      setShowCreateFolder(false);
      toast({ title: 'Folder created' });
    },
  });

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast({ title: 'Folder name required', description: 'Enter a name for the new folder.', variant: 'destructive' });
      return;
    }
    createFolderMutation.mutate(newFolderName);
  };

  const objects = data?.data?.objects ?? [];
  const prefixes = data?.data?.prefixes ?? [];
  const breadcrumbs = prefix.split('/').filter(Boolean);

  const allItems: ExplorerItem[] = [
    ...prefixes.map((p) => ({
      key: p,
      name: p.replace(prefix, '').replace(/\/$/, ''),
      isFolder: true,
    })),
    ...objects.filter((o) => o.key !== prefix && !o.isFolder).map((o) => ({
      key: o.key,
      name: o.name,
      isFolder: false,
      size: o.size,
      lastModified: o.lastModified,
    })),
  ];

  const filteredItems = searchQuery.trim()
    ? allItems.filter((item) => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : allItems;

  const selectedItems = allItems.filter((item) => selectedKeys.has(item.key));
  const selectedFiles = selectedItems.filter((item) => !item.isFolder);
  const singleSelectedFile = selectedFiles.length === 1 ? selectedFiles[0] : null;
  const singleSelectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  const handleDownload = async () => {
    if (selectedFiles.length === 0) return;
    setIsActionLoading(true);
    try {
      if (selectedFiles.length === 1) {
        await downloadObject(bucketName, selectedFiles[0].key);
      } else {
        await downloadObjectsAsZip(bucketName, selectedFiles.map((item) => item.key));
      }
      toast({ title: 'Download started' });
    } catch (error) {
      toast({ title: 'Download failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!singleSelectedFile) return;
    setIsActionLoading(true);
    try {
      await openObject(bucketName, singleSelectedFile.key);
    } catch (error) {
      toast({ title: 'Open failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopyS3Uri = async () => {
    if (!singleSelectedItem) return;
    try {
      await copyS3Uri(bucketName, singleSelectedItem.key);
      toast({ title: 'S3 URI copied' });
    } catch (error) {
      toast({ title: 'Copy failed', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleCopyUrl = async () => {
    if (!singleSelectedFile) return;
    setIsActionLoading(true);
    try {
      await copyObjectUrl(bucketName, singleSelectedFile.key);
      toast({ title: 'URL copied', description: 'Presigned link expires in 1 hour.' });
    } catch (error) {
      toast({ title: 'Copy failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const openActionDialog = (action: ActionDialog, key: string, defaultDestination = '') => {
    setActionDialog(action);
    setActionTargetKey(key);
    setActionDestination(defaultDestination);
  };

  const closeActionDialog = () => {
    setActionDialog(null);
    setActionTargetKey('');
    setActionDestination('');
  };

  const handleRename = async () => {
    const newName = actionDestination.trim().replace(/^\/+|\/+$/g, '');
    if (!newName || !actionTargetKey) return;
    const item = allItems.find((entry) => entry.key === actionTargetKey);
    const parentPrefix = item?.isFolder
      ? actionTargetKey.slice(0, -item.name.length - 1)
      : prefix;
    const destinationKey = item?.isFolder
      ? `${parentPrefix}${newName}/`
      : `${parentPrefix}${newName}`;
    setIsActionLoading(true);
    try {
      await apiClient(`/buckets/${bucketName}/objects/rename`, {
        method: 'POST',
        body: { sourceKey: actionTargetKey, destinationKey },
      });
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      setSelectedKeys(new Set());
      closeActionDialog();
      toast({ title: 'Renamed successfully' });
    } catch (error) {
      toast({ title: 'Rename failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopy = async () => {
    const destinationKey = actionDestination.trim().replace(/^\/+/, '');
    if (!destinationKey || !actionTargetKey) return;
    setIsActionLoading(true);
    try {
      await apiClient(`/buckets/${bucketName}/objects/copy`, {
        method: 'POST',
        body: { sourceKey: actionTargetKey, destinationKey },
      });
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      closeActionDialog();
      toast({ title: 'Copied successfully' });
    } catch (error) {
      toast({ title: 'Copy failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMove = async () => {
    const destinationKey = actionDestination.trim().replace(/^\/+/, '');
    if (!destinationKey || !actionTargetKey) return;
    setIsActionLoading(true);
    try {
      await apiClient(`/buckets/${bucketName}/objects/move`, {
        method: 'POST',
        body: { sourceKey: actionTargetKey, destinationKey },
      });
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      setSelectedKeys(new Set());
      closeActionDialog();
      toast({ title: 'Moved successfully' });
    } catch (error) {
      toast({ title: 'Move failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleItemOpen = async (item: ExplorerItem) => {
    if (item.isFolder) {
      setPrefix(item.key);
      setSelectedKeys(new Set());
      return;
    }
    setIsActionLoading(true);
    try {
      await openObject(bucketName, item.key);
    } catch (error) {
      toast({ title: 'Open failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const key = prefix + file.name;
        const id = crypto.randomUUID();
        addToQueue([{ id, file, bucket: bucketName, key, progress: 0, status: 'pending' }]);

        try {
          updateStatus(id, 'uploading');
          const formData = new FormData();
          formData.append('file', file);
          await apiUpload(`/buckets/${bucketName}/upload`, formData, { key });
          updateStatus(id, 'completed');
        } catch (error) {
          updateStatus(id, 'failed', error instanceof Error ? error.message : 'Upload failed');
          toast({ title: 'Upload failed', description: getErrorMessage(error), variant: 'destructive' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      toast({ title: 'Upload complete', description: `${acceptedFiles.length} file(s) uploaded.` });
    },
    [bucketName, prefix, addToQueue, updateStatus, queryClient],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const navigateToPrefix = (index: number) => {
    const parts = breadcrumbs.slice(0, index + 1);
    setPrefix(parts.length > 0 ? parts.join('/') + '/' : '');
    setSelectedKeys(new Set());
  };

  return (
    <AppShell>
      <div {...getRootProps()} className="flex flex-1 flex-col overflow-hidden">
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary m-4 rounded-xl">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-primary mb-2" />
              <p className="text-lg font-medium">Drop files to upload</p>
            </div>
          </div>
        )}

        <Topbar
          title={bucketName}
          subtitle={`${filteredItems.length} items`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
                <FolderPlus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Folder</span>
              </Button>
              <UploadButton onClick={() => setShowUpload(true)} />
            </>
          }
        />

        <div className="flex items-center gap-1 overflow-x-auto border-b px-4 py-2 text-sm sm:px-6">
          <button onClick={() => { setPrefix(''); setSelectedKeys(new Set()); }} className="flex items-center gap-1 hover:text-primary">
            <Home className="h-4 w-4" />
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button onClick={() => navigateToPrefix(i)} className="hover:text-primary">{part}</button>
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              </Button>
              {selectedKeys.size > 0 && (
                <span className="text-sm text-muted-foreground">{selectedKeys.size} selected</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative w-full min-w-[140px] max-w-[220px] sm:max-w-none">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Find by prefix"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('table')}>
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')}>
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedKeys.size > 0 && (
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex w-max gap-2 px-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyS3Uri}
                  disabled={!singleSelectedItem}
                  title="Copy S3 URI"
                >
                  <Link2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Copy S3 URI</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  disabled={!singleSelectedFile || isActionLoading}
                  title="Copy presigned URL"
                >
                  <Copy className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Copy URL</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpen}
                  disabled={!singleSelectedFile || isActionLoading}
                >
                  <ExternalLink className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Open</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={selectedFiles.length === 0 || isActionLoading}
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!singleSelectedItem) return;
                    openActionDialog(
                      'rename',
                      singleSelectedItem.key,
                      singleSelectedItem.isFolder
                        ? singleSelectedItem.name
                        : singleSelectedItem.name,
                    );
                  }}
                  disabled={!singleSelectedItem}
                >
                  <Pencil className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Rename</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!singleSelectedItem) return;
                    openActionDialog('copy', singleSelectedItem.key, `${singleSelectedItem.key}-copy`);
                  }}
                  disabled={!singleSelectedItem}
                >
                  <Copy className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Copy to</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!singleSelectedItem) return;
                    openActionDialog('move', singleSelectedItem.key, singleSelectedItem.key);
                  }}
                  disabled={!singleSelectedItem}
                >
                  <span className="hidden sm:inline">Move to</span>
                  <span className="sm:hidden">Move</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(Array.from(selectedKeys))}
                >
                  <Trash2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Folder className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery.trim() ? 'No objects match your search' : 'This folder is empty'}
              </p>
              {!searchQuery.trim() && (
                <p className="text-sm text-muted-foreground">Drag and drop files here to upload</p>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <TableContainer>
              <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Name</th>
                  <th className="p-3 w-32">Size</th>
                  <th className="p-3 w-48">Modified</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.key}
                    className={cn(
                      'border-b hover:bg-muted/50 cursor-pointer transition-colors',
                      selectedKeys.has(item.key) && 'bg-primary/5',
                    )}
                    onClick={() => item.isFolder ? setPrefix(item.key) : toggleSelect(item.key)}
                    onDoubleClick={() => handleItemOpen(item)}
                  >
                    <td className="p-3" onClick={(e) => { e.stopPropagation(); toggleSelect(item.key); }}>
                      <input type="checkbox" checked={selectedKeys.has(item.key)} readOnly />
                    </td>
                    <td className="p-3 flex items-center gap-2">
                      <FileIcon name={item.name} isFolder={item.isFolder} />
                      <span className="font-medium">{item.name}</span>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {item.isFolder ? '—' : formatBytes(item.size ?? 0)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {item.lastModified ? formatDate(item.lastModified) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </TableContainer>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 md:grid-cols-4 lg:grid-cols-6">
              {filteredItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => item.isFolder ? setPrefix(item.key) : toggleSelect(item.key)}
                  onDoubleClick={() => handleItemOpen(item)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 hover:border-primary/50 transition-colors',
                    selectedKeys.has(item.key) && 'border-primary bg-primary/5',
                  )}
                >
                  <FileIcon name={item.name} isFolder={item.isFolder} />
                  <span className="text-sm font-medium truncate w-full text-center">{item.name}</span>
                  {!item.isFolder && (
                    <span className="text-xs text-muted-foreground">{formatBytes(item.size ?? 0)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {queue.length > 0 && (
          <div className="border-t bg-muted/30 p-4">
            <p className="mb-2 text-sm font-medium">
              Upload Queue ({queue.filter((q) => q.status === 'uploading').length} active)
            </p>
            <div className="max-h-32 space-y-2 overflow-auto">
              {queue.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="truncate text-sm sm:flex-1">{item.file.name}</span>
                  <Progress value={item.progress} className="w-full sm:w-32" />
                  <span className="text-xs capitalize text-muted-foreground sm:w-16">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {actionDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">
                {actionDialog === 'rename' && 'Rename'}
                {actionDialog === 'copy' && 'Copy to'}
                {actionDialog === 'move' && 'Move to'}
              </h3>
              <Input
                placeholder={
                  actionDialog === 'rename'
                    ? 'new-name'
                    : 'destination/path/object-key'
                }
                value={actionDestination}
                onChange={(e) => setActionDestination(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (actionDialog === 'rename') handleRename();
                    if (actionDialog === 'copy') handleCopy();
                    if (actionDialog === 'move') handleMove();
                  }
                }}
                autoFocus
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {actionDialog === 'rename'
                  ? `Renaming: ${actionTargetKey}`
                  : `Source: ${actionTargetKey}`}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={closeActionDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (actionDialog === 'rename') handleRename();
                    if (actionDialog === 'copy') handleCopy();
                    if (actionDialog === 'move') handleMove();
                  }}
                  disabled={isActionLoading || !actionDestination.trim()}
                >
                  {actionDialog === 'rename' && 'Rename'}
                  {actionDialog === 'copy' && 'Copy'}
                  {actionDialog === 'move' && 'Move'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showCreateFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
              <Input
                placeholder="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Will be created at: {prefix}{newFolderName.trim() ? `${newFolderName.trim().replace(/^\/+|\/+$/g, '')}/` : '...'}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFolder} disabled={createFolderMutation.isPending}>
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
              <UploadDropzone bucket={bucketName} prefix={prefix} onClose={() => setShowUpload(false)} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function UploadDropzone({ bucket, prefix, onClose }: { bucket: string; prefix: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { addToQueue, updateStatus } = useUploadStore();

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const key = prefix + file.name;
        const id = crypto.randomUUID();
        addToQueue([{ id, file, bucket, key, progress: 0, status: 'pending' }]);
        try {
          updateStatus(id, 'uploading');
          const formData = new FormData();
          formData.append('file', file);
          await apiUpload(`/buckets/${bucket}/upload`, formData, { key });
          updateStatus(id, 'completed');
        } catch (error) {
          updateStatus(id, 'failed', error instanceof Error ? error.message : 'Upload failed');
          toast({ title: 'Upload failed', description: getErrorMessage(error), variant: 'destructive' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['objects', bucket] });
      onClose();
    },
    [bucket, prefix, addToQueue, updateStatus, queryClient, onClose],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm">Drag & drop files here, or click to select</p>
      </div>
      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
