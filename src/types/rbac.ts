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
  /** معرف المالك (المصنع) */
  ownerId: string;
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
  /** البريد الإلكتروني للمستخدم المتقدم */
  email: string;
  /** اسم العرض */
  displayName: string;
  /** معرف المالك المستهدف (uid) */
  targetOwnerId: string;
  /** البريد الإلكتروني للمالك المستهدف */
  targetOwnerEmail: string;
  /** رسالة الطلب (اختياري) */
  message?: string;
  /** تاريخ الطلب */
  requestedAt: Date;
  /** حالة الطلب */
  status: 'pending' | 'approved' | 'rejected';
  /** تاريخ المعالجة */
  processedAt?: Date;
  /** الدور المعين (عند القبول) */
  assignedRole?: UserRole;
}

/**
 * مصفوفة الصلاحيات - تحدد الإجراءات المسموحة لكل دور في كل وحدة
 */
export type RolePermissions = Record<UserRole, Record<PermissionModule, PermissionAction[]>>;

/**
 * دعوة لانضمام عضو جديد
 */
export interface Invitation {
  /** معرف الدعوة */
  id: string;
  /** رمز الدعوة الفريد (للرابط) */
  token: string;
  /** معرف المالك الذي أرسل الدعوة */
  ownerId: string;
  /** البريد الإلكتروني للمالك */
  ownerEmail: string;
  /** اسم المالك/المصنع */
  ownerDisplayName?: string;
  /** البريد الإلكتروني للمدعو */
  inviteeEmail: string;
  /** الدور المخصص للمدعو */
  role: 'accountant' | 'viewer';
  /** تاريخ الإنشاء */
  createdAt: Date;
  /** تاريخ انتهاء الصلاحية */
  expiresAt: Date;
  /** حالة الدعوة */
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  /** تاريخ القبول (عند القبول) */
  acceptedAt?: Date;
  /** معرف المستخدم الذي قبل الدعوة */
  acceptedBy?: string;
}
