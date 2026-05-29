"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['invoices', profileId] as const;

export function useInvoicesLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('invoices:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateInvoiceLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('invoices:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useUpdateInvoiceLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('invoices:update', id, data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useDeleteInvoiceLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('invoices:delete', id),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}
