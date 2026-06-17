/**
 * Account mapping — given the user-facing transaction type and category,
 * returns which Chart of Accounts entries to debit and credit.
 *
 * This is the local-side mirror of the Firestore `account-mapping.ts` that
 * lives in src/lib/account-mapping.ts. The same business rules apply.
 *
 * Hard-coded account codes match the seedChartOfAccounts() defaults.
 */

export interface AccountRef {
  code:   string;
  name:   string;
  nameAr: string;
}

export interface AccountMapping {
  debitAccount:  AccountRef;
  creditAccount: AccountRef;
}

export interface MappingInput {
  type:                string;
  category?:           string;
  subCategory?:        string;
  isInstant:           boolean;
  isInventoryPurchase: boolean;
  isReturnEntry:       boolean;
  isCOGSReversal:      boolean;
}

// ── Account constants ────────────────────────────────────────────────────────
// Mirror of seed-coa.ts — keep these in sync if seed-coa.ts changes.

const ACC = {
  CASH:                 { code: '1100', name: 'Cash and Cash Equivalents',   nameAr: 'النقدية وما في حكمها' },
  AR:                   { code: '1200', name: 'Accounts Receivable',         nameAr: 'الذمم المدينة' },
  AP:                   { code: '2100', name: 'Accounts Payable',            nameAr: 'الذمم الدائنة' },
  INVENTORY:            { code: '1300', name: 'Inventory',                   nameAr: 'المخزون' },
  RAW_STONE:            { code: '1301', name: 'Imported Raw Stone',          nameAr: 'بلاطات حجر خام — واردات' },
  CUT_STONE:            { code: '1302', name: 'Cut Stone In-house',          nameAr: 'حجر مقطوع — إنتاج داخلي' },
  READY_STONE:          { code: '1303', name: 'Ready Stone — Local',         nameAr: 'حجر جاهز — مشتريات محلية' },
  PARTNERS_EQUITY:      { code: '3000', name: "Partners' Equity",            nameAr: 'حقوق الشركاء' },
  REVENUE:              { code: '4000', name: 'Revenue',                     nameAr: 'الإيرادات' },
  CUT_STONE_SALES:      { code: '4010', name: 'Cut Stone Sales',             nameAr: 'مبيعات حجر مقطوع' },
  READY_STONE_SALES:    { code: '4020', name: 'Ready Stone Sales',           nameAr: 'مبيعات حجر جاهز' },
  SALES_RETURNS:        { code: '4050', name: 'Sales Returns',               nameAr: 'مردودات المبيعات' },
  EXPENSE:              { code: '5000', name: 'Expenses',                    nameAr: 'المصاريف' },
  COGS:                 { code: '5010', name: 'Cost of Goods Sold',          nameAr: 'تكلفة البضاعة المباعة' },
  OPERATING_EXPENSE:    { code: '5100', name: 'Operating Expenses',          nameAr: 'مصاريف التشغيل' },
  SALARIES:             { code: '5200', name: 'Salaries & Wages',            nameAr: 'الرواتب والأجور' },
  RENT:                 { code: '5300', name: 'Rent Expense',                nameAr: 'مصاريف الإيجار' },
  DEPRECIATION:         { code: '5400', name: 'Depreciation Expense',        nameAr: 'مصاريف الإهلاك' },
} as const;

// ── Category → revenue account ───────────────────────────────────────────────

const CATEGORY_TO_REVENUE: Record<string, AccountRef> = {
  'مبيعات حجر مقطوع': ACC.CUT_STONE_SALES,
  'مبيعات حجر جاهز':  ACC.READY_STONE_SALES,
  'مبيعات منتجات':    ACC.CUT_STONE_SALES,        // legacy
  'مبيعات':           ACC.REVENUE,                // generic fallback
};

// ── Category → expense account ───────────────────────────────────────────────

const SUBCATEGORY_TO_EXPENSE: Record<string, AccountRef> = {
  // Inventory purchases (capitalised, not expensed)
  'شراء حجر خام مستورد': ACC.RAW_STONE,
  'استيراد ونقل وجمارك': ACC.INVENTORY,
  'شراء حجر جاهز':       ACC.READY_STONE,
  'مواد خام':            ACC.RAW_STONE,
  'شحن مواد خام':        ACC.INVENTORY,
  'شراء بضاعة جاهزة':   ACC.READY_STONE,
  // Operating expenses
  'إيجار':              ACC.RENT,
  'إيجار محل':          ACC.RENT,
  'رواتب':              ACC.SALARIES,
  'إهلاك الأصول':       ACC.DEPRECIATION,
};

