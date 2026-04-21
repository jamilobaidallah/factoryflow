/**
 * Category-to-Account Mapping
 *
 * Maps existing ledger categories (Arabic) to Chart of Accounts codes.
 * This enables backward compatibility - existing ledger entry flows
 * continue working while automatically generating proper journal entries.
 */

import { ACCOUNT_CODES, DEPRECIATION_SUBCATEGORIES } from '@/types/accounting';
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

  // Stone business — new subcategories
  'شراء حجر خام مستورد': '1301',             // Imported raw stone → DR 1301 (asset)
  'استيراد ونقل وجمارك': '1301',                   // Import+freight+customs → DR 1301 (IAS 2.10: capitalize to specific asset)
  'شراء حجر جاهز':       '1303',             // Ready stone → DR 1303 (asset)
  'مصاريف تقطيع':        ACCOUNT_CODES.INVENTORY_LOSSES, // Blade wear + cutting maintenance → DR 5040

  // Legacy stone aliases (backward compat)
  'مواد خام':            '1301',             // Old name for imported raw stone
  'شحن مواد خام':        '1301',                   // Old inbound freight → same as استيراد ونقل وجمارك
  'شراء بضاعة جاهزة':   '5030',             // Old generic ready goods (mapped to sub-COGS)

  'نقل بضاعة': ACCOUNT_CODES.TRANSPORTATION_EXPENSE, // Operating transport → 5440 (not COGS)
  'هدر وتالف': '5060',   // Wastage/damage → Inventory Losses & Impairment (5060)
  'عينات مجانية': ACCOUNT_CODES.MARKETING_EXPENSE, // Free samples → Marketing Expense (5420), not COGS

  // Sales commissions (external agents only)
  'عمولات مبيعات':       '5425',

  // Depreciation
  'إهلاك الأصول':        ACCOUNT_CODES.DEPRECIATION_EXPENSE,  // DR 5400 (non-cash — override in routing)

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
  'فوائد قروض': ACCOUNT_CODES.LOAN_INTEREST_EXPENSE,          // backward compat
  'فوائد قروض مدفوعة': ACCOUNT_CODES.LOAN_INTEREST_EXPENSE,  // new name
};

/**
 * Category to revenue account mapping
 */
const CATEGORY_TO_REVENUE_ACCOUNT: Record<string, string> = {
  // Stone business revenue — new subcategories
  'مبيعات حجر مقطوع': '4010',
  'مبيعات حجر جاهز':  '4020',

  // Legacy sales aliases (backward compat)
  'مبيعات': ACCOUNT_CODES.SALES_REVENUE,
  'مبيعات منتجات': '4010',
  'مبيعات خدمات': '4110',
  'مبيعات أخرى': ACCOUNT_CODES.SALES_REVENUE,

  // Contra-Revenue - مردودات المبيعات
  'مردودات المبيعات': ACCOUNT_CODES.SALES_RETURNS,
  'بضاعة مردودة من عميل': ACCOUNT_CODES.SALES_RETURNS,

  // Other Income - إيرادات أخرى
  'إيرادات أخرى': ACCOUNT_CODES.OTHER_INCOME,
  'فوائد بنكية': '4210',
  'بيع أصول': '4220',
  'إيرادات متنوعة': '4230',
};

/**
 * Owner equity category mapping (detection only — actual codes resolved via TemplateContext)
 */
