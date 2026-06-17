"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['activity', profileId] as const;

export function useActivityLogsLocal(limit = 200) {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...KEY(profile?.id ?? ''), limit] as const,
    queryFn: () => ipcInvoke<unknown[]>('activity:getAll', profile!.id, limit),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateActivityLogLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('activity:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}
