/**
 * Category-to-Account Mapping
 *
 * Maps existing ledger categories (Arabic) to Chart of Accounts codes.
 * This enables backward compatibility - existing ledger entry flows
 * continue working while automatically generating proper journal entries.
 */

import { ACCOUNT_CODES } from '@/types/accounting';
import { TRANSACTION_TYPES } from './constants';

/**
 * Mapping result for a ledger entry
 */
export interface AccountMapping {
  debitAccount: string;
  creditAccount: string;
  debitAccountNameAr: string;
  creditAccountNameAr: string;
}

/**
 * Category to expense account mapping
 */
const CATEGORY_TO_EXPENSE_ACCOUNT: Record<string, string> = {
  // COGS - تكلفة البضاعة المباعة
  'تكلفة البضاعة المباعة (COGS)': ACCOUNT_CODES.COST_OF_GOODS_SOLD,
  'مواد خام': '5010',
  'شحن': '5020',
  'شراء بضاعة جاهزة': '5030',

  // Operating Expenses - مصاريف تشغيلية
  'مصاريف تشغيلية': ACCOUNT_CODES.SALARIES_EXPENSE,
  'رواتب': ACCOUNT_CODES.SALARIES_EXPENSE,
  'إيجار': ACCOUNT_CODES.RENT_EXPENSE,
  'كهرباء وماء': '5310',
  'صيانة': '5410',
  'تسويق': '5420',
  'قرطاسية': '5430',

  // General Expenses - مصاريف عامة
  'مصاريف عامة': ACCOUNT_CODES.OTHER_EXPENSES,
  'ضرائب': '5510',
  'فوائد قروض': '5520',
  'مصاريف أخرى': '5530',
};

/**
 * Category to revenue account mapping
 */
const CATEGORY_TO_REVENUE_ACCOUNT: Record<string, string> = {
  // Sales - مبيعات
  'مبيعات': ACCOUNT_CODES.SALES_REVENUE,
  'مبيعات منتجات': '4010',
  'مبيعات خدمات': '4110',
  'مبيعات أخرى': ACCOUNT_CODES.SALES_REVENUE,

  // Other Income - إيرادات أخرى
  'إيرادات أخرى': ACCOUNT_CODES.OTHER_INCOME,
  'فوائد بنكية': '4210',
  'بيع أصول': '4220',
  'إيرادات متنوعة': '4230',
};

/**
 * Owner equity category mapping (special handling)
 */
const EQUITY_CATEGORIES: Record<string, string> = {
  'رأس المال': ACCOUNT_CODES.OWNER_CAPITAL,
  'رأس مال مالك': ACCOUNT_CODES.OWNER_CAPITAL,
  'سحوبات المالك': ACCOUNT_CODES.OWNER_DRAWINGS,
};

/**
 * Account names in Arabic (for journal entry display)
 */
export const ACCOUNT_NAMES_AR: Record<string, string> = {
  [ACCOUNT_CODES.CASH]: 'النقدية',
  [ACCOUNT_CODES.BANK]: 'البنك',
  [ACCOUNT_CODES.ACCOUNTS_RECEIVABLE]: 'ذمم مدينة',
  [ACCOUNT_CODES.INVENTORY]: 'المخزون',
  [ACCOUNT_CODES.PREPAID_EXPENSES]: 'مصاريف مدفوعة مقدماً',
  [ACCOUNT_CODES.FIXED_ASSETS]: 'الأصول الثابتة',
  [ACCOUNT_CODES.ACCUMULATED_DEPRECIATION]: 'مجمع الإهلاك',
  [ACCOUNT_CODES.ACCOUNTS_PAYABLE]: 'ذمم دائنة',
  [ACCOUNT_CODES.ACCRUED_EXPENSES]: 'مصاريف مستحقة',
  [ACCOUNT_CODES.NOTES_PAYABLE]: 'أوراق دفع',
  [ACCOUNT_CODES.OWNER_CAPITAL]: 'رأس المال',
  [ACCOUNT_CODES.OWNER_DRAWINGS]: 'سحوبات المالك',
  [ACCOUNT_CODES.RETAINED_EARNINGS]: 'الأرباح المحتجزة',
  [ACCOUNT_CODES.SALES_REVENUE]: 'إيرادات المبيعات',
  [ACCOUNT_CODES.SERVICE_REVENUE]: 'إيرادات الخدمات',
  [ACCOUNT_CODES.OTHER_INCOME]: 'إيرادات أخرى',
  [ACCOUNT_CODES.COST_OF_GOODS_SOLD]: 'تكلفة البضاعة المباعة',
  [ACCOUNT_CODES.SALARIES_EXPENSE]: 'مصاريف الرواتب',
  [ACCOUNT_CODES.RENT_EXPENSE]: 'مصاريف الإيجار',
  [ACCOUNT_CODES.UTILITIES_EXPENSE]: 'مصاريف المرافق',
  [ACCOUNT_CODES.DEPRECIATION_EXPENSE]: 'مصاريف الإهلاك',
  [ACCOUNT_CODES.OTHER_EXPENSES]: 'مصاريف أخرى',
  [ACCOUNT_CODES.BAD_DEBT_EXPENSE]: 'مصروف ديون معدومة',
  // Sub-accounts
  '4010': 'مبيعات منتجات',
  '4110': 'مبيعات خدمات',
  '4210': 'فوائد بنكية',
  '4220': 'بيع أصول',
  '4230': 'إيرادات متنوعة',
  '5010': 'مواد خام',
  '5020': 'شحن',
  '5030': 'شراء بضاعة جاهزة',
  '5310': 'كهرباء وماء',
  '5410': 'مصاريف صيانة',
  '5420': 'مصاريف تسويق',
  '5430': 'قرطاسية',
  '5510': 'ضرائب',
  '5520': 'فوائد قروض',
  '5530': 'مصاريف متنوعة',
};

