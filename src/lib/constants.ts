/**
 * Application-wide Constants
 *
 * Centralized location for all constant values used throughout the application.
 * This improves maintainability and reduces magic strings/numbers.
 */

// Payment and Transaction Types
export const TRANSACTION_TYPES = {
  INCOME: 'دخل',
  INCOME_ALT: 'إيراد',  // Alternative income label used in some contexts
  EXPENSE: 'مصروف',
  EQUITY: 'حركة رأس مال',
  LOAN: 'قرض',
} as const;

export const PAYMENT_TYPES = {
  RECEIPT: 'قبض',
  DISBURSEMENT: 'صرف',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'نقدي',
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك',
  OTHER: 'أخرى',
} as const;

// Payment Status
export const PAYMENT_STATUSES = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
} as const;

// Arabic payment status values (as stored in database)
export const PAYMENT_STATUS_AR = {
  PAID: 'مدفوع',
  PAID_ALT: 'مكتمل',
  UNPAID: 'غير مدفوع',
  PARTIAL: 'مدفوع جزئياً',
} as const;

export const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUSES.PAID]: 'مدفوع بالكامل',
  [PAYMENT_STATUSES.UNPAID]: 'غير مدفوع',
  [PAYMENT_STATUSES.PARTIAL]: 'مدفوع جزئياً',
} as const;

// Cheque Status
export const CHEQUE_STATUSES = {
  PENDING: 'pending',
  CLEARED: 'cleared',
  BOUNCED: 'bounced',
  ENDORSED: 'endorsed',
  CASHED: 'cashed',
  CANCELLED: 'cancelled',
} as const;

export const CHEQUE_STATUS_LABELS = {
  [CHEQUE_STATUSES.PENDING]: 'معلق',
  [CHEQUE_STATUSES.CLEARED]: 'تم الصرف',
  [CHEQUE_STATUSES.BOUNCED]: 'مرتجع',
  [CHEQUE_STATUSES.ENDORSED]: 'مظهر',
  [CHEQUE_STATUSES.CASHED]: 'تم الصرف',
  [CHEQUE_STATUSES.CANCELLED]: 'ملغي',
} as const;

// Cheque Types (Direction)
export const CHEQUE_TYPES = {
  INCOMING: 'وارد',
  OUTGOING: 'صادر',
} as const;

// Cheque Status Arabic Values (as stored in database)
export const CHEQUE_STATUS_AR = {
  PENDING: 'قيد الانتظار',
  CASHED: 'تم الصرف',
  ENDORSED: 'مجيّر',
  BOUNCED: 'مرفوض',
  RETURNED: 'مرتجع',
  COLLECTED: 'محصل',
  CANCELLED: 'ملغي',
} as const;

// Dashboard Labels
export const CASH_FLOW_LABELS = {
  CASH_IN: 'نقد وارد',
  CASH_OUT: 'نقد صادر',
} as const;

// Inventory Movement Types
export const MOVEMENT_TYPES = {
  ENTRY: 'دخول',
  EXIT: 'خروج',
} as const;

// Units of Measurement
export const UNITS = {
  PIECE: 'قطعة',
  METER: 'متر',
  KG: 'كيلوغرام',
  LITER: 'لتر',
  TON: 'طن',
  BOX: 'صندوق',
  CARTON: 'كرتون',
} as const;

// Ledger Categories - Income
export const INCOME_CATEGORIES = [
  {
    name: "مبيعات",
    subcategories: [
      "مبيعات منتجات",
      "مبيعات خدمات",
      "مبيعات أخرى",
    ]
  },
  {
    name: "إيرادات أخرى",
    subcategories: [
      "فوائد بنكية",
      "بيع أصول",
      "إيرادات متنوعة",
    ]
  },
] as const;

// Ledger Categories - Equity (Owner's Capital movements)
// These are NOT P&L items - they affect cash balance but not profit/loss
export const EQUITY_CATEGORIES = [
  {
    name: "رأس المال",
    subcategories: [
      "رأس مال مالك",    // Positive: increases equity, cash IN
      "سحوبات المالك",   // Negative: decreases equity, cash OUT
    ]
  },
] as const;

