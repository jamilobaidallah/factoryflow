/**
 * usePermissions Hook
 * صلاحيات المستخدم - للتحقق من صلاحيات المستخدم الحالي
 */

import { useUser } from '@/firebase/provider';
import { hasPermission } from '@/lib/permissions';
import type { UserRole, PermissionAction, PermissionModule } from '@/types/rbac';

interface UsePermissionsReturn {
  /** التحقق من صلاحية معينة */
  can: (action: PermissionAction, module: PermissionModule) => boolean;
  /** دور المستخدم الحالي */
  role: UserRole | null;
  /** هل المستخدم مالك */
  isOwner: boolean;
  /** هل المستخدم محاسب */
  isAccountant: boolean;
  /** هل المستخدم مشاهد */
  isViewer: boolean;
  /** هل يمكن للمستخدم الكتابة (ليس مشاهد) */
  canWrite: boolean;
}

/**
 * Hook for checking user permissions
 * للتحقق من صلاحيات المستخدم في الوحدات المختلفة
 *
 * @example
 * const { can, isOwner, canWrite } = usePermissions();
 *
 * // Check specific permission
 * if (can('create', 'ledger')) {
 *   // Show create button
 * }
 *
 * // Check role
 * if (isOwner) {
 *   // Show admin settings
 * }
 */
export function usePermissions(): UsePermissionsReturn {
  const { role } = useUser();

  const can = (action: PermissionAction, module: PermissionModule): boolean => {
    if (!role) return false;
    return hasPermission(role, module, action);
  };

  return {
    can,
    role,
    isOwner: role === 'owner',
    isAccountant: role === 'accountant',
    isViewer: role === 'viewer',
    canWrite: role !== null && role !== 'viewer',
  };
}
