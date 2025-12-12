/**
 * RBAC (Role-Based Access Control) Type Definitions
 * تعريفات أنواع نظام التحكم بالصلاحيات
 */

/**
 * أدوار المستخدمين في النظام
 * - owner: مالك المصنع - صلاحيات كاملة
 * - accountant: محاسب - صلاحيات إدارة البيانات
 * - viewer: مشاهد - صلاحيات القراءة فقط
 */
export type UserRole = 'owner' | 'accountant' | 'viewer';

/**
 * الإجراءات المتاحة على الموارد
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'export';

/**
 * وحدات النظام المختلفة
 */
export type PermissionModule =
  | 'dashboard'
  | 'ledger'
  | 'clients'
  | 'payments'
  | 'cheques'
  | 'inventory'
  | 'employees'
  | 'partners'
  | 'fixed-assets'
  | 'invoices'
  | 'reports'
  | 'users'
  | 'settings';

/**
 * عضو في المؤسسة (مستخدم مرتبط بمصنع)
 */
export interface OrganizationMember {
  /** معرف المستخدم في Firebase Auth */
  uid: string;
  /** معرف المؤسسة (المصنع) */
  orgId: string;
  /** البريد الإلكتروني */
  email: string;
  /** اسم العرض */
  displayName: string;
  /** دور المستخدم */
  role: UserRole;
  /** تاريخ طلب الانضمام */
  requestedAt: Date;
  /** تاريخ الموافقة */
  approvedAt?: Date;
  /** معرف المستخدم الذي وافق */
  approvedBy?: string;
  /** حالة العضوية */
  isActive: boolean;
}

/**
 * طلب انضمام معلق
 */
export interface AccessRequest {
  /** معرف وثيقة الطلب */
  id: string;
  /** معرف المستخدم المتقدم */
  uid: string;
  /** البريد الإلكتروني */
  email: string;
  /** اسم العرض */
  displayName: string;
  /** تاريخ الطلب */
  requestedAt: Date;
  /** حالة الطلب */
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * مصفوفة الصلاحيات - تحدد الإجراءات المسموحة لكل دور في كل وحدة
 */
export type RolePermissions = Record<UserRole, Record<PermissionModule, PermissionAction[]>>;
