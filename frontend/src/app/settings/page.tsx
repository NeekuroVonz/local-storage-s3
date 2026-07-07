'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/components/ui/toaster';
import type { AuthUser } from '@storage/shared';

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: profileResponse, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiClient<{ success: boolean; data: AuthUser }>('/auth/me'),
  });

  const { data: settingsResponse, isError: settingsForbidden } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => apiClient<{ success: boolean; data: Record<string, unknown> }>('/settings'),
    retry: false,
  });

  const profile = profileResponse?.data;
  const systemSettings = settingsResponse?.data;

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      apiClient('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated' });
    },
    onError: (err) => {
      toast({ title: 'Password change failed', description: getErrorMessage(err), variant: 'destructive' });
    },
  });

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <AppShell>
      <Topbar title="Settings" subtitle="Account and platform configuration" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 max-w-2xl space-y-6 mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? (
              <div className="h-20 animate-pulse rounded bg-muted" />
            ) : profile ? (
              <>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{profile.firstName} {profile.lastName}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="break-all sm:text-right">{profile.email}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="capitalize">{profile.role}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <span className="text-muted-foreground">Email verified</span>
                  <span>{profile.emailVerified ? 'Yes' : 'No'}</span>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}
            >
              Update password
            </Button>
          </CardContent>
        </Card>

        {!settingsForbidden && systemSettings && (
          <Card>
            <CardHeader>
              <CardTitle>System settings</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(systemSettings).length === 0 ? (
                <p className="text-sm text-muted-foreground">No system settings configured.</p>
              ) : (
                <pre className="text-xs overflow-auto rounded-lg bg-muted p-4">
                  {JSON.stringify(systemSettings, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
