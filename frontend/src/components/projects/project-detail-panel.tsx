'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  ExternalLink,
  Gauge,
  HardDrive,
  Key,
  Link2,
  Plus,
  Shield,
  Trash2,
  Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageSection } from '@/components/ui/page-section';
import { EmptyState } from '@/components/ui/empty-state';
import { SecretBanner } from '@/components/ui/secret-banner';
import { ListItem } from '@/components/ui/list-item';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import {
  WEBHOOK_EVENTS,
  type ApiKeyCreated,
  type ApiKeyRecord,
  type BucketAccessGrantRecord,
  type Project,
  type ProjectQuotaStatus,
  type ProjectS3CredentialStatus,
  type ProjectS3CredentialsCreated,
  type ProjectWebhookCreated,
  type ProjectWebhookRecord,
  type StorageBucket,
} from '@storage/shared';

type ProjectRow = Project & {
  buckets: Array<{ bucketName: string; isDefault: boolean }>;
};

type ProjectsListResponse = {
  success: boolean;
  data: Array<Project & { buckets: Array<{ bucketName: string; isDefault: boolean }> }>;
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'access', label: 'Access & S3' },
  { id: 'automation', label: 'Webhooks & Quotas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function formatBytes(value: string) {
  const bytes = Number(value);
  if (Number.isNaN(bytes)) return value;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function ProjectDetailPanel({ project }: { project: ProjectRow }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [showLinkBucket, setShowLinkBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [linkBucketName, setLinkBucketName] = useState('');
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showCreateGrant, setShowCreateGrant] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [grantForm, setGrantForm] = useState({
    bucketName: project.buckets[0]?.bucketName ?? '',
    subjectType: 'USER' as 'USER' | 'API_KEY',
    subjectId: '',
    prefix: '',
  });
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '' });
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [createdS3Creds, setCreatedS3Creds] = useState<ProjectS3CredentialsCreated | null>(null);
  const [createdWebhook, setCreatedWebhook] = useState<ProjectWebhookCreated | null>(null);
  const [quotaStorageGb, setQuotaStorageGb] = useState('');
  const [quotaObjectCount, setQuotaObjectCount] = useState('');

  const projectId = project.id;

  const { data: keysData } = useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () =>
      apiClient<{ success: boolean; data: ApiKeyRecord[] }>(`/projects/${projectId}/api-keys`),
  });

  const { data: grantsData } = useQuery({
    queryKey: ['bucket-grants', projectId],
    queryFn: () =>
      apiClient<{ success: boolean; data: BucketAccessGrantRecord[] }>(
        `/projects/${projectId}/grants`,
      ),
  });

  const { data: s3CredsData } = useQuery({
    queryKey: ['s3-credentials', projectId],
    queryFn: () =>
      apiClient<{ success: boolean; data: ProjectS3CredentialStatus }>(
        `/projects/${projectId}/s3-credentials`,
      ),
  });

  const { data: webhooksData } = useQuery({
    queryKey: ['project-webhooks', projectId],
    queryFn: () =>
      apiClient<{ success: boolean; data: ProjectWebhookRecord[] }>(
        `/projects/${projectId}/webhooks`,
      ),
  });

  const { data: quotasData } = useQuery({
    queryKey: ['project-quotas', projectId],
    queryFn: () =>
      apiClient<{ success: boolean; data: ProjectQuotaStatus }>(`/projects/${projectId}/quotas`),
  });

  const invalidate = (key: string) =>
    queryClient.invalidateQueries({ queryKey: [key, projectId] });

  const refreshProjects = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const { data: allBucketsData } = useQuery({
    queryKey: ['buckets', 'linkable'],
    queryFn: () => apiClient<{ success: boolean; data: StorageBucket[] }>('/buckets'),
    enabled: showLinkBucket,
  });

  const { data: projectsListData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient<ProjectsListResponse>('/projects'),
    enabled: showLinkBucket,
  });

  const linkedBucketNames = new Set(
    (projectsListData?.data ?? []).flatMap((item) =>
      item.buckets.map((bucket) => bucket.bucketName),
    ),
  );

  const linkableBuckets = (allBucketsData?.data ?? []).filter(
    (bucket) => !linkedBucketNames.has(bucket.name),
  );

  const createBucketMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient(`/projects/${projectId}/buckets`, {
        method: 'POST',
        body: {
          name,
          versioning: false,
          publicAccess: false,
          isDefault: project.buckets.length === 0,
        },
      }),
    onSuccess: () => {
      setShowCreateBucket(false);
      setNewBucketName('');
      refreshProjects();
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      toast({ title: 'Bucket created', description: 'The bucket is linked to this project.' });
    },
    onError: (err) =>
      toast({
        title: 'Failed to create bucket',
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  });

  const linkBucketMutation = useMutation({
    mutationFn: (bucketName: string) =>
      apiClient(`/projects/${projectId}/buckets/link`, {
        method: 'POST',
        body: {
          bucketName,
          isDefault: project.buckets.length === 0,
        },
      }),
    onSuccess: () => {
      setShowLinkBucket(false);
      setLinkBucketName('');
      refreshProjects();
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      toast({ title: 'Bucket linked', description: 'The bucket is now part of this project.' });
    },
    onError: (err) =>
      toast({
        title: 'Failed to link bucket',
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  });

  const unlinkBucketMutation = useMutation({
    mutationFn: (bucketName: string) =>
      apiClient(`/projects/${projectId}/buckets/${encodeURIComponent(bucketName)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      refreshProjects();
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      toast({ title: 'Bucket unlinked' });
    },
    onError: (err) =>
      toast({
        title: 'Failed to unlink bucket',
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient<{ success: boolean; data: ApiKeyCreated }>(`/projects/${projectId}/api-keys`, {
        method: 'POST',
        body: {
          name,
          permissions: ['objects:read', 'objects:write', 'buckets:read'],
          bucketNames: [],
          environment: 'live',
        },
      }),
    onSuccess: (res) => {
      setCreatedKey(res.data);
      setNewKeyName('');
      setShowCreateKey(false);
      invalidate('api-keys');
      toast({ title: 'API key created', description: 'Copy the secret now.' });
    },
    onError: (err) =>
      toast({ title: 'Failed to create key', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiClient(`/projects/${projectId}/api-keys/${keyId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate('api-keys');
      toast({ title: 'API key revoked' });
    },
  });

  const createGrantMutation = useMutation({
    mutationFn: (body: {
      bucketName: string;
      subjectType: 'USER' | 'API_KEY';
      subjectId: string;
      prefix?: string;
      permissions: string[];
    }) => apiClient(`/projects/${projectId}/grants`, { method: 'POST', body }),
    onSuccess: () => {
      setShowCreateGrant(false);
      setGrantForm({
        bucketName: project.buckets[0]?.bucketName ?? '',
        subjectType: 'USER',
        subjectId: '',
        prefix: '',
      });
      invalidate('bucket-grants');
      toast({ title: 'Access grant created' });
    },
    onError: (err) =>
      toast({ title: 'Failed to create grant', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const removeGrantMutation = useMutation({
    mutationFn: (grantId: string) =>
      apiClient(`/projects/${projectId}/grants/${grantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate('bucket-grants');
      toast({ title: 'Grant removed' });
    },
  });

  const provisionS3Mutation = useMutation({
    mutationFn: () =>
      apiClient<{ success: boolean; data: ProjectS3CredentialsCreated }>(
        `/projects/${projectId}/s3-credentials/provision`,
        { method: 'POST' },
      ),
    onSuccess: (res) => {
      setCreatedS3Creds(res.data);
      invalidate('s3-credentials');
      toast({ title: 'S3 credentials provisioned' });
    },
    onError: (err) =>
      toast({ title: 'Provisioning failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const rotateS3Mutation = useMutation({
    mutationFn: () =>
      apiClient<{ success: boolean; data: ProjectS3CredentialsCreated }>(
        `/projects/${projectId}/s3-credentials/rotate`,
        { method: 'POST' },
      ),
    onSuccess: (res) => {
      setCreatedS3Creds(res.data);
      invalidate('s3-credentials');
      toast({ title: 'S3 credentials rotated' });
    },
    onError: (err) =>
      toast({ title: 'Rotation failed', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const revokeS3Mutation = useMutation({
    mutationFn: () => apiClient(`/projects/${projectId}/s3-credentials`, { method: 'DELETE' }),
    onSuccess: () => {
      setCreatedS3Creds(null);
      invalidate('s3-credentials');
      toast({ title: 'S3 credentials revoked' });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) =>
      apiClient<{ success: boolean; data: ProjectWebhookCreated }>(`/projects/${projectId}/webhooks`, {
        method: 'POST',
        body: { name, url, events: ['object.created', 'object.deleted'] },
      }),
    onSuccess: (res) => {
      setCreatedWebhook(res.data);
      setWebhookForm({ name: '', url: '' });
      setShowCreateWebhook(false);
      invalidate('project-webhooks');
      toast({ title: 'Webhook created' });
    },
    onError: (err) =>
      toast({ title: 'Failed to create webhook', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const removeWebhookMutation = useMutation({
    mutationFn: (webhookId: string) =>
      apiClient(`/projects/${projectId}/webhooks/${webhookId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate('project-webhooks');
      toast({ title: 'Webhook removed' });
    },
  });

  const updateQuotasMutation = useMutation({
    mutationFn: (body: { maxStorageBytes: string | null; maxObjectCount: number | null }) =>
      apiClient(`/projects/${projectId}/quotas`, { method: 'PATCH', body }),
    onSuccess: () => {
      invalidate('project-quotas');
      toast({ title: 'Quotas updated' });
    },
    onError: (err) =>
      toast({ title: 'Failed to update quotas', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const reconcileQuotasMutation = useMutation({
    mutationFn: () => apiClient(`/projects/${projectId}/quotas/reconcile`, { method: 'POST' }),
    onSuccess: () => {
      invalidate('project-quotas');
      toast({ title: 'Usage reconciled' });
    },
  });

  const apiKeys = keysData?.data ?? [];
  const grants = grantsData?.data ?? [];
  const s3Creds = s3CredsData?.data;
  const webhooks = webhooksData?.data ?? [];
  const quotas = quotasData?.data;

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="border-t border-border/60">
      <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-4 pt-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors',
              tab === item.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        {tab === 'overview' && (
          <PageSection
            title="Linked buckets"
            description="Dedicated S3 buckets for this tenant. Members and API keys only access buckets linked here."
            icon={HardDrive}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowCreateBucket(true);
                    setShowLinkBucket(false);
                    setNewBucketName(`${project.slug}-storage`);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create bucket
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowLinkBucket(true);
                    setShowCreateBucket(false);
                    setLinkBucketName('');
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Link existing
                </Button>
              </div>
            }
          >
            {showCreateBucket && (
              <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="space-y-2">
                  <Label>Bucket name</Label>
                  <Input
                    placeholder="e.g. acme-uploads"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value.toLowerCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, dots, and hyphens (3–63 characters).
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!newBucketName.trim() || createBucketMutation.isPending}
                    onClick={() => createBucketMutation.mutate(newBucketName.trim())}
                  >
                    Create & link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateBucket(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {showLinkBucket && (
              <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="space-y-2">
                  <Label>Unassigned bucket</Label>
                  {linkableBuckets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No unlinked buckets available. Create a bucket here or from the Buckets page
                      first.
                    </p>
                  ) : (
                    <select
                      className={selectClass}
                      value={linkBucketName}
                      onChange={(e) => setLinkBucketName(e.target.value)}
                    >
                      <option value="">Select a bucket…</option>
                      {linkableBuckets.map((bucket) => (
                        <option key={bucket.name} value={bucket.name}>
                          {bucket.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!linkBucketName || linkBucketMutation.isPending}
                    onClick={() => linkBucketMutation.mutate(linkBucketName)}
                  >
                    Link to project
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowLinkBucket(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {project.buckets.length === 0 ? (
              <EmptyState
                icon={HardDrive}
                message="No buckets linked yet. Create a dedicated bucket for this tenant or link an existing one."
              />
            ) : (
              <div className="space-y-2">
                {project.buckets.map((bucket) => (
                  <ListItem
                    key={bucket.bucketName}
                    action={
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/buckets/${bucket.bucketName}`} title="Browse bucket">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={unlinkBucketMutation.isPending}
                          onClick={() => unlinkBucketMutation.mutate(bucket.bucketName)}
                          title="Unlink from project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  >
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <p className="font-medium">{bucket.bucketName}</p>
                      {bucket.isDefault && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Files uploaded with this project&apos;s API key or S3 credentials go here.
                    </p>
                  </ListItem>
                ))}
              </div>
            )}
          </PageSection>
        )}

        {tab === 'api-keys' && (
          <PageSection
            title="API Keys"
            description="Machine-to-machine auth for external apps"
            icon={Key}
            action={
              <Button size="sm" onClick={() => { setShowCreateKey(true); setCreatedKey(null); }}>
                <Plus className="mr-2 h-4 w-4" />
                New key
              </Button>
            }
          >
            {showCreateKey && (
              <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="space-y-2">
                  <Label>Key name</Label>
                  <Input
                    placeholder="e.g. nextjs-backend"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!newKeyName.trim() || createKeyMutation.isPending}
                    onClick={() => createKeyMutation.mutate(newKeyName.trim())}
                  >
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateKey(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {createdKey && (
              <div className="mb-4">
                <SecretBanner title="Copy your API key now" value={createdKey.key} />
              </div>
            )}

            {apiKeys.length === 0 ? (
              <EmptyState icon={Key} message="No API keys yet" />
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <ListItem
                    key={key.id}
                    action={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => revokeKeyMutation.mutate(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  >
                    <p className="font-medium">{key.name}</p>
                    <p className="text-muted-foreground">{key.keyPrefix}</p>
                    {key.lastUsedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last used {formatDate(key.lastUsedAt)}
                      </p>
                    )}
                  </ListItem>
                ))}
              </div>
            )}
          </PageSection>
        )}

        {tab === 'access' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <PageSection
              title="Access Grants"
              description="Folder-level prefix restrictions"
              icon={Shield}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={project.buckets.length === 0}
                  onClick={() => setShowCreateGrant(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New grant
                </Button>
              }
            >
              {showCreateGrant && (
                <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label>Bucket</Label>
                    <select
                      className={selectClass}
                      value={grantForm.bucketName}
                      onChange={(e) =>
                        setGrantForm((prev) => ({ ...prev, bucketName: e.target.value }))
                      }
                    >
                      {project.buckets.map((b) => (
                        <option key={b.bucketName} value={b.bucketName}>
                          {b.bucketName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Subject type</Label>
                      <select
                        className={selectClass}
                        value={grantForm.subjectType}
                        onChange={(e) =>
                          setGrantForm((prev) => ({
                            ...prev,
                            subjectType: e.target.value as 'USER' | 'API_KEY',
                          }))
                        }
                      >
                        <option value="USER">User</option>
                        <option value="API_KEY">API key</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject ID</Label>
                      <Input
                        placeholder="UUID"
                        value={grantForm.subjectId}
                        onChange={(e) =>
                          setGrantForm((prev) => ({ ...prev, subjectId: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Folder prefix (optional)</Label>
                    <Input
                      placeholder="uploads/"
                      value={grantForm.prefix}
                      onChange={(e) =>
                        setGrantForm((prev) => ({ ...prev, prefix: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !grantForm.bucketName ||
                        !grantForm.subjectId.trim() ||
                        createGrantMutation.isPending
                      }
                      onClick={() =>
                        createGrantMutation.mutate({
                          bucketName: grantForm.bucketName,
                          subjectType: grantForm.subjectType,
                          subjectId: grantForm.subjectId.trim(),
                          prefix: grantForm.prefix,
                          permissions: ['objects:read', 'objects:write', 'buckets:read'],
                        })
                      }
                    >
                      Create
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCreateGrant(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {grants.length === 0 ? (
                <EmptyState icon={Shield} message="No access grants" />
              ) : (
                <div className="space-y-2">
                  {grants.map((grant) => (
                    <ListItem
                      key={grant.id}
                      action={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeGrantMutation.mutate(grant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    >
                      <p className="font-medium">
                        {grant.bucketName}
                        {grant.prefix ? ` / ${grant.prefix}` : ' (full bucket)'}
                      </p>
                      <p className="text-muted-foreground">
                        {grant.subjectType}: {grant.subjectLabel ?? grant.subjectId}
                      </p>
                    </ListItem>
                  ))}
                </div>
              )}
            </PageSection>

            <PageSection
              title="Direct S3 Credentials"
              description="Per-tenant Garage keys for SDK access"
              icon={Cloud}
              action={
                !s3Creds?.provisioned ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      project.buckets.length === 0 ||
                      !s3Creds?.garageAdminConfigured ||
                      provisionS3Mutation.isPending
                    }
                    onClick={() => {
                      setCreatedS3Creds(null);
                      provisionS3Mutation.mutate();
                    }}
                  >
                    Provision
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rotateS3Mutation.isPending}
                      onClick={() => {
                        setCreatedS3Creds(null);
                        rotateS3Mutation.mutate();
                      }}
                    >
                      Rotate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={revokeS3Mutation.isPending}
                      onClick={() => revokeS3Mutation.mutate()}
                    >
                      Revoke
                    </Button>
                  </div>
                )
              }
            >
              {!s3Creds?.garageAdminConfigured && (
                <p className="mb-3 text-sm text-amber-400/90">
                  Configure GARAGE_ADMIN_ENDPOINT and GARAGE_ADMIN_TOKEN to enable provisioning.
                </p>
              )}

              {createdS3Creds && (
                <div className="mb-4">
                  <SecretBanner
                    title="Copy S3 credentials now"
                    value={JSON.stringify(createdS3Creds, null, 2)}
                  />
                </div>
              )}

              {s3Creds?.provisioned ? (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">Access key</span>
                    <br />
                    <code className="text-xs">{s3Creds.accessKeyId}</code>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Endpoint</span>
                    <br />
                    {s3Creds.endpoint}
                  </p>
                </div>
              ) : (
                <EmptyState icon={Cloud} message="Not provisioned" />
              )}
            </PageSection>
          </div>
        )}

        {tab === 'automation' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <PageSection
              title="Webhooks"
              description={`Events: ${WEBHOOK_EVENTS.join(', ')}`}
              icon={Webhook}
              action={
                <Button size="sm" variant="outline" onClick={() => setShowCreateWebhook(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New webhook
                </Button>
              }
            >
              {showCreateWebhook && (
                <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={webhookForm.name}
                      onChange={(e) =>
                        setWebhookForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Endpoint URL</Label>
                    <Input
                      value={webhookForm.url}
                      onChange={(e) =>
                        setWebhookForm((prev) => ({ ...prev, url: e.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !webhookForm.name.trim() ||
                        !webhookForm.url.trim() ||
                        createWebhookMutation.isPending
                      }
                      onClick={() =>
                        createWebhookMutation.mutate({
                          name: webhookForm.name.trim(),
                          url: webhookForm.url.trim(),
                        })
                      }
                    >
                      Create
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCreateWebhook(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {createdWebhook && (
                <div className="mb-4">
                  <SecretBanner title="Webhook signing secret" value={createdWebhook.secret} />
                </div>
              )}

              {webhooks.length === 0 ? (
                <EmptyState icon={Webhook} message="No webhooks configured" />
              ) : (
                <div className="space-y-2">
                  {webhooks.map((hook) => (
                    <ListItem
                      key={hook.id}
                      action={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeWebhookMutation.mutate(hook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    >
                      <p className="font-medium">{hook.name}</p>
                      <p className="truncate text-muted-foreground">{hook.url}</p>
                    </ListItem>
                  ))}
                </div>
              )}
            </PageSection>

            <PageSection
              title="Storage Quotas"
              description="Limit usage across project buckets"
              icon={Gauge}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reconcileQuotasMutation.isPending}
                  onClick={() => reconcileQuotasMutation.mutate()}
                >
                  Reconcile
                </Button>
              }
            >
              {quotas && (
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Storage used</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatBytes(quotas.usage.storageBytes)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Objects</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {quotas.usage.objectCount}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max storage (GB)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Unlimited"
                    value={quotaStorageGb}
                    onChange={(e) => setQuotaStorageGb(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max objects</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Unlimited"
                    value={quotaObjectCount}
                    onChange={(e) => setQuotaObjectCount(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="mt-4"
                disabled={updateQuotasMutation.isPending}
                onClick={() => {
                  const gb = quotaStorageGb.trim();
                  const count = quotaObjectCount.trim();
                  updateQuotasMutation.mutate({
                    maxStorageBytes: gb ? String(Math.round(Number(gb) * 1024 ** 3)) : null,
                    maxObjectCount: count ? Number(count) : null,
                  });
                }}
              >
                Save quotas
              </Button>
            </PageSection>
          </div>
        )}
      </div>
    </div>
  );
}
