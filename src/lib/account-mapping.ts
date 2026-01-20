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
  'نقل بضاعة': '5020', // Freight/shipping for goods → same as شحن
  'هدر وتالف': ACCOUNT_CODES.COST_OF_GOODS_SOLD, // Waste/damage → COGS (inventory consumed)
  'عينات مجانية': ACCOUNT_CODES.COST_OF_GOODS_SOLD, // Free samples → COGS (inventory given away)

  // Operating Expenses - مصاريف تشغيلية
  // Fallback to OTHER_EXPENSES for unmapped subcategories (not Salaries)
  'مصاريف تشغيلية': ACCOUNT_CODES.OTHER_EXPENSES,
  'رواتب': ACCOUNT_CODES.SALARIES_EXPENSE,
  'رواتب وأجور': ACCOUNT_CODES.SALARIES_EXPENSE,
  'إيجار': ACCOUNT_CODES.RENT_EXPENSE,
  'إيجارات': ACCOUNT_CODES.RENT_EXPENSE,
  'كهرباء وماء': '5310',
  'صيانة': ACCOUNT_CODES.MAINTENANCE_EXPENSE,
  'تسويق': ACCOUNT_CODES.MARKETING_EXPENSE,
  'تسويق وإعلان': ACCOUNT_CODES.MARKETING_EXPENSE,
  'قرطاسية': ACCOUNT_CODES.OFFICE_SUPPLIES,
  'مصاريف مكتبية': ACCOUNT_CODES.OFFICE_SUPPLIES, // Office expenses → Office Supplies
  'وقود ومواصلات': ACCOUNT_CODES.TRANSPORTATION_EXPENSE, // Fuel & transportation
  'رحلة عمل': ACCOUNT_CODES.TRAVEL_EXPENSE, // Business trips → Travel Expense (separate from transportation)
  'مصاريف إدارية': ACCOUNT_CODES.ADMIN_EXPENSE, // Administrative expenses
  'اتصالات وإنترنت': ACCOUNT_CODES.COMMUNICATIONS_EXPENSE, // Communications
  'مستهلكات': ACCOUNT_CODES.OFFICE_SUPPLIES, // Consumables → Office Supplies
  'أدوات ومعدات صغيرة': ACCOUNT_CODES.SMALL_EQUIPMENT, // Small tools & equipment

  // General Expenses - مصاريف عامة
  'مصاريف عامة': ACCOUNT_CODES.OTHER_EXPENSES,
  'مصاريف أخرى': ACCOUNT_CODES.MISC_EXPENSES,
  'مصاريف متنوعة': ACCOUNT_CODES.MISC_EXPENSES,
  'مصاريف قانونية': ACCOUNT_CODES.PROFESSIONAL_FEES, // Legal fees
  'تأمينات': ACCOUNT_CODES.INSURANCE_EXPENSE, // Insurance
  'ضرائب': ACCOUNT_CODES.TAXES_EXPENSE,
  'ضرائب ورسوم': ACCOUNT_CODES.TAXES_EXPENSE,
  'فوائد قروض': ACCOUNT_CODES.LOAN_INTEREST_EXPENSE,
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
  [ACCOUNT_CODES.LOANS_RECEIVABLE]: 'قروض ممنوحة',
  [ACCOUNT_CODES.SUPPLIER_ADVANCES]: 'سلفات موردين',
  [ACCOUNT_CODES.ACCOUNTS_PAYABLE]: 'ذمم دائنة',
  [ACCOUNT_CODES.LOANS_PAYABLE]: 'قروض مستحقة',
  [ACCOUNT_CODES.ACCRUED_EXPENSES]: 'مصاريف مستحقة',
  [ACCOUNT_CODES.CUSTOMER_ADVANCES]: 'سلفات عملاء',
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
  [ACCOUNT_CODES.MAINTENANCE_EXPENSE]: 'مصاريف صيانة',
  [ACCOUNT_CODES.MARKETING_EXPENSE]: 'مصاريف تسويق',
  [ACCOUNT_CODES.OFFICE_SUPPLIES]: 'قرطاسية ومستلزمات مكتبية',
  [ACCOUNT_CODES.TRANSPORTATION_EXPENSE]: 'وقود ومواصلات',
  [ACCOUNT_CODES.TRAVEL_EXPENSE]: 'سفر وضيافة',
  [ACCOUNT_CODES.ADMIN_EXPENSE]: 'مصاريف إدارية',
  [ACCOUNT_CODES.COMMUNICATIONS_EXPENSE]: 'اتصالات وإنترنت',
  [ACCOUNT_CODES.SMALL_EQUIPMENT]: 'أدوات ومعدات صغيرة',
  [ACCOUNT_CODES.PROFESSIONAL_FEES]: 'مصاريف قانونية ومهنية',
  [ACCOUNT_CODES.INSURANCE_EXPENSE]: 'تأمينات',
  [ACCOUNT_CODES.OTHER_EXPENSES]: 'مصاريف أخرى',
  [ACCOUNT_CODES.TAXES_EXPENSE]: 'ضرائب ورسوم',
  [ACCOUNT_CODES.LOAN_INTEREST_EXPENSE]: 'فوائد قروض',
  [ACCOUNT_CODES.MISC_EXPENSES]: 'مصاريف متنوعة',
  [ACCOUNT_CODES.BAD_DEBT_EXPENSE]: 'مصروف ديون معدومة',
  [ACCOUNT_CODES.SALES_DISCOUNT]: 'خصم المبيعات',
  [ACCOUNT_CODES.PURCHASE_DISCOUNT]: 'خصم المشتريات',
  // Sub-accounts (legacy codes for backward compatibility)
  '4010': 'مبيعات منتجات',
  '4110': 'مبيعات خدمات',
  '4210': 'فوائد بنكية',
  '4220': 'بيع أصول',
  '4230': 'إيرادات متنوعة',
  '5010': 'مواد خام',
  '5020': 'شحن ونقل بضاعة',
  '5030': 'شراء بضاعة جاهزة',
  '5310': 'كهرباء وماء',
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

  // Check for advance transactions (Balance Sheet items, NOT P&L)
  // Advances must be handled BEFORE income/expense routing
  if (isAdvanceCategory(category)) {
    return getAccountMappingForAdvance(category as 'سلفة عميل' | 'سلفة مورد');
  }

  // Check for loan transactions (Balance Sheet items, NOT P&L)
  // Loans must be handled BEFORE income/expense routing
  if (isLoanCategory(category)) {
    return getAccountMappingForLoan(category, subCategory);
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

/**
 * Get account mapping for settlement discount
 *
 * When a discount is given during settlement:
 * - Income (AR) settlement discount:
 *   DR Sales Discount (contra-revenue), CR Accounts Receivable
 * - Expense (AP) settlement discount:
 *   DR Accounts Payable, CR Purchase Discount (contra-expense)
 */
export function getAccountMappingForSettlementDiscount(
  entryType: 'دخل' | 'مصروف'
): AccountMapping {
  if (entryType === 'دخل') {
    // Income settlement: Sales discount reduces AR
    return {
      debitAccount: ACCOUNT_CODES.SALES_DISCOUNT,
      creditAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.SALES_DISCOUNT),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
    };
  } else {
    // Expense settlement: Purchase discount reduces AP
    return {
      debitAccount: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
      creditAccount: ACCOUNT_CODES.PURCHASE_DISCOUNT,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_PAYABLE),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.PURCHASE_DISCOUNT),
    };
  }
}

