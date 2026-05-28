"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['clients', profileId] as const;

export function useClientsLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('clients:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,  // always fresh — mutate then invalidate triggers refetch
  });
}

export function useCreateClientLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      ipcInvoke('clients:create', data),
    onSuccess: () => {
      if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); }
    },
  });
}

export function useUpdateClientLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('clients:update', id, data),
    onSuccess: () => {
      if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); }
    },
  });
}

export function useDeleteClientLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('clients:delete', id),
    onSuccess: () => {
      if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); }
    },
  });
}
