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

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}` || 'U';

  return (
    <header className="shrink-0 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-xl">{title}</h1>
          {subtitle && (
            <p className="hidden truncate text-sm text-muted-foreground sm:block">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="hidden items-center gap-2 md:flex">{actions}</div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 sm:inline-flex"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>

        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card/50 py-1 pl-1 pr-1 sm:rounded-lg sm:pl-1.5 sm:pr-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
            title={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
          >
            {initials}
          </div>
          <div className="hidden min-w-0 pr-1 text-sm lg:block">
            <p className="truncate font-medium leading-none">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 lg:inline-flex"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-border/40 px-3 py-2 md:hidden">
          {actions}
        </div>
      )}
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