/**
 * Get Arabic name for an account code
 */
export function getAccountNameAr(code: string): string {
  return ACCOUNT_NAMES_AR[code] || code;
}

/**
 * Check if category is an equity category
 */
export function isEquityCategory(category: string, subCategory?: string): boolean {
  return !!(EQUITY_CATEGORIES[category] || (subCategory && EQUITY_CATEGORIES[subCategory]));
}

/**
 * Get account mapping for a ledger entry
 *
 * This determines which accounts to debit/credit based on:
 * - Transaction type (income/expense)
 * - Category and subcategory
 * - Whether it's an AR/AP tracked entry
 *
 * Standard double-entry rules:
 * - Income: DR Accounts Receivable (or Cash), CR Revenue
 * - Expense: DR Expense, CR Accounts Payable (or Cash)
 * - Owner Capital: DR Cash, CR Owner's Capital
 * - Owner Drawings: DR Owner's Drawings, CR Cash
 */
export function getAccountMappingForLedgerEntry(
  type: string,
  category: string,
  subCategory?: string,
  isARAPEntry?: boolean,
  immediateSettlement?: boolean
): AccountMapping {
  // Determine the specific account from category/subcategory
  const specificCategory = subCategory || category;

  // Check for owner equity transactions (special handling)
  if (isEquityCategory(category, subCategory)) {
    const equityAccount = EQUITY_CATEGORIES[specificCategory] || EQUITY_CATEGORIES[category];

    if (specificCategory === 'سحوبات المالك' || subCategory === 'سحوبات المالك') {
      // Owner withdrawal: DR Owner's Drawings, CR Cash
      return {
        debitAccount: ACCOUNT_CODES.OWNER_DRAWINGS,
        creditAccount: ACCOUNT_CODES.CASH,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.OWNER_DRAWINGS),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      };
    } else {
      // Owner capital contribution: DR Cash, CR Owner's Capital
      return {
        debitAccount: ACCOUNT_CODES.CASH,
        creditAccount: equityAccount,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
        creditAccountNameAr: getAccountNameAr(equityAccount),
      };
    }
  }

  // Income transaction
  if (type === TRANSACTION_TYPES.INCOME) {
    const revenueAccount =
      CATEGORY_TO_REVENUE_ACCOUNT[specificCategory] ||
      CATEGORY_TO_REVENUE_ACCOUNT[category] ||
      ACCOUNT_CODES.SALES_REVENUE;

    // If AR/AP tracked and not immediate settlement: DR AR, CR Revenue
    // If immediate settlement or not AR/AP: DR Cash, CR Revenue
    const debitAccount = isARAPEntry && !immediateSettlement
      ? ACCOUNT_CODES.ACCOUNTS_RECEIVABLE
      : ACCOUNT_CODES.CASH;

    return {
      debitAccount,
      creditAccount: revenueAccount,
      debitAccountNameAr: getAccountNameAr(debitAccount),
      creditAccountNameAr: getAccountNameAr(revenueAccount),
    };
  }

  // Expense transaction
  if (type === TRANSACTION_TYPES.EXPENSE) {
    const expenseAccount =
      CATEGORY_TO_EXPENSE_ACCOUNT[specificCategory] ||
      CATEGORY_TO_EXPENSE_ACCOUNT[category] ||
      ACCOUNT_CODES.OTHER_EXPENSES;

    // If AR/AP tracked and not immediate settlement: DR Expense, CR AP
    // If immediate settlement or not AR/AP: DR Expense, CR Cash
    const creditAccount = isARAPEntry && !immediateSettlement
      ? ACCOUNT_CODES.ACCOUNTS_PAYABLE
      : ACCOUNT_CODES.CASH;

    return {
      debitAccount: expenseAccount,
      creditAccount,
      debitAccountNameAr: getAccountNameAr(expenseAccount),
      creditAccountNameAr: getAccountNameAr(creditAccount),
    };
  }

  // Default fallback (should not reach here)
  return {
    debitAccount: ACCOUNT_CODES.OTHER_EXPENSES,
    creditAccount: ACCOUNT_CODES.CASH,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.OTHER_EXPENSES),
    creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
  };
}

