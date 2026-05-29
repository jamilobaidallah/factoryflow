"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const JOURNAL = (profileId: string) => ['journal', profileId] as const;
const REPORTS = (profileId: string) => ['reports', profileId] as const;

export function useJournalEntriesLocal(limit = 500) {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...JOURNAL(profile?.id ?? ''), limit] as const,
    queryFn: () => ipcInvoke<unknown[]>('journal:getAll', profile!.id, limit),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useJournalLinesLocal(journalId: string | null) {
  return useQuery({
    queryKey: ['journal-lines', journalId] as const,
    queryFn: () => ipcInvoke<unknown[]>('journal:getLines', journalId!),
    enabled: !!journalId,
    staleTime: 0,
  });
}

export function useTrialBalanceLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...REPORTS(profile?.id ?? ''), 'trial-balance'] as const,
    queryFn: () => ipcInvoke<unknown[]>('reports:trialBalance', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useTrialBalanceSummaryLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...REPORTS(profile?.id ?? ''), 'trial-balance-summary'] as const,
    queryFn: () => ipcInvoke<{
      totalDebits: number; totalCredits: number;
      difference: number; isBalanced: boolean;
    }>('reports:trialBalanceSummary', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useAccountLedgerLocal(accountCode: string | null) {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...REPORTS(profile?.id ?? ''), 'account-ledger', accountCode] as const,
    queryFn: () => ipcInvoke<unknown[]>('reports:accountLedger', profile!.id, accountCode!),
    enabled: !!profile && !!accountCode,
    staleTime: 0,
  });
}

export function useBalanceSheetLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: [...REPORTS(profile?.id ?? ''), 'balance-sheet'] as const,
    queryFn: () => ipcInvoke<unknown>('reports:balanceSheet', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useDeleteJournalEntryLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (id: string) => ipcInvoke('journal:delete', id),
    onSuccess: () => {
      if (!profile) { return; }
      qc.invalidateQueries({ queryKey: JOURNAL(profile.id) });
      qc.invalidateQueries({ queryKey: REPORTS(profile.id) });
    },
  });
}
