"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/rbac";

interface RoleSelectorProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  excludeOwner?: boolean;
}

export function RoleSelector({
  value,
  onChange,
  disabled = false,
  excludeOwner = true,
}: RoleSelectorProps) {
  const roles: UserRole[] = excludeOwner
    ? ["accountant", "viewer"]
    : ["owner", "accountant", "viewer"];

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as UserRole)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="اختر الدور" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            {USER_ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
