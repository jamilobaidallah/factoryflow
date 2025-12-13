/**
 * Activity Log Types
 * أنواع سجل النشاطات
 */

/** الإجراءات المتاحة */
export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'role_change'
  | 'remove_access';

/** الوحدات/الأقسام */
export type ActivityModule =
  | 'ledger'
  | 'partners'
  | 'clients'
  | 'payments'
  | 'cheques'
  | 'inventory'
  | 'fixed_assets'
  | 'production'
  | 'employees'
  | 'invoices'
  | 'users';

/** تسميات الإجراءات بالعربية */
export const ACTION_LABELS: Record<ActivityAction, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  approve: 'قبول طلب',
  reject: 'رفض طلب',
  role_change: 'تغيير دور',
  remove_access: 'إزالة وصول',
};

/** تسميات الوحدات بالعربية */
export const MODULE_LABELS: Record<ActivityModule, string> = {
  ledger: 'دفتر الحسابات',
  partners: 'الشركاء',
  clients: 'العملاء',
  payments: 'المدفوعات',
  cheques: 'الشيكات',
  inventory: 'المخزون',
  fixed_assets: 'الأصول الثابتة',
  production: 'الإنتاج',
  employees: 'الموظفين',
  invoices: 'الفواتير',
  users: 'المستخدمين',
};

/** سجل نشاط واحد */
export interface ActivityLog {
  id: string;
  /** معرف المستخدم الذي قام بالعملية */
  userId: string;
  /** بريد المستخدم */
  userEmail: string;
  /** اسم المستخدم */
  userDisplayName?: string;
  /** نوع الإجراء */
  action: ActivityAction;
  /** الوحدة/القسم */
  module: ActivityModule;
  /** معرف العنصر المتأثر (اختياري) */
  targetId?: string;
  /** وصف إضافي */
  description: string;
  /** بيانات إضافية (مثل الدور الجديد) */
  metadata?: Record<string, unknown>;
  /** تاريخ ووقت النشاط */
  createdAt: Date;
}

/** إدخال سجل نشاط جديد (بدون id و createdAt) */
export type ActivityLogInput = Omit<ActivityLog, 'id' | 'createdAt'>;
