"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const ASSETS_KEY  = (pid: string) => ['fixed-assets', pid] as const;
const RECORDS_KEY = (pid: string) => ['depreciation-records', pid] as const;
const RUNS_KEY    = (pid: string) => ['depreciation-runs', pid] as const;

export function useFixedAssetsLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: ASSETS_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('fixed-assets:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useDepreciationRecordsLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: RECORDS_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('depreciation-records:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useDepreciationRunsLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: RUNS_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('depreciation-runs:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateFixedAssetLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('fixed-assets:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: ASSETS_KEY(profile.id) }); } },
  });
}

export function useUpdateFixedAssetLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('fixed-assets:update', id, data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: ASSETS_KEY(profile.id) }); } },
  });
}

export function useDeleteFixedAssetLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('fixed-assets:delete', id),
    onSuccess: () => {
      if (profile) {
        qc.invalidateQueries({ queryKey: ASSETS_KEY(profile.id) });
        qc.invalidateQueries({ queryKey: RECORDS_KEY(profile.id) });
      }
    },
  });
}
