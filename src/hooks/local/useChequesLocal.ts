"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['cheques', profileId] as const;

export function useChequesLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('cheques:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useChequesByStatusLocal(status: string) {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...KEY(profile?.id ?? ''), 'status', status] as const,
    queryFn: () => ipcInvoke<unknown[]>('cheques:getByStatus', profile!.id, status),
    enabled: !!profile && !!status,
    staleTime: 0,
  });
}

export function useCreateChequeLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('cheques:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useUpdateChequeLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('cheques:update', id, data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useDeleteChequeLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('cheques:delete', id),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}