/**
 * Get account mapping for advance transactions
 *
 * Advances are Balance Sheet items, NOT P&L:
 * - Customer Advance (سلفة عميل): DR Cash, CR Customer Advances (Liability)
 *   Customer pays us upfront → we owe them goods/services
 * - Supplier Advance (سلفة مورد): DR Supplier Advances (Asset), CR Cash
 *   We pay supplier upfront → they owe us goods/services
 */
export function getAccountMappingForAdvance(
  advanceType: 'سلفة عميل' | 'سلفة مورد'
): AccountMapping {
  if (advanceType === 'سلفة عميل') {
    // Customer advance: We receive cash, create liability (we owe them goods/services)
    return {
      debitAccount: ACCOUNT_CODES.CASH,
      creditAccount: ACCOUNT_CODES.CUSTOMER_ADVANCES,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CUSTOMER_ADVANCES),
    };
  } else {
    // Supplier advance: We pay cash, create asset (they owe us goods/services)
    return {
      debitAccount: ACCOUNT_CODES.SUPPLIER_ADVANCES,
      creditAccount: ACCOUNT_CODES.CASH,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.SUPPLIER_ADVANCES),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
    };
  }
}

/**
 * Check if a category is an advance category
 */
export function isAdvanceCategory(category: string): boolean {
  return category === 'سلفة عميل' || category === 'سلفة مورد';
}

