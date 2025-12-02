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
  description?: string
): AccountDefinition {
  return { code, name, nameAr, type, parentCode, description };
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
    ACCOUNT_CODES.INVENTORY,
    'Inventory',
    'المخزون',
    'asset',
    undefined,
    'Raw materials and finished goods'
  ),
  defineAccount(
    ACCOUNT_CODES.PREPAID_EXPENSES,
    'Prepaid Expenses',
    'مصاريف مدفوعة مقدماً',
    'asset',
    undefined,
    'Expenses paid in advance'
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
    'asset', // Contra-asset but still in asset range
    ACCOUNT_CODES.FIXED_ASSETS,
    'Accumulated depreciation on fixed assets (contra-asset)'
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
    "Owner's Capital",
    'رأس المال',
    'equity',
    undefined,
    'Owner investments in the business'
  ),
  defineAccount(
    ACCOUNT_CODES.OWNER_DRAWINGS,
    "Owner's Drawings",
    'سحوبات المالك',
    'equity',
    undefined,
    'Owner withdrawals from the business'
  ),
  defineAccount(
    ACCOUNT_CODES.RETAINED_EARNINGS,
    'Retained Earnings',
    'الأرباح المحتجزة',
    'equity',
    undefined,
    'Accumulated profits retained in business'
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
    'Product Sales',
    'مبيعات منتجات',
    'revenue',
    ACCOUNT_CODES.SALES_REVENUE,
    'Revenue from product sales'
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
    '5410',
    'Maintenance Expense',
    'مصاريف صيانة',
    'expense',
    undefined,
    'Repairs and maintenance costs'
  ),
  defineAccount(
    '5420',
    'Marketing Expense',
    'مصاريف تسويق',
    'expense',
    undefined,
    'Advertising and marketing costs'
  ),
  defineAccount(
    '5430',
    'Office Supplies',
    'قرطاسية',
    'expense',
    undefined,
    'Office supplies and stationery'
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
];

/**
 * Get default accounts as full Account objects (ready to save to Firestore)
 */
export function getDefaultAccountsForSeeding(): Omit<Account, 'id'>[] {
  const now = new Date();
  return DEFAULT_ACCOUNTS.map(def => ({
    code: def.code,
    name: def.name,
    nameAr: def.nameAr,
    type: def.type,
    normalBalance: getNormalBalance(def.type),
    isActive: true,
    parentCode: def.parentCode,
    description: def.description,
    createdAt: now,
  }));
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