// Ledger Categories - Expense
export const EXPENSE_CATEGORIES = [
  {
    name: "تكلفة البضاعة المباعة (COGS)",
    subcategories: [
      "مواد خام",
      "شحن",
      "شراء بضاعة جاهزة",
    ]
  },
  {
    name: "مصاريف تشغيلية",
    subcategories: [
      "رواتب",
      "إيجار",
      "كهرباء وماء",
      "صيانة",
      "تسويق",
      "عينات مجانية",
      "هدر وتالف",
      "قرطاسية",
    ]
  },
  {
    name: "مصاريف عامة",
    subcategories: [
      "ضرائب",
      "فوائد قروض",
      "مصاريف أخرى",
    ]
  },
] as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'ar-EG',
  ISO: 'YYYY-MM-DD',
} as const;

// Currency
export const CURRENCY = {
  SYMBOL: 'دينار',
  CODE: 'JOD',
} as const;

// Validation Limits
export const VALIDATION_LIMITS = {
  MAX_AMOUNT: 999999999,
  MIN_AMOUNT: 0.01,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_NAME_LENGTH: 100,
  MAX_PHONE_LENGTH: 20,
  MIN_PHONE_LENGTH: 7,
} as const;

// Transaction ID Pattern
export const TRANSACTION_ID_PATTERN = /^TXN-\d{8}-\d{6}-\d{3}$/;

// Toast Duration
export const TOAST_DURATION = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 7000,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Firebase Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  CLIENTS: 'clients',
  LEDGER: 'ledger',
  PAYMENTS: 'payments',
  CHEQUES: 'cheques',
  INCOMING_CHEQUES: 'incoming-cheques',
  OUTGOING_CHEQUES: 'outgoing-cheques',
  INVENTORY: 'inventory',
  INVENTORY_MOVEMENTS: 'inventory-movements',
  EMPLOYEES: 'employees',
  PRODUCTION: 'production',
  FIXED_ASSETS: 'fixed-assets',
  INVOICES: 'invoices',
  LEDGER_FAVORITES: 'ledger-favorites',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'هذا الحقل مطلوب',
  INVALID_EMAIL: 'البريد الإلكتروني غير صحيح',
  INVALID_PHONE: 'رقم الهاتف غير صحيح',
  INVALID_AMOUNT: 'المبلغ يجب أن يكون أكبر من صفر',
  AMOUNT_TOO_LARGE: 'المبلغ كبير جداً',
  INVALID_DATE: 'التاريخ غير صحيح',
  INVALID_TRANSACTION_ID: 'رقم المعاملة غير صحيح',
  NO_PERMISSION: 'ليس لديك صلاحية للقيام بهذا الإجراء',
  NOT_FOUND: 'لم يتم العثور على البيانات',
  UNKNOWN_ERROR: 'حدث خطأ غير متوقع',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  CREATED: 'تمت الإضافة بنجاح',
  UPDATED: 'تم التحديث بنجاح',
  DELETED: 'تم الحذف بنجاح',
  SAVED: 'تم الحفظ بنجاح',
} as const;

// Confirmation Messages
export const CONFIRM_MESSAGES = {
  DELETE: 'هل أنت متأكد من حذف هذا العنصر؟',
  DELETE_PAYMENT: 'هل أنت متأكد من حذف هذه المدفوعة؟',
  DELETE_CHEQUE: 'هل أنت متأكد من حذف هذا الشيك؟',
  DELETE_CLIENT: 'هل أنت متأكد من حذف هذا العميل؟',
  CANCEL_CHANGES: 'هل تريد إلغاء التغييرات؟',
} as const;

// Status Colors (for Tailwind CSS)
export const STATUS_COLORS = {
  PAID: 'bg-green-100 text-green-700',
  UNPAID: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-blue-100 text-blue-700',
  CLEARED: 'bg-green-100 text-green-700',
  BOUNCED: 'bg-red-100 text-red-700',
  ENDORSED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
} as const;