/**
 * Loan category constants
 */
const LOAN_CATEGORIES = {
  GIVEN: 'قروض ممنوحة',
  RECEIVED: 'قروض مستلمة',
} as const;

const LOAN_SUBCATEGORIES = {
  GIVE_LOAN: 'منح قرض',
  RECEIVE_LOAN: 'استلام قرض',
  COLLECT_LOAN: 'تحصيل قرض',
  REPAY_LOAN: 'سداد قرض',
} as const;

/**
 * Check if a category is a loan category
 */
export function isLoanCategory(category: string): boolean {
  return category === LOAN_CATEGORIES.GIVEN || category === LOAN_CATEGORIES.RECEIVED;
}

/**
 * Get account mapping for loan transactions
 *
 * Loans are Balance Sheet items, NOT P&L:
 * - Loan Given (قروض ممنوحة):
 *   - Initial (منح قرض): DR Loans Receivable, CR Cash (asset increases)
 *   - Collection (تحصيل قرض): DR Cash, CR Loans Receivable (asset decreases)
 * - Loan Received (قروض مستلمة):
 *   - Initial (استلام قرض): DR Cash, CR Loans Payable (liability increases)
 *   - Repayment (سداد قرض): DR Loans Payable, CR Cash (liability decreases)
 */
export function getAccountMappingForLoan(
  category: string,
  subCategory?: string
): AccountMapping {
  const isLoanGiven = category === LOAN_CATEGORIES.GIVEN;
  const isInitialLoan = subCategory === LOAN_SUBCATEGORIES.GIVE_LOAN ||
                        subCategory === LOAN_SUBCATEGORIES.RECEIVE_LOAN;

  if (isLoanGiven) {
    if (isInitialLoan) {
      // Give loan: DR Loans Receivable, CR Cash (asset increases)
      return {
        debitAccount: ACCOUNT_CODES.LOANS_RECEIVABLE,
        creditAccount: ACCOUNT_CODES.CASH,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.LOANS_RECEIVABLE),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      };
    } else {
      // Collect loan: DR Cash, CR Loans Receivable (asset decreases)
      return {
        debitAccount: ACCOUNT_CODES.CASH,
        creditAccount: ACCOUNT_CODES.LOANS_RECEIVABLE,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.LOANS_RECEIVABLE),
      };
    }
  } else {
    // Loans Received
    if (isInitialLoan) {
      // Receive loan: DR Cash, CR Loans Payable (liability increases)
      return {
        debitAccount: ACCOUNT_CODES.CASH,
        creditAccount: ACCOUNT_CODES.LOANS_PAYABLE,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.LOANS_PAYABLE),
      };
    } else {
      // Repay loan: DR Loans Payable, CR Cash (liability decreases)
      return {
        debitAccount: ACCOUNT_CODES.LOANS_PAYABLE,
        creditAccount: ACCOUNT_CODES.CASH,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.LOANS_PAYABLE),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      };
    }
  }
}

/**
 * Fixed asset subcategories that should be capitalized to Balance Sheet
 */
const FIXED_ASSET_SUBCATEGORIES = [
  'معدات وآلات',
  'أثاث ومفروشات',
  'سيارات ومركبات',
  'مباني وعقارات',
  'أجهزة كمبيوتر',
] as const;

/**
 * Check if a category/subcategory is a fixed asset purchase
 * Fixed assets should be capitalized to Balance Sheet, NOT expensed
 */
export function isFixedAssetCategory(category: string, subCategory?: string): boolean {
  if (category === 'أصول ثابتة') {
    return true;
  }
  if (subCategory && FIXED_ASSET_SUBCATEGORIES.includes(subCategory as typeof FIXED_ASSET_SUBCATEGORIES[number])) {
    return true;
  }
  return false;
}