const EQUITY_CATEGORIES: Record<string, string> = {
  // New generic strings (used by the dynamic partner equity system)
  'رأس مال':       ACCOUNT_CODES.OWNER_CAPITAL,  // detection only
  'سحوبات':        ACCOUNT_CODES.OWNER_CAPITAL,  // detection only
  // Legacy strings (backward compat — old entries keep these)
  'رأس المال':     ACCOUNT_CODES.OWNER_CAPITAL,
  'رأس مال مالك': ACCOUNT_CODES.OWNER_CAPITAL,
  'سحوبات المالك': ACCOUNT_CODES.OWNER_CAPITAL,
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
  [ACCOUNT_CODES.OWNER_CAPITAL]: 'حقوق الشركاء',
  [ACCOUNT_CODES.INCOME_SUMMARY]: 'ملخص الدخل',
  [ACCOUNT_CODES.SALES_REVENUE]: 'إيرادات المبيعات',
  [ACCOUNT_CODES.SERVICE_REVENUE]: 'إيرادات الخدمات',
  [ACCOUNT_CODES.OTHER_INCOME]: 'إيرادات أخرى',
  [ACCOUNT_CODES.COST_OF_GOODS_SOLD]: 'تكلفة البضاعة المباعة',
  [ACCOUNT_CODES.INVENTORY_LOSSES]: 'استهلاك شفرات وصيانة آلات التقطيع',
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
  [ACCOUNT_CODES.SALES_RETURNS]: 'مردودات المبيعات',
  [ACCOUNT_CODES.SALES_DISCOUNT]: 'خصم المبيعات',
  [ACCOUNT_CODES.PURCHASE_DISCOUNT]: 'خصم المشتريات',
  // Sub-accounts (legacy codes for backward compatibility)
  '4010': 'مبيعات حجر مقطوع',
  '4020': 'مبيعات حجر جاهز',
  '4110': 'مبيعات خدمات',
  '4210': 'فوائد بنكية',
  '4220': 'بيع أصول',
  '4230': 'إيرادات متنوعة',
  '5010': 'مواد خام',
  '5020': 'شحن ونقل بضاعة',
  '5030': 'شراء بضاعة جاهزة',
  '5060': 'خسائر المخزون وهبوط القيمة',
  '5310': 'كهرباء وماء',
  '5425': 'عمولات مبيعات',
  // Stone inventory accounts
  '1301': 'حجر خام',
  '1302': 'حجر جاهز — إنتاج داخلي',
  '1303': 'حجر جاهز — مشتريات محلية',
  // Note: INCOME_SUMMARY (3300 = 'ملخص الدخل') is already defined above at line ~138
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
 *
 * @param isEndorsementAdvance - True if advance was created via cheque endorsement (uses AR instead of Cash)
 */
export function getAccountMappingForLedgerEntry(
  type: string,
  category: string,
  subCategory?: string,
  isARAPEntry?: boolean,
  immediateSettlement?: boolean,
  isEndorsementAdvance?: boolean,
  isInventoryPurchase?: boolean,
  isNonCashInventoryOut?: boolean
): AccountMapping {
  // Determine the specific account from category/subcategory
  const specificCategory = subCategory || category;

  // Check for owner equity transactions (special handling)
  // Note: actual partner-specific account codes are resolved via TemplateContext in JournalTemplates.ts
  // This block is a fallback; the real routing happens in OWNER_CAPITAL / OWNER_DRAWINGS templates.
  if (isEquityCategory(category, subCategory)) {
    const isDrawings = specificCategory === 'سحوبات المالك' ||
                       specificCategory === 'سحوبات' ||
                       subCategory === 'سحوبات المالك' ||
                       subCategory === 'سحوبات';
    if (isDrawings) {
      // Fallback drawings: DR Owner's Capital (3000), CR Cash
      // Real code injected via TemplateContext.partnerDrawingsCode
      return {
        debitAccount: ACCOUNT_CODES.OWNER_CAPITAL,
        creditAccount: ACCOUNT_CODES.CASH,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.OWNER_CAPITAL),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      };
    } else {
      // Fallback capital: DR Cash, CR Owner's Capital (3000)
      // Real code injected via TemplateContext.partnerCapitalCode
      return {
        debitAccount: ACCOUNT_CODES.CASH,
        creditAccount: ACCOUNT_CODES.OWNER_CAPITAL,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.OWNER_CAPITAL),
      };
    }
  }

  // Check for advance transactions (Balance Sheet items, NOT P&L)
  // Advances must be handled BEFORE income/expense routing
  if (isAdvanceCategory(category)) {
    return getAccountMappingForAdvance(category as 'سلفة عميل' | 'سلفة مورد', isEndorsementAdvance);
  }

  // Check for loan transactions (Balance Sheet items, NOT P&L)
  // Loans must be handled BEFORE income/expense routing
  if (isLoanCategory(category)) {
    return getAccountMappingForLoan(category, subCategory);
  }

  // Check for fixed asset purchases (Balance Sheet items, NOT P&L)
  // Fixed assets are capitalized, not expensed
  if (isFixedAssetCategory(category, subCategory)) {
    return getAccountMappingForFixedAssetPurchase(immediateSettlement ?? true);
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
    // Inventory purchase: adds to Inventory Asset, not expensed immediately.
    // Stone-specific subcategories map to sub-inventory accounts (1301, 1303).
    // Fall back to parent 1300 for generic purchases.
    if (isInventoryPurchase) {
      const subInventoryCode = CATEGORY_TO_EXPENSE_ACCOUNT[specificCategory];
      const debitAccount =
        subInventoryCode && subInventoryCode.startsWith('1')
          ? subInventoryCode
          : ACCOUNT_CODES.INVENTORY; // 1300 parent fallback
      const creditAccount =
        (immediateSettlement ?? true)
          ? ACCOUNT_CODES.CASH
          : ACCOUNT_CODES.ACCOUNTS_PAYABLE;
      return {
        debitAccount,
        creditAccount,
        debitAccountNameAr:  getAccountNameAr(debitAccount),
        creditAccountNameAr: getAccountNameAr(creditAccount),
      };
    }

    // Inventory transfer: raw stone (1301) → cut stone (1302)
    // DR 1302, CR 1301 — no cash movement
    if (specificCategory === 'تحويل حجر خام إلى مقطوع') {
      return {
        debitAccount: '1302',
        creditAccount: '1301',
        debitAccountNameAr: getAccountNameAr('1302'),
        creditAccountNameAr: getAccountNameAr('1301'),
      };
    }

    // Depreciation: DR Depreciation Expense, CR Accumulated Depreciation
    // Must come before normal expense block so it doesn't fall through to OTHER_EXPENSES
    if ((DEPRECIATION_SUBCATEGORIES as readonly string[]).includes(specificCategory)) {
      return getAccountMappingForDepreciation();
    }

    const expenseAccount =
      CATEGORY_TO_EXPENSE_ACCOUNT[specificCategory] ||
      CATEGORY_TO_EXPENSE_ACCOUNT[category] ||
      ACCOUNT_CODES.OTHER_EXPENSES;

    // Wastage/samples: inventory leaves stock with no cash payment.
    // DR Expense (5xxx), CR Inventory (1300) — not Cash/AP.
    if (isNonCashInventoryOut) {
      return {
        debitAccount: expenseAccount,
        creditAccount: ACCOUNT_CODES.INVENTORY,
        debitAccountNameAr: getAccountNameAr(expenseAccount),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.INVENTORY),
      };
    }

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
 * Returns the sub-inventory account code for a given purchase subcategory.
 * Sub-inventory codes are 1301 (imported raw stone), 1302 (cut stone), 1303 (ready stone).
 * Falls back to the parent inventory account (1300) for any unrecognised subcategory.
 */
