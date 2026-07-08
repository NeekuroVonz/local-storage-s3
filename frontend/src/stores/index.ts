import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@storage/shared';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  viewMode: 'table' | 'grid';
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  closeMobileNav: () => void;
  setViewMode: (mode: 'table' | 'grid') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  viewMode: 'table',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  setViewMode: (viewMode) => set({ viewMode }),
}));

interface UploadItem {
  id: string;
  file: File;
  bucket: string;
  key: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  error?: string;
  speed?: number;
}

interface UploadState {
  queue: UploadItem[];
  addToQueue: (items: UploadItem[]) => void;
  updateProgress: (id: string, progress: number, speed?: number) => void;
  updateStatus: (id: string, status: UploadItem['status'], error?: string) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  queue: [],
  addToQueue: (items) => set((s) => ({ queue: [...s.queue, ...items] })),
  updateProgress: (id, progress, speed) =>
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id ? { ...item, progress, speed, status: 'uploading' as const } : item,
      ),
    })),
  updateStatus: (id, status, error) => {
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id
          ? { ...item, status, error, progress: status === 'completed' ? 100 : item.progress }
          : item,
      ),
    }));

    if (status === 'completed') {
      window.setTimeout(() => {
        useUploadStore.getState().removeFromQueue(id);
      }, 1500);
    }
  },
  removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((item) => item.id !== id) })),
  clearCompleted: () =>
    set((s) => ({ queue: s.queue.filter((item) => item.status !== 'completed') })),
}));

export type { UploadItem };
