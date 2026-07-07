'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FolderKanban, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectDetailPanel } from '@/components/projects/project-detail-panel';
import { apiClient } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { API_KEY_PERMISSIONS, type Organization, type Project } from '@storage/shared';

type ProjectRow = Project & {
  organization?: { displayName: string };
  buckets: Array<{ bucketName: string; isDefault: boolean }>;
  _count?: { members: number };
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient<{ success: boolean; data: ProjectRow[] }>('/projects'),
  });

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => apiClient<{ success: boolean; data: Organization[] }>('/organizations'),
  });

  const organizations = orgsData?.data ?? [];
  const projects = data?.data ?? [];

  useEffect(() => {
    if (!organizationId && organizations.length > 0) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizationId, organizations]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const createMutation = useMutation({
    mutationFn: (body: {
      organizationId: string;
      name: string;
      slug: string;
      description?: string;
    }) => apiClient<{ success: boolean; data: Project }>('/projects', { method: 'POST', body }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setName('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
      setExpandedId(response.data.id);
      toast({ title: 'Project created', description: `${response.data.name} is ready.` });
    },
    onError: (err) =>
      toast({
        title: 'Failed to create project',
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  });

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const canSubmit =
    organizationId.trim().length > 0 &&
    name.trim().length >= 2 &&
    slug.trim().length >= 2 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim());

  return (
    <AppShell>
      <Topbar
        title="Projects"
        subtitle="Tenants, API keys, access control, and automation"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New project</span>
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
          {showCreate && (
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Create project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each project is an isolated tenant with its own buckets, API keys, and storage
                  limits.
                </p>

                {organizations.length === 0 ? (
                  <p className="text-sm text-amber-400/90">
                    No organizations found. Create one via POST /organizations first, or run the
                    database seed.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="project-org">Organization</Label>
                      <select
                        id="project-org"
                        className={selectClass}
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project name</Label>
                        <Input
                          id="project-name"
                          placeholder="e.g. Acme Corp"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-slug">Slug</Label>
                        <Input
                          id="project-slug"
                          placeholder="e.g. acme-corp"
                          value={slug}
                          onChange={(e) => {
                            setSlugTouched(true);
                            setSlug(e.target.value.toLowerCase());
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Lowercase letters, numbers, and hyphens only.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description (optional)</Label>
                      <Input
                        id="project-description"
                        placeholder="What this tenant uses storage for"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canSubmit || createMutation.isPending || organizations.length === 0}
                    onClick={() =>
                      createMutation.mutate({
                        organizationId,
                        name: name.trim(),
                        slug: slug.trim(),
                        ...(description.trim() ? { description: description.trim() } : {}),
                      })
                    }
                  >
                    Create project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      setName('');
                      setSlug('');
                      setSlugTouched(false);
                      setDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-center text-destructive">{getErrorMessage(error)}</p>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              message="No projects yet. Create your first tenant to get started."
            />
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const expanded = expandedId === project.id;
                return (
                  <Card
                    key={project.id}
                    className={cn(
                      'overflow-hidden border-border/60 bg-card/80 shadow-sm transition-shadow',
                      expanded && 'ring-1 ring-primary/20',
                    )}
                  >
                    <CardHeader className="p-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30"
                        onClick={() => setExpandedId(expanded ? null : project.id)}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <FolderKanban className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base">{project.name}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {project.slug}
                            {project.organization?.displayName &&
                              ` · ${project.organization.displayName}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                            {project.buckets.length} bucket{project.buckets.length !== 1 ? 's' : ''}
                            {project._count?.members !== undefined &&
                              ` · ${project._count.members} member${project._count.members !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                            {project.buckets.length} bucket{project.buckets.length !== 1 ? 's' : ''}
                          </span>
                          {project._count?.members !== undefined && (
                            <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                              {project._count.members} member
                              {project._count.members !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {expanded ? (
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </CardHeader>
                    {expanded && <ProjectDetailPanel project={project} />}
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Integration quick reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Authenticate external apps with a project API key:</p>
              <code className="block rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-foreground">
                Authorization: Bearer sk_live_...
              </code>
              <p className="text-xs">Allowed permissions: {API_KEY_PERMISSIONS.join(', ')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
