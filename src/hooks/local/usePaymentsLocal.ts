"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const KEY = (profileId: string) => ['payments', profileId] as const;

export function usePaymentsLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('payments:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useAllocationsForPaymentLocal(paymentId: string | null) {
  return useQuery({
    queryKey: ['allocations', paymentId] as const,
    queryFn: () => ipcInvoke<unknown[]>('allocations:getForPayment', paymentId!),
    enabled: !!paymentId,
    staleTime: 0,
  });
}

export function useAllocationsForTransactionLocal(transactionId: string | null) {
  return useQuery({
    queryKey: ['allocations-by-txn', transactionId] as const,
    queryFn: () => ipcInvoke<unknown[]>('allocations:getForTransaction', transactionId!),
    enabled: !!transactionId,
    staleTime: 0,
  });
}

export function useCreatePaymentLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: { payment: Record<string, unknown>; allocations: Record<string, unknown>[] }) =>
      ipcInvoke('payments:createWithAllocations', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}

export function useDeletePaymentLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('payments:delete', id),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: KEY(profile.id) }); } },
  });
}