const CATEGORY_TO_EXPENSE_FALLBACK: Record<string, AccountRef> = {
  'تكلفة البضاعة المباعة': ACC.COGS,
  'مصاريف تشغيلية':        ACC.OPERATING_EXPENSE,
  'الرواتب':               ACC.SALARIES,
  'إيجار':                 ACC.RENT,
};

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Resolve which DR/CR accounts to use for a transaction.
 *
 * Rules (mirrored from src/lib/account-mapping.ts):
 *  - Income (دخل / إيراد):
 *      DR: Cash (if instant) or AR (if credit)
 *      CR: revenue account matched from category
 *
 *  - Sales return (مردود):
 *      DR: Sales Returns (4050)
 *      CR: Cash (if instant) or AR (if credit)
 *
 *  - Expense (مصروف):
 *      DR: expense or inventory account from subCategory/category
 *      CR: Cash (if instant) or AP (if credit)
 *
 *  - Equity / Capital movement (حركة رأس مال):
 *      Capital contribution: DR Cash, CR Partners' Equity
 *      Drawing:              DR Partners' Equity, CR Cash
 */
export function resolveAccountMapping(input: MappingInput): AccountMapping {
  const { type, category, subCategory, isInstant, isInventoryPurchase, isReturnEntry } = input;

  // ── Sales returns (income reversal) ────────────────────────────────────────
  if (isReturnEntry || type === 'مردود') {
    return {
      debitAccount:  ACC.SALES_RETURNS,
      creditAccount: isInstant ? ACC.CASH : ACC.AR,
    };
  }

  // ── Income (دخل / إيراد) ─────────────────────────────────────────────────
  if (type === 'دخل' || type === 'إيراد') {
    const revenueAccount = (category ? CATEGORY_TO_REVENUE[category] : undefined) ?? ACC.REVENUE;
    return {
      debitAccount:  isInstant ? ACC.CASH : ACC.AR,
      creditAccount: revenueAccount,
    };
  }

  // ── Expense (مصروف) ──────────────────────────────────────────────────────
  if (type === 'مصروف') {
    // Inventory purchase: DR Inventory account, CR Cash/AP
    if (isInventoryPurchase) {
      const inventoryAcc = (subCategory ? SUBCATEGORY_TO_EXPENSE[subCategory] : undefined) ?? ACC.INVENTORY;
      return {
        debitAccount:  inventoryAcc,
        creditAccount: isInstant ? ACC.CASH : ACC.AP,
      };
    }
    const expenseAcc =
      (subCategory ? SUBCATEGORY_TO_EXPENSE[subCategory] : undefined) ??
      (category    ? CATEGORY_TO_EXPENSE_FALLBACK[category] : undefined) ??
      ACC.EXPENSE;
    return {
      debitAccount:  expenseAcc,
      creditAccount: isInstant ? ACC.CASH : ACC.AP,
    };
  }

  // ── Equity / capital movement ────────────────────────────────────────────
  if (type === 'حركة رأس مال') {
    // "رأس مال" / "رأس المال" = contribution (DR Cash, CR Equity)
    // "سحوبات" / "سحوبات المالك" = withdrawal (DR Equity, CR Cash)
    const isContribution = subCategory === 'رأس مال' || subCategory === 'رأس المال' || subCategory === 'رأس مال مالك';
    const isWithdrawal   = subCategory === 'سحوبات'  || subCategory === 'سحوبات المالك';
    if (isContribution) {
      return { debitAccount: ACC.CASH, creditAccount: ACC.PARTNERS_EQUITY };
    }
    if (isWithdrawal) {
      return { debitAccount: ACC.PARTNERS_EQUITY, creditAccount: ACC.CASH };
    }
    // Default for unknown equity sub-category: treat as contribution
    return { debitAccount: ACC.CASH, creditAccount: ACC.PARTNERS_EQUITY };
  }

  // ── Default fallback ─────────────────────────────────────────────────────
  return {
    debitAccount:  ACC.CASH,
    creditAccount: ACC.REVENUE,
  };
}

/** Exported for tests that want to verify specific account constants */
export const ACCOUNTS = ACC;
