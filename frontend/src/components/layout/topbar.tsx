'use client';

import { Bell, LogOut, Menu, Upload } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from '@/components/ui/toaster';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { user, clearAuth } = useAuthStore();
  const { setMobileNavOpen } = useUIStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient('/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      // Continue logout even if API fails
    }
    clearAuth();
    router.push('/login');
    toast({ title: 'Logged out', description: 'You have been signed out successfully.' });
  };

  return (
    <header className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:truncate sm:line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5 sm:px-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="hidden min-w-0 text-sm md:block">
              <p className="truncate font-medium leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs capitalize text-muted-foreground">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function UploadButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="sm" className="shrink-0">
      <Upload className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Upload</span>
    </Button>
  );
}