export function getInventorySubAccountCode(subCategory: string): string {
  const SUB_INVENTORY_CODES = new Set(['1301', '1302', '1303']);
  const mapped = CATEGORY_TO_EXPENSE_ACCOUNT[subCategory];
  if (!mapped || !SUB_INVENTORY_CODES.has(mapped)) {
    if (subCategory) {
      console.warn(`[getInventorySubAccountCode] Subcategory "${subCategory}" has no sub-inventory mapping — falling back to parent 1300. Add it to CATEGORY_TO_EXPENSE_ACCOUNT if this is a stone business purchase.`);
    }
    return ACCOUNT_CODES.INVENTORY;
  }
  return mapped;
}

/**
 * Get account mapping for inventory COGS
 *
 * When inventory is sold (exits):
 * - DR Cost of Goods Sold
 * - CR sub-inventory (1301/1302/1303) or parent (1300) as fallback
 *
 * @param inventorySubCode - The specific sub-inventory account to credit.
 *   Pass the item's inventoryAccountCode so Balance Sheet shows the correct
 *   sub-inventory reduction. Defaults to parent 1300 when not provided.
 */
export function getAccountMappingForCOGS(inventorySubCode?: string): AccountMapping {
  const VALID_INVENTORY_CODES = new Set(['1300', '1301', '1302', '1303']);
  const creditAccount = (inventorySubCode && VALID_INVENTORY_CODES.has(inventorySubCode))
    ? inventorySubCode
    : ACCOUNT_CODES.INVENTORY;
  return {
    debitAccount: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    creditAccount,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
    creditAccountNameAr: getAccountNameAr(creditAccount),
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
 * - Expense/Return (AP) settlement discount:
 *   DR Accounts Payable, CR Purchase Discount (contra-expense)
 */
export function getAccountMappingForSettlementDiscount(
  entryType: 'دخل' | 'مردود' | 'مصروف'
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
 *
 * For CASH advances (direct payment):
 * - Customer Advance (سلفة عميل): DR Cash, CR Customer Advances (Liability)
 *   Customer pays us cash upfront → we owe them goods/services
 * - Supplier Advance (سلفة مورد): DR Supplier Advances (Asset), CR Cash
 *   We pay supplier cash upfront → they owe us goods/services
 *
 * For ENDORSEMENT advances (cheque endorsement, no cash movement):
 * Per Bill of Exchange accounting standards, the cheque comes from the client (AR source):
 * - Customer Advance: DR AR, CR Customer Advances (Liability)
 *   Client's cheque had excess → we reduced AR less, created liability
 * - Supplier Advance: DR Supplier Advances (Asset), CR AR
 *   Cheque from client used for supplier advance → AR to Asset conversion
 *
 * @param advanceType - Type of advance: customer or supplier
 * @param isEndorsementAdvance - True if advance created via cheque endorsement (no cash movement)
 */
export function getAccountMappingForAdvance(
  advanceType: 'سلفة عميل' | 'سلفة مورد',
  isEndorsementAdvance: boolean = false
): AccountMapping {
  if (advanceType === 'سلفة عميل') {
    if (isEndorsementAdvance) {
      // Endorsement customer advance: Client's cheque had excess
      // DR AR (we reduced AR less than cheque value), CR Customer Advances
      return {
        debitAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        creditAccount: ACCOUNT_CODES.CUSTOMER_ADVANCES,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CUSTOMER_ADVANCES),
      };
    }
    // Cash customer advance: We receive cash, create liability (we owe them goods/services)
    return {
      debitAccount: ACCOUNT_CODES.CASH,
      creditAccount: ACCOUNT_CODES.CUSTOMER_ADVANCES,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CUSTOMER_ADVANCES),
    };
  } else {
    if (isEndorsementAdvance) {
      // Endorsement supplier advance: Cheque from client used to prepay supplier
      // DR Supplier Advances (asset created), CR AR (cheque came from client)
      return {
        debitAccount: ACCOUNT_CODES.SUPPLIER_ADVANCES,
        creditAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.SUPPLIER_ADVANCES),
        creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
      };
    }
    // Cash supplier advance: We pay cash, create asset (they owe us goods/services)
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

/**
 * Get account mapping for applying an advance to an invoice
 *
 * When an advance is used to pay an invoice:
 * - Customer Advance Application: DR Customer Advances (reduce liability), CR AR (reduce receivable)
 *   The customer's prepayment is consumed to settle what they owe us
 * - Supplier Advance Application: DR AP (reduce payable), CR Supplier Advances (reduce asset)
 *   Our prepayment to supplier is consumed to settle what we owe them
 *
 * This creates the missing journal entry for advance consumption.
 * Without this, Trial Balance would show incorrect AR/AP and Advance balances.
 *
 * @param advanceType - Type of advance being applied: customer or supplier
 */
export function getAccountMappingForAdvanceApplication(
  advanceType: 'سلفة عميل' | 'سلفة مورد'
): AccountMapping {
  if (advanceType === 'سلفة عميل') {
    // Customer advance application: Reduce Customer Advances liability, reduce AR
    // DR Customer Advances (2150), CR AR (1200)
    return {
      debitAccount: ACCOUNT_CODES.CUSTOMER_ADVANCES,
      creditAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CUSTOMER_ADVANCES),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
    };
  } else {
    // Supplier advance application: Reduce AP, reduce Supplier Advances asset
    // DR AP (2000), CR Supplier Advances (1350)
    return {
      debitAccount: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
      creditAccount: ACCOUNT_CODES.SUPPLIER_ADVANCES,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_PAYABLE),
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.SUPPLIER_ADVANCES),
    };
  }
}

/**
 * Get account mapping for cheque endorsement
 *
 * Endorsement transfers a received cheque to pay a supplier:
 * - DR Accounts Payable (reduce what we owe supplier)
 * - CR Accounts Receivable (reduce what customer owes us, via cheque transfer)
 *
 * This is bill of exchange accounting - the cheque is a negotiable instrument
 * that can be transferred to settle obligations.
 */
export function getAccountMappingForEndorsement(): AccountMapping {
  return {
    debitAccount: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    creditAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_PAYABLE),
    creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
  };
}
