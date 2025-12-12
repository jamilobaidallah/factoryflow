/**
 * PermissionGate Component
 * عرض العناصر حسب صلاحيات المستخدم
 */

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionAction, PermissionModule } from '@/types/rbac';

interface PermissionGateProps {
  /** الإجراء المطلوب */
  action: PermissionAction;
  /** الوحدة المستهدفة */
  module: PermissionModule;
  /** المحتوى المعروض إذا كان لديه الصلاحية */
  children: ReactNode;
  /** المحتوى البديل إذا لم يكن لديه الصلاحية */
  fallback?: ReactNode;
}

/**
 * Conditionally render UI based on user permissions
 * يعرض المحتوى فقط إذا كان المستخدم يملك الصلاحية المطلوبة
 *
 * @example
 * // Hide delete button for viewers
 * <PermissionGate action="delete" module="ledger">
 *   <DeleteButton />
 * </PermissionGate>
 *
 * @example
 * // Show alternative content for unauthorized users
 * <PermissionGate
 *   action="create"
 *   module="users"
 *   fallback={<p>ليس لديك صلاحية</p>}
 * >
 *   <CreateUserButton />
 * </PermissionGate>
 */
export function PermissionGate({
  action,
  module,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can } = usePermissions();

  if (!can(action, module)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