// Type exports for TypeScript
export type PaymentType = typeof PAYMENT_TYPES[keyof typeof PAYMENT_TYPES];
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];
export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];
export type ChequeStatus = typeof CHEQUE_STATUSES[keyof typeof CHEQUE_STATUSES];
export type ChequeType = typeof CHEQUE_TYPES[keyof typeof CHEQUE_TYPES];
export type ChequeStatusAr = typeof CHEQUE_STATUS_AR[keyof typeof CHEQUE_STATUS_AR];
export type MovementType = typeof MOVEMENT_TYPES[keyof typeof MOVEMENT_TYPES];
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// User Roles (RBAC)
export const USER_ROLES = {
  OWNER: 'owner',
  ACCOUNTANT: 'accountant',
  VIEWER: 'viewer',
} as const;

export const USER_ROLE_LABELS = {
  owner: 'مالك',
  accountant: 'محاسب',
  viewer: 'مشاهد',
} as const;

export type UserRoleKey = typeof USER_ROLES[keyof typeof USER_ROLES];

// Firestore Query Limits
// These prevent unbounded queries and control memory usage
export const QUERY_LIMITS = {
  /** Maximum clients to fetch for list views */
  CLIENTS: 500,
  /** Maximum ledger entries for balance calculations */
  LEDGER_ENTRIES: 10000,
  /** Maximum payments for balance calculations */
  PAYMENTS: 10000,
  /** Maximum pending cheques for balance calculations */
  PENDING_CHEQUES: 5000,
  /** Maximum entries for dashboard stats */
  DASHBOARD_ENTRIES: 5000,
  /** Default page size for paginated lists */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum partners for dropdown */
  PARTNERS: 100,
  /** Maximum advances to fetch */
  ADVANCES: 500,
  /** Maximum overtime entries to fetch */
  OVERTIME_ENTRIES: 1000,
  /** Maximum favorites to fetch */
  LEDGER_FAVORITES: 50,
  /** Maximum journal entries for verification/reports */
  JOURNAL_ENTRIES: 10000,
  /** Maximum accounts in chart of accounts */
  ACCOUNTS: 500,
} as const;

// Employee Advances
export const ADVANCE_STATUS = {
  ACTIVE: 'active',
  FULLY_DEDUCTED: 'fully_deducted',
  CANCELLED: 'cancelled',
} as const;

export const ADVANCE_STATUS_LABELS = {
  [ADVANCE_STATUS.ACTIVE]: 'نشطة',
  [ADVANCE_STATUS.FULLY_DEDUCTED]: 'مخصومة بالكامل',
  [ADVANCE_STATUS.CANCELLED]: 'ملغاة',
} as const;

export type AdvanceStatus = typeof ADVANCE_STATUS[keyof typeof ADVANCE_STATUS];

// Payroll Deduction Types
export const PAYROLL_DEDUCTION_TYPES = {
  ABSENCE: 'absence',
  PENALTY: 'penalty',
  INSURANCE: 'insurance',
  TAX: 'tax',
  OTHER: 'other',
} as const;

export const PAYROLL_DEDUCTION_LABELS = {
  [PAYROLL_DEDUCTION_TYPES.ABSENCE]: 'غياب',
  [PAYROLL_DEDUCTION_TYPES.PENALTY]: 'جزاء',
  [PAYROLL_DEDUCTION_TYPES.INSURANCE]: 'تأمين',
  [PAYROLL_DEDUCTION_TYPES.TAX]: 'ضريبة',
  [PAYROLL_DEDUCTION_TYPES.OTHER]: 'أخرى',
} as const;

export type PayrollDeductionType = typeof PAYROLL_DEDUCTION_TYPES[keyof typeof PAYROLL_DEDUCTION_TYPES];

// Payroll Bonus Types
export const PAYROLL_BONUS_TYPES = {
  PERFORMANCE: 'performance',
  EID: 'eid',
  ANNUAL: 'annual',
  OTHER: 'other',
} as const;

export const PAYROLL_BONUS_LABELS = {
  [PAYROLL_BONUS_TYPES.PERFORMANCE]: 'حافز أداء',
  [PAYROLL_BONUS_TYPES.EID]: 'مكافأة عيد',
  [PAYROLL_BONUS_TYPES.ANNUAL]: 'مكافأة سنوية',
  [PAYROLL_BONUS_TYPES.OTHER]: 'أخرى',
} as const;

export type PayrollBonusType = typeof PAYROLL_BONUS_TYPES[keyof typeof PAYROLL_BONUS_TYPES];
