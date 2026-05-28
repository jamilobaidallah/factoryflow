"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcInvoke } from '@/lib/profile';
import { useActiveProfile } from './useActiveProfile';

const EMP_KEY  = (pid: string) => ['employees', pid] as const;
const PAY_KEY  = (pid: string) => ['payroll', pid] as const;
const OVT_KEY  = (pid: string) => ['overtime', pid] as const;
const ADV_KEY  = (pid: string) => ['advances', pid] as const;

export function useEmployeesLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: EMP_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('employees:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function usePayrollLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: PAY_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('payroll:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useOvertimeLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: OVT_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('overtime:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useAdvancesLocal() {
  const profile = useActiveProfile();
  return useQuery({
    queryKey: ADV_KEY(profile?.id ?? ''),
    queryFn: () => ipcInvoke<unknown[]>('advances:getAll', profile!.id),
    enabled: !!profile,
    staleTime: 0,
  });
}

export function useCreateEmployeeLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('employees:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: EMP_KEY(profile.id) }); } },
  });
}

export function useUpdateEmployeeLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ipcInvoke('employees:update', id, data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: EMP_KEY(profile.id) }); } },
  });
}

export function useCreatePayrollLocal() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => ipcInvoke('payroll:create', data),
    onSuccess: () => { if (profile) { qc.invalidateQueries({ queryKey: PAY_KEY(profile.id) }); } },
  });
}
