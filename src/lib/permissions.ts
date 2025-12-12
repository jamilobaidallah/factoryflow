/**
 * Permission Matrix and Utilities
 * مصفوفة الصلاحيات ودوال المساعدة
 */

import type { UserRole, PermissionModule, PermissionAction, RolePermissions } from '@/types/rbac';

/** جميع الإجراءات المتاحة */
const ALL_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'export'];

/** إجراءات CRUD (بدون تصدير) */
const CRUD_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete'];

/** إجراءات القراءة فقط */
const READ_ONLY: PermissionAction[] = ['read'];

/** إجراءات القراءة والتصدير */
const READ_EXPORT: PermissionAction[] = ['read', 'export'];

/** بدون صلاحيات */
const NO_ACCESS: PermissionAction[] = [];

/**
 * مصفوفة الصلاحيات الكاملة
 * تحدد ما يمكن لكل دور فعله في كل وحدة
 *
 * - owner: صلاحيات كاملة في جميع الوحدات
 * - accountant: إدارة البيانات المالية، بدون إدارة المستخدمين
 * - viewer: قراءة فقط
 */
export const ROLE_PERMISSIONS: RolePermissions = {
  owner: {
    dashboard: ALL_ACTIONS,
    ledger: ALL_ACTIONS,
    clients: ALL_ACTIONS,
    payments: ALL_ACTIONS,
    cheques: ALL_ACTIONS,
    inventory: ALL_ACTIONS,
    employees: ALL_ACTIONS,
    partners: ALL_ACTIONS,
    'fixed-assets': ALL_ACTIONS,
    invoices: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    users: ALL_ACTIONS,
    settings: ALL_ACTIONS,
  },
  accountant: {
    dashboard: READ_ONLY,
    ledger: CRUD_ACTIONS,
    clients: CRUD_ACTIONS,
    payments: CRUD_ACTIONS,
    cheques: CRUD_ACTIONS,
    inventory: CRUD_ACTIONS,
    employees: CRUD_ACTIONS,
    partners: CRUD_ACTIONS,
    'fixed-assets': CRUD_ACTIONS,
    invoices: [...CRUD_ACTIONS, 'export'],
    reports: READ_EXPORT,
    users: NO_ACCESS,
    settings: NO_ACCESS,
  },
  viewer: {
    dashboard: READ_ONLY,
    ledger: READ_ONLY,
    clients: READ_ONLY,
    payments: READ_ONLY,
    cheques: READ_ONLY,
    inventory: READ_ONLY,
    employees: READ_ONLY,
    partners: READ_ONLY,
    'fixed-assets': READ_ONLY,
    invoices: READ_ONLY,
    reports: READ_ONLY,
    users: NO_ACCESS,
    settings: NO_ACCESS,
  },
};

/**
 * التحقق من صلاحية المستخدم للقيام بإجراء معين
 *
 * @param role - دور المستخدم
 * @param module - الوحدة المستهدفة
 * @param action - الإجراء المطلوب
 * @returns true إذا كان المستخدم يملك الصلاحية
 *
 * @example
 * hasPermission('accountant', 'ledger', 'create') // true
 * hasPermission('viewer', 'ledger', 'create') // false
 * hasPermission('viewer', 'ledger', 'read') // true
 */
export function hasPermission(
  role: UserRole,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  const modulePermissions = ROLE_PERMISSIONS[role]?.[module];
  if (!modulePermissions) {
    return false;
  }
  return modulePermissions.includes(action);
}

/**
 * الحصول على جميع الصلاحيات لدور معين في وحدة معينة
 *
 * @param role - دور المستخدم
 * @param module - الوحدة المستهدفة
 * @returns مصفوفة الإجراءات المسموحة
 */
export function getModulePermissions(
  role: UserRole,
  module: PermissionModule
): PermissionAction[] {
  return ROLE_PERMISSIONS[role]?.[module] ?? [];
}

/**
 * التحقق مما إذا كان الدور يملك أي صلاحية في وحدة معينة
 *
 * @param role - دور المستخدم
 * @param module - الوحدة المستهدفة
 * @returns true إذا كان يملك صلاحية واحدة على الأقل
 */
export function hasAnyPermission(
  role: UserRole,
  module: PermissionModule
): boolean {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions !== undefined && permissions.length > 0;
}
