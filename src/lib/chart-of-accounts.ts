/**
 * Default Chart of Accounts
 *
 * Standard accounting chart following Arabic/Jordanian conventions.
 * Account codes follow standard numbering:
 * - 1000-1999: Assets
 * - 2000-2999: Liabilities
 * - 3000-3999: Equity
 * - 4000-4999: Revenue
 * - 5000-5999: Expenses
 */

import {
  Account,
  AccountType,
  NormalBalance,
  ACCOUNT_CODES,
  getNormalBalance
} from '@/types/accounting';

/**
 * Account definition (without id/timestamps - added when seeding)
 */
interface AccountDefinition {
  code: string;
  name: string;
  nameAr: string;
  type: AccountType;
  parentCode?: string;
  description?: string;
  isContraAccount?: boolean;
}

/**
 * Helper to create account definition
 */
function defineAccount(
  code: string,
  name: string,
  nameAr: string,
  type: AccountType,
  parentCode?: string,
  description?: string,
  isContraAccount?: boolean
): AccountDefinition {
  return { code, name, nameAr, type, parentCode, description, isContraAccount };
}

/**
 * Default Chart of Accounts
 */
export const DEFAULT_ACCOUNTS: AccountDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ASSETS (1000-1999) - أصول
  // ═══════════════════════════════════════════════════════════════════════════

  // Current Assets - الأصول المتداولة
  defineAccount(
    ACCOUNT_CODES.CASH,
    'Cash',
    'النقدية',
    'asset',
    undefined,
    'Cash on hand and in registers'
  ),
  defineAccount(
    ACCOUNT_CODES.BANK,
    'Bank',
    'البنك',
    'asset',
    undefined,
    'Bank accounts'
  ),
  defineAccount(
    ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    'Accounts Receivable',
    'ذمم مدينة',
    'asset',
    undefined,
    'Amounts owed by customers'
  ),
  defineAccount(
    '1201',
    'Allowance for Doubtful Accounts',
    'مخصص ديون مشكوك فيها',
    'asset',
    ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    'Reserve for estimated uncollectible receivables (contra-asset)',
    true // isContraAccount
  ),
  defineAccount(
    ACCOUNT_CODES.INVENTORY,
    'Inventory',
    'المخزون',
    'asset',
    undefined,
    'Raw materials and finished goods'
  ),
  defineAccount(
    '1301',
    'Imported Raw Stone',
    'بلاطات حجر خام — واردات',
    'asset',
    ACCOUNT_CODES.INVENTORY,
    'Raw imported stone slabs on hand'
  ),
  defineAccount(
    '1302',
    'Cut Stone In-house',
    'حجر مقطوع — إنتاج داخلي',
    'asset',
    ACCOUNT_CODES.INVENTORY,
    'Stone cut in-house from raw imported slabs'
  ),
  defineAccount(
    '1303',
    'Ready Stone — Local Purchases',
    'حجر جاهز — مشتريات محلية',
    'asset',
    ACCOUNT_CODES.INVENTORY,
    'Ready stone purchased locally for resale'
  ),
  defineAccount(
    '1310',
    'Work-in-Progress',
    'إنتاج قيد التنفيذ',
    'asset',
    ACCOUNT_CODES.INVENTORY,
    'Partially completed products currently in production'
  ),
  defineAccount(
    ACCOUNT_CODES.PREPAID_EXPENSES,
    'Prepaid Expenses',
    'مصاريف مدفوعة مقدماً',
    'asset',
    undefined,
    'Expenses paid in advance'
  ),
  defineAccount(
    ACCOUNT_CODES.SUPPLIER_ADVANCES,
    'Supplier Advances',
    'سلفات موردين',
    'asset',
    undefined,
    'Prepayments to suppliers for future goods/services'
  ),
  defineAccount(
    '1450',
    'VAT Input Tax Receivable',
    'ضريبة المدخلات المستحقة الاسترداد',
    'asset',
    undefined,
    'Recoverable VAT paid on supplier invoices (Jordan compliance)'
  ),

  // Fixed Assets - الأصول الثابتة
  defineAccount(
    ACCOUNT_CODES.FIXED_ASSETS,
    'Fixed Assets',
    'الأصول الثابتة',
    'asset',
    undefined,
    'Property, plant, and equipment'
  ),
  defineAccount(
    '1501',
    'Machinery & Equipment',
    'آلات ومعدات',
    'asset',
    ACCOUNT_CODES.FIXED_ASSETS,
    'Production machinery and equipment'
  ),
  defineAccount(
    '1502',
    'Vehicles',
    'مركبات',
    'asset',
    ACCOUNT_CODES.FIXED_ASSETS,
    'Company vehicles'
  ),
  defineAccount(
    '1503',
    'Furniture & Fixtures',
    'أثاث وتجهيزات',
    'asset',
    ACCOUNT_CODES.FIXED_ASSETS,
    'Office furniture and fixtures'
  ),
  defineAccount(
    '1504',
    'Buildings',
    'مباني',
    'asset',
    ACCOUNT_CODES.FIXED_ASSETS,
    'Buildings and structures'
  ),
  defineAccount(
    '1505',
    'Land',
    'أراضي',
    'asset',
    ACCOUNT_CODES.FIXED_ASSETS,
    'Land holdings'
  ),

  // Contra-Asset - مجمع الإهلاك
  defineAccount(
    ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
    'Accumulated Depreciation',
    'مجمع الإهلاك',
    'asset', // Contra-asset: stays in asset range but has credit normal balance
    ACCOUNT_CODES.FIXED_ASSETS,
    'Accumulated depreciation on fixed assets (contra-asset)',
    true // isContraAccount
  ),

  // Loans Receivable - قروض ممنوحة
  defineAccount(
    ACCOUNT_CODES.LOANS_RECEIVABLE,
    'Loans Receivable',
    'قروض ممنوحة',
    'asset',
    undefined,
    'Loans given to customers, employees, or other parties'
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // LIABILITIES (2000-2999) - الالتزامات
  // ═══════════════════════════════════════════════════════════════════════════

  defineAccount(
    ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    'Accounts Payable',
    'ذمم دائنة',
    'liability',
    undefined,
    'Amounts owed to suppliers'
  ),
  defineAccount(
    ACCOUNT_CODES.ACCRUED_EXPENSES,
    'Accrued Expenses',
    'مصاريف مستحقة',
    'liability',
    undefined,
    'Expenses incurred but not yet paid'
  ),
  defineAccount(
    ACCOUNT_CODES.CUSTOMER_ADVANCES,
    'Customer Advances',
    'سلفات عملاء',
    'liability',
    undefined,
    'Prepayments received from customers for future goods/services'
  ),
  defineAccount(
    ACCOUNT_CODES.NOTES_PAYABLE,
    'Notes Payable',
    'أوراق دفع',
    'liability',
    undefined,
    'Cheques and promissory notes payable'
  ),
  defineAccount(
    '2300',
    'Loans Payable',
    'قروض مستحقة',
    'liability',
    undefined,
    'Bank loans and other borrowings'
  ),
  defineAccount(
    '2400',
    'VAT Payable',
    'ضريبة المبيعات المستحقة',
    'liability',
    undefined,
    'Value-added tax owed'
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // EQUITY (3000-3999) - حقوق الملكية
  // ═══════════════════════════════════════════════════════════════════════════

  defineAccount(
    ACCOUNT_CODES.OWNER_CAPITAL,
    "Partners' Equity",
    'حقوق الشركاء',
    'equity',
    undefined,
    'Partner capital accounts (parent). Per-partner accounts are created dynamically.'
  ),
  // Partner-specific capital/drawings accounts (3100–3179) are created dynamically
  // when partners are added via the partners page. They are NOT seeded here.
  defineAccount(
    ACCOUNT_CODES.INCOME_SUMMARY,
    'Income Summary',
    'ملخص الدخل',
    'equity',
    ACCOUNT_CODES.OWNER_CAPITAL,
    'Transient clearing account for year-end close. Must be zero after closing entries.',
    false  // not a contra account
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE (4000-4999) - الإيرادات
  // ═══════════════════════════════════════════════════════════════════════════

  defineAccount(
    ACCOUNT_CODES.SALES_REVENUE,
    'Sales Revenue',
    'إيرادات المبيعات',
    'revenue',
    undefined,
    'Revenue from product sales'
  ),
  defineAccount(
    '4010',
    'Cut Stone Sales',
    'مبيعات حجر مقطوع',
    'revenue',
    ACCOUNT_CODES.SALES_REVENUE,
    'Revenue from cut stone sales'
  ),
  defineAccount(
    '4020',
    'Ready Stone Sales',
    'مبيعات حجر جاهز',
    'revenue',
    ACCOUNT_CODES.SALES_REVENUE,
    'Revenue from ready stone sales'
  ),
  defineAccount(
    ACCOUNT_CODES.SERVICE_REVENUE,
    'Service Revenue',
    'إيرادات الخدمات',
    'revenue',
    undefined,
    'Revenue from services'
  ),
  defineAccount(
    '4110',
    'Service Sales',
    'مبيعات خدمات',
    'revenue',
    ACCOUNT_CODES.SERVICE_REVENUE,
    'Revenue from service sales'
  ),
  defineAccount(
    ACCOUNT_CODES.OTHER_INCOME,
    'Other Income',
    'إيرادات أخرى',
    'revenue',
    undefined,
    'Miscellaneous income'
  ),
  defineAccount(
    '4210',
    'Bank Interest Income',
    'فوائد بنكية',
    'revenue',
    ACCOUNT_CODES.OTHER_INCOME,
    'Interest earned on bank accounts'
  ),
  defineAccount(
    '4220',
    'Asset Sale Income',
    'بيع أصول',
    'revenue',
    ACCOUNT_CODES.OTHER_INCOME,
    'Gains from sale of assets'
  ),
  defineAccount(
    '4230',
    'Miscellaneous Income',
    'إيرادات متنوعة',
    'revenue',
    ACCOUNT_CODES.OTHER_INCOME,
    'Other miscellaneous income'
  ),

  // Contra-Revenue - خصومات ومردودات المبيعات
  defineAccount(
    ACCOUNT_CODES.SALES_RETURNS,
    'Sales Returns',
    'مردودات المبيعات',
    'revenue', // Contra-revenue: reduces net revenue
    ACCOUNT_CODES.SALES_REVENUE,
    'Returned or rejected goods from customers (contra-revenue)',
    true // isContraAccount
  ),
  defineAccount(
    ACCOUNT_CODES.SALES_DISCOUNT,
    'Sales Discount',
    'خصم المبيعات',
    'revenue', // Contra-revenue: reduces net revenue, but stays in revenue range
    undefined,
    'Settlement discounts given to customers (contra-revenue)',
    true // isContraAccount
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPENSES (5000-5999) - المصروفات
  // ═══════════════════════════════════════════════════════════════════════════

  // Cost of Goods Sold
  defineAccount(
    ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    'Cost of Goods Sold',
    'تكلفة البضاعة المباعة',
    'expense',
    undefined,
    'Direct costs of goods sold'
  ),
  defineAccount(
    '5010',
    'Raw Materials',
    'مواد خام',
    'expense',
    ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    'Cost of raw materials used'
  ),
  defineAccount(
    '5020',
    'Shipping & Freight',
    'شحن',
    'expense',
    ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    'Shipping and freight costs for inventory'
  ),
  defineAccount(
    '5030',
    'Purchased Goods',
    'شراء بضاعة جاهزة',
    'expense',
    ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    'Cost of finished goods purchased for resale'
  ),

  defineAccount(
    ACCOUNT_CODES.INVENTORY_LOSSES,  // 5040
    'Blade Consumption & Cutting Machine Maintenance',
    'استهلاك شفرات وصيانة آلات التقطيع',
    'expense',
    ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    'Cutting blade wear, replacement blades, and cutting machine maintenance costs'
  ),
  defineAccount(
    '5060',
    'Inventory Losses & Impairment',
    'خسائر المخزون وهبوط القيمة',
    'expense',
    ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    'Stone wastage, breakage, spoilage, and inventory write-downs'
  ),

  // Contra-Expense - خصومات المشتريات
  defineAccount(
    ACCOUNT_CODES.PURCHASE_DISCOUNT,
    'Purchase Discount',
    'خصم المشتريات',
    'expense', // Contra-expense: reduces net expenses, but stays in expense range
    undefined,
    'Settlement discounts received from suppliers (contra-expense)',
    true // isContraAccount
  ),

  // Operating Expenses - مصاريف تشغيلية
  defineAccount(
    ACCOUNT_CODES.SALARIES_EXPENSE,
    'Salaries Expense',
    'مصاريف الرواتب',
    'expense',
    undefined,
    'Employee salaries and wages'
  ),
  defineAccount(
    ACCOUNT_CODES.RENT_EXPENSE,
    'Rent Expense',
    'مصاريف الإيجار',
    'expense',
    undefined,
    'Rent for premises'
  ),
  defineAccount(
    ACCOUNT_CODES.UTILITIES_EXPENSE,
    'Utilities Expense',
    'مصاريف المرافق',
    'expense',
    undefined,
    'Electricity, water, and utilities'
  ),
  defineAccount(
    '5310',
    'Electricity & Water',
    'كهرباء وماء',
    'expense',
    ACCOUNT_CODES.UTILITIES_EXPENSE,
    'Electricity and water bills'
  ),
  defineAccount(
    ACCOUNT_CODES.DEPRECIATION_EXPENSE,
    'Depreciation Expense',
    'مصاريف الإهلاك',
    'expense',
    undefined,
    'Depreciation of fixed assets'
  ),
  defineAccount(
    ACCOUNT_CODES.MAINTENANCE_EXPENSE,
    'Maintenance Expense',
    'مصاريف صيانة',
    'expense',
    undefined,
    'Repairs and maintenance costs'
  ),
  defineAccount(
    ACCOUNT_CODES.MARKETING_EXPENSE,
    'Marketing Expense',
    'مصاريف تسويق',
    'expense',
    undefined,
    'Advertising and marketing costs'
  ),
  defineAccount(
    ACCOUNT_CODES.OFFICE_SUPPLIES,
    'Office Supplies',
    'قرطاسية',
    'expense',
    undefined,
    'Office supplies and stationery'
  ),
  defineAccount(
    ACCOUNT_CODES.TRANSPORTATION_EXPENSE,
    'Transportation Expense',
    'وقود ومواصلات',
    'expense',
    undefined,
    'Fuel, transportation, and vehicle expenses'
  ),
  defineAccount(
    ACCOUNT_CODES.TRAVEL_EXPENSE,
    'Travel Expense',
    'سفر وضيافة',
    'expense',
    undefined,
    'Business trips, travel, and entertainment expenses'
  ),
  defineAccount(
    ACCOUNT_CODES.ADMIN_EXPENSE,
    'Administrative Expense',
    'مصاريف إدارية',
    'expense',
    undefined,
    'General administrative expenses'
  ),
  defineAccount(
    ACCOUNT_CODES.COMMUNICATIONS_EXPENSE,
    'Communications Expense',
    'اتصالات وإنترنت',
    'expense',
    undefined,
    'Phone, internet, and communication costs'
  ),
  defineAccount(
    ACCOUNT_CODES.SMALL_EQUIPMENT,
    'Small Equipment',
    'أدوات ومعدات صغيرة',
    'expense',
    undefined,
    'Tools and equipment below capitalization threshold'
  ),
  defineAccount(
    ACCOUNT_CODES.PROFESSIONAL_FEES,
    'Professional Fees',
    'مصاريف قانونية',
    'expense',
    undefined,
    'Legal, accounting, and professional services'
  ),
  defineAccount(
    ACCOUNT_CODES.INSURANCE_EXPENSE,
    'Insurance Expense',
    'تأمينات',
    'expense',
    undefined,
    'Business insurance premiums'
  ),
  defineAccount(
    '5425',
    'Sales Commissions',
    'عمولات مبيعات',
    'expense',
    undefined,
    'Commissions paid to external sales agents'
  ),

  defineAccount(
    '5120',
    'Manufacturing Overhead',
    'مصاريف إنتاج غير مباشرة',
    'expense',
    undefined,
    'Indirect production costs: factory supervision, factory utilities, equipment depreciation'
  ),

  // General Expenses - مصاريف عامة
  defineAccount(
    ACCOUNT_CODES.OTHER_EXPENSES,
    'Other Expenses',
    'مصاريف أخرى',
    'expense',
    undefined,
    'Miscellaneous expenses'
  ),
  defineAccount(
    '5510',
    'Taxes',
    'ضرائب',
    'expense',
    ACCOUNT_CODES.OTHER_EXPENSES,
    'Business taxes'
  ),
  defineAccount(
    '5520',
    'Loan Interest',
    'فوائد قروض',
    'expense',
    ACCOUNT_CODES.OTHER_EXPENSES,
    'Interest on loans'
  ),
  defineAccount(
    '5530',
    'Miscellaneous Expenses',
    'مصاريف متنوعة',
    'expense',
    ACCOUNT_CODES.OTHER_EXPENSES,
    'Other miscellaneous expenses'
  ),

  // Bad Debt - ديون معدومة
  defineAccount(
    ACCOUNT_CODES.BAD_DEBT_EXPENSE,
    'Bad Debt Expense',
    'مصروف ديون معدومة',
    'expense',
    undefined,
    'Uncollectible accounts receivable written off'
  ),
];

/**
 * Get default accounts as full Account objects (ready to save to Firestore)
 * All seeded accounts are marked as system accounts (protected from deletion)
 * Contra accounts are marked so UI can display their balance correctly
 */
export function getDefaultAccountsForSeeding(): Omit<Account, 'id'>[] {
  const now = new Date();
  return DEFAULT_ACCOUNTS.map(def => {
    // Contra accounts have the opposite normal balance to their type
    const normalBalance = def.isContraAccount
      ? (getNormalBalance(def.type) === 'debit' ? 'credit' : 'debit')
      : getNormalBalance(def.type);

    return {
      code: def.code,
      name: def.name,
      nameAr: def.nameAr,
      type: def.type,
      normalBalance,
      isActive: true,
      isSystemAccount: true,
      isContraAccount: def.isContraAccount ?? false,
      parentCode: def.parentCode,
      description: def.description,
      createdAt: now,
    };
  });
}

/**
 * Get account by code from defaults
 */
export function getDefaultAccountByCode(code: string): AccountDefinition | undefined {
  return DEFAULT_ACCOUNTS.find(a => a.code === code);
}

/**
 * Get all accounts of a specific type
 */
export function getDefaultAccountsByType(type: AccountType): AccountDefinition[] {
  return DEFAULT_ACCOUNTS.filter(a => a.type === type);
}

/**
 * Get parent accounts only (no parentCode)
 */
export function getParentAccounts(): AccountDefinition[] {
  return DEFAULT_ACCOUNTS.filter(a => !a.parentCode);
}

/**
 * Get child accounts for a parent
 */
export function getChildAccounts(parentCode: string): AccountDefinition[] {
  return DEFAULT_ACCOUNTS.filter(a => a.parentCode === parentCode);
}
