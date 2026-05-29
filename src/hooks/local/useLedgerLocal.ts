"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY      = (profileId: string) => ['ledger', profileId] as const;
const JOURNAL  = (profileId: string) => ['journal', profileId] as const;
const REPORTS  = (profileId: string) => ['reports', profileId] as const;

export function useLedgerLocal(limit = 500) {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...KEY(profile?.id ?? ''), limit] as const,
    queryFn: () => ipcInvoke<unknown[]>('ledger:getAll', profile!.id, limit),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useLedgerCountLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...KEY(profile?.id ?? ''), 'count'] as const,
    queryFn: () => ipcInvoke<number>('ledger:count', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useUnpaidARAPCountLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...KEY(profile?.id ?? ''), 'unpaid-arap-count'] as const,
    queryFn: () => ipcInvoke<number>('ledger:unpaidARAPCount', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateLedgerEntryLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      ipcInvoke('ledger:create', input),
    onSuccess: () => {
      if (!profile) { return; }
      qc.invalidateQueries({ queryKey: KEY(profile.id) });
      qc.invalidateQueries({ queryKey: JOURNAL(profile.id) });
      qc.invalidateQueries({ queryKey: REPORTS(profile.id) });
    },
  });
}

export function useDeleteLedgerEntryLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('ledger:delete', id),
    onSuccess: () => {
      if (!profile) { return; }
      qc.invalidateQueries({ queryKey: KEY(profile.id) });
      qc.invalidateQueries({ queryKey: JOURNAL(profile.id) });
      qc.invalidateQueries({ queryKey: REPORTS(profile.id) });
    },
  });
}

export function useUpdateLedgerMetadataLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('ledger:updateMetadata', id, data),
    onSuccess: () => {
      if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); }
    },
  });
}