/**
 * Get account mapping for a payment
 *
 * Payments affect AR/AP and Cash:
 * - Receipt (قبض): Customer pays us → DR Cash, CR Accounts Receivable
 * - Disbursement (صرف): We pay supplier → DR Accounts Payable, CR Cash
 */
export function getAccountMappingForPayment(
  paymentType: 'قبض' | 'صرف'
): AccountMapping {
  if (paymentType === 'قبض') {
    // Receipt: DR Cash, CR AR
    return {
      debitAccount: ACCOUNT_CODES.CASH,
      creditAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
    };
  } else {
    // Disbursement: DR AP, CR Cash
    return {
      debitAccount: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
      creditAccount: ACCOUNT_CODES.CASH,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_PAYABLE),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
    };
  }
}

/**
 * Get account mapping for inventory COGS
 *
 * When inventory is sold (exits):
 * - DR Cost of Goods Sold
 * - CR Inventory
 */
export function getAccountMappingForCOGS(): AccountMapping {
  return {
    debitAccount: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    creditAccount: ACCOUNT_CODES.INVENTORY,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
    creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.INVENTORY),
  };
}

/**
 * Get account mapping for inventory purchase
 *
 * When inventory is purchased (enters):
 * - DR Inventory
 * - CR Cash or Accounts Payable
 */
export function getAccountMappingForInventoryPurchase(
  isPaidImmediately: boolean
): AccountMapping {
  const creditAccount = isPaidImmediately
    ? ACCOUNT_CODES.CASH
    : ACCOUNT_CODES.ACCOUNTS_PAYABLE;

  return {
    debitAccount: ACCOUNT_CODES.INVENTORY,
    creditAccount,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.INVENTORY),
    creditAccountNameAr: getAccountNameAr(creditAccount),
  };
}

/**
 * Get account mapping for depreciation
 *
 * Monthly depreciation:
 * - DR Depreciation Expense
 * - CR Accumulated Depreciation
 */
export function getAccountMappingForDepreciation(): AccountMapping {
  return {
    debitAccount: ACCOUNT_CODES.DEPRECIATION_EXPENSE,
    creditAccount: ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.DEPRECIATION_EXPENSE),
    creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCUMULATED_DEPRECIATION),
  };
}

/**
 * Get account mapping for fixed asset purchase
 *
 * When fixed asset is purchased:
 * - DR Fixed Assets
 * - CR Cash or Accounts Payable
 */
export function getAccountMappingForFixedAssetPurchase(
  isPaidImmediately: boolean
): AccountMapping {
  const creditAccount = isPaidImmediately
    ? ACCOUNT_CODES.CASH
    : ACCOUNT_CODES.ACCOUNTS_PAYABLE;

  return {
    debitAccount: ACCOUNT_CODES.FIXED_ASSETS,
    creditAccount,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.FIXED_ASSETS),
    creditAccountNameAr: getAccountNameAr(creditAccount),
  };
}

/**
 * Get account mapping for bad debt writeoff
 *
 * When receivable is written off as uncollectible:
 * - DR Bad Debt Expense
 * - CR Accounts Receivable
 */
export function getAccountMappingForBadDebt(): AccountMapping {
  return {
    debitAccount: ACCOUNT_CODES.BAD_DEBT_EXPENSE,
    creditAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.BAD_DEBT_EXPENSE),
    creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
  };
}
