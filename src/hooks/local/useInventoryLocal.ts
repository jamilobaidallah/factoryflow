"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const ITEMS_KEY = (profileId: string) => ['inventory', profileId] as const;
const MOVEMENTS_KEY = (profileId: string) => ['inventory-movements', profileId] as const;

export function useInventoryLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: ITEMS_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('inventory:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useInventoryMovementsLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: MOVEMENTS_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('inventory-movements:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateInventoryItemLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('inventory:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: ITEMS_KEY(profile.id) }); } },
  });
}

export function useUpdateInventoryItemLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('inventory:update', id, data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: ITEMS_KEY(profile.id) }); } },
  });
}

export function useCreateMovementLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('inventory-movements:create', data),
    onSuccess: () => {
      if (profile) {
        qc.invalidateQueries({ queryKey: ITEMS_KEY(profile.id) });
        qc.invalidateQueries({ queryKey: MOVEMENTS_KEY(profile.id) });
      }
    },
  });
}
