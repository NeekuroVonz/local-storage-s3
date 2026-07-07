'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  HardDrive,
  Search,
  Share2,
  Settings,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FolderKanban,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { ThemeToggle } from '@/components/ui/toaster';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/buckets', label: 'Buckets', icon: HardDrive },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/shares', label: 'Sharing', icon: Share2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, mobileNavOpen, toggleSidebar, closeMobileNav, setMobileNavOpen } =
    useUIStore();

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileNav();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNavOpen, closeMobileNav]);

  return (
    <>
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation"
          onClick={closeMobileNav}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col border-r bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 lg:relative lg:z-auto lg:max-w-none lg:shadow-none',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b',
            sidebarCollapsed ? 'lg:justify-center' : 'justify-between gap-2 px-4',
          )}
        >
          <div className={cn('flex min-w-0 items-center gap-2', sidebarCollapsed && 'lg:justify-center')}>
            <Cloud className="h-6 w-6 shrink-0 text-primary" />
            {(!sidebarCollapsed || mobileNavOpen) && (
              <span className="truncate font-semibold tracking-tight lg:hidden">
                Storage Platform
              </span>
            )}
            {!sidebarCollapsed && (
              <span className="hidden truncate font-semibold tracking-tight lg:inline">
                Storage Platform
              </span>
            )}
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent lg:hidden"
            aria-label="Close navigation"
            onClick={closeMobileNav}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className={cn('flex-1 space-y-1 overflow-y-auto p-2', sidebarCollapsed && 'lg:px-1.5')}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  'flex items-center rounded-lg text-sm transition-colors',
                  sidebarCollapsed ? 'lg:justify-center lg:p-2.5' : 'gap-3 px-3 py-2.5',
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn('truncate', sidebarCollapsed && 'lg:hidden')}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            'border-t p-2',
            sidebarCollapsed
              ? 'lg:flex lg:flex-col lg:items-center lg:gap-1'
              : 'flex items-center justify-between',
          )}
        >
          <ThemeToggle />
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent lg:flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
