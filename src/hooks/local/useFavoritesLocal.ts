"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['favorites', profileId] as const;

export function useFavoritesLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('favorites:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateFavoriteLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('favorites:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useIncrementFavoriteUsageLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('favorites:incrementUsage', id),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useDeleteFavoriteLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('favorites:delete', id),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}
