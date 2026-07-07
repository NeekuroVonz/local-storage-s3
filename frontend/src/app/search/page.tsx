'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { formatBytes, formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import Link from 'next/link';

function getObjectFolderPrefix(key: string): string {
  const parts = key.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  return `${parts.slice(0, -1).join('/')}/`;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    clearTimeout((window as unknown as { searchTimeout?: ReturnType<typeof setTimeout> }).searchTimeout);
    (window as unknown as { searchTimeout?: ReturnType<typeof setTimeout> }).searchTimeout = setTimeout(
      () => setDebouncedQuery(value),
      300,
    );
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () =>
      apiClient<{ success: boolean; data: Array<{ bucket: string; key: string; name: string; size: number; lastModified: string }> }>(
        '/search',
        { params: { q: debouncedQuery, limit: 50 } },
      ),
    enabled: debouncedQuery.trim().length >= 1,
  });

  const results = data?.data ?? [];

  return (
    <AppShell>
      <Topbar title="Search" subtitle="Find objects across all buckets" />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="relative max-w-2xl mx-auto mb-8">
          <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files and folders..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-12 h-12 text-lg"
            autoFocus
          />
        </div>

        {debouncedQuery.trim().length < 1 ? (
          <p className="text-center text-muted-foreground">Type a file name or path to search</p>
        ) : isLoading ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-destructive">
            Search failed: {getErrorMessage(error)}
          </p>
        ) : results.length === 0 ? (
          <p className="text-center text-muted-foreground">No results found for &quot;{debouncedQuery}&quot;</p>
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground mb-4">{results.length} result(s)</p>
            {results.map((item) => {
              const folderPrefix = getObjectFolderPrefix(item.key);
              const href = folderPrefix
                ? `/buckets/${item.bucket}?prefix=${encodeURIComponent(folderPrefix)}`
                : `/buckets/${item.bucket}`;

              return (
                <Link key={`${item.bucket}/${item.key}`} href={href}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {item.bucket} / {item.key}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground sm:text-right">
                        <p>{formatBytes(item.size)}</p>
                        <p>{formatDate(item.lastModified)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
