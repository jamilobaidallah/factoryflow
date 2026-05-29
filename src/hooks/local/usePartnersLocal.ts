"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['partners', profileId] as const;

export function usePartnersLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('partners:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreatePartnerLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('partners:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useUpdatePartnerLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('partners:update', id, data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useDeletePartnerLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('partners:delete', id),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}
