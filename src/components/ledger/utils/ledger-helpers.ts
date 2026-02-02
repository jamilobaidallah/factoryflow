import { CATEGORIES } from "./ledger-constants";
import { TRANSACTION_TYPES, PAYMENT_STATUSES, PAYMENT_STATUS_AR } from "@/lib/constants";
import type { JournalTemplateId } from "@/services/journal/types";

// Re-export for convenience
export { TRANSACTION_TYPES, PAYMENT_STATUSES, PAYMENT_STATUS_AR };

/**
 * Loan category constants - Single source of truth for loan-related values
 */
export const LOAN_CATEGORIES = {
    RECEIVED: "قروض مستلمة",     // Liability - money borrowed
    GIVEN: "قروض ممنوحة",        // Asset - money lent
} as const;

export const LOAN_SUBCATEGORIES = {
    // Loans Received (Liability)
    LOAN_RECEIPT: "استلام قرض",      // Creates liability, cash IN
    LOAN_REPAYMENT: "سداد قرض",       // Reduces liability, cash OUT
    // Loans Given (Asset)
    LOAN_GIVEN: "منح قرض",           // Creates asset, cash OUT
    LOAN_COLLECTION: "تحصيل قرض",    // Reduces asset, cash IN
} as const;

/**
 * Equity subcategory constants
 */
export const EQUITY_SUBCATEGORIES = {
    CAPITAL_IN: "رأس مال مالك",      // Cash IN - increases equity
    DRAWINGS_OUT: "سحوبات المالك",    // Cash OUT - decreases equity
} as const;

/**
 * Fixed asset category constant
 * Fixed assets are capitalized to Balance Sheet (CapEx), NOT expensed on P&L (OpEx)
 */
export const FIXED_ASSET_CATEGORY = "أصول ثابتة" as const;

/**
 * Helper function to get category type
 * Uses CATEGORIES from ledger-constants.ts as single source of truth
 * Returns: "دخل" (income), "مصروف" (expense), "حركة رأس مال" (equity), or "قرض" (loan)
 */
export function getCategoryType(categoryName: string, _subCategory?: string): string {
    const category = CATEGORIES.find(cat => cat.name === categoryName);
    return category?.type || "دخل";
}

/**
 * Helper function to check if a transaction type is equity
 * Handles both new type and backward compatibility with old data
 *
 * Equity transactions (capital contributions, owner drawings) affect cash
 * balance but NOT profit/loss calculations. They are:
 * - NOT counted in P&L (Income Statement)
 * - Counted in Cash Flow (Financing Activities)
 * - NOT tracked as AR/AP (no payment status)
 *
 * @param type - Transaction type ("دخل", "مصروف", "حركة رأس مال")
 * @param category - Transaction category name
 * @returns true if this is an equity transaction
 */
export function isEquityTransaction(type?: string, category?: string): boolean {
    return type === "حركة رأس مال" ||
           category === "رأس المال" ||
           category === "Owner Equity";
}

/**
 * Helper function to check if a transaction is an advance (prepaid credit)
 * Advances are NOT counted in P&L - they represent prepaid credits, not income/expense
 *
 * - سلفة مورد (Supplier Advance): We paid supplier more than owed, they owe us
 * - سلفة عميل (Client Advance): Client paid us more than owed, we owe them
 *
 * @param category - Transaction category name
 * @returns true if this is an advance transaction
 */
export function isAdvanceTransaction(category?: string): boolean {
    return category === "سلفة مورد" || category === "سلفة عميل";
}

/**
 * Helper function to check if a transaction is a loan transaction
 * Loan transactions are NOT counted in P&L - they are balance sheet items
 *
 * - قروض مستلمة (Loans Received): Liability - money we borrowed
 * - قروض ممنوحة (Loans Given): Asset - money we lent
 *
 * @param type - Transaction type ("قرض" for loans)
 * @param category - Transaction category name
 * @returns true if this is a loan transaction
 */
export function isLoanTransaction(type?: string, category?: string): boolean {
    return type === "قرض" ||
           category === LOAN_CATEGORIES.RECEIVED ||
           category === LOAN_CATEGORIES.GIVEN;
}

/**
 * Get loan type: receivable (asset) or payable (liability)
 * @param category - Loan category
 * @returns "receivable" for loans given, "payable" for loans received, null if not a loan
 */
export function getLoanType(category?: string): "receivable" | "payable" | null {
    if (category === LOAN_CATEGORIES.GIVEN) return "receivable";
    if (category === LOAN_CATEGORIES.RECEIVED) return "payable";
    return null;
}

/**
 * Check if this is an initial loan transaction (creates the loan)
 * vs a repayment/collection (reduces the loan)
 * @param subCategory - The loan subcategory
 * @returns true if this creates a new loan
 */
export function isInitialLoan(subCategory?: string): boolean {
    return subCategory === LOAN_SUBCATEGORIES.LOAN_RECEIPT ||
           subCategory === LOAN_SUBCATEGORIES.LOAN_GIVEN;
}

/**
 * Check if this is a loan repayment/collection transaction
 * @param subCategory - The loan subcategory
 * @returns true if this reduces an existing loan
 */
export function isLoanRepayment(subCategory?: string): boolean {
    return subCategory === LOAN_SUBCATEGORIES.LOAN_REPAYMENT ||
           subCategory === LOAN_SUBCATEGORIES.LOAN_COLLECTION;
}

/**
 * Determine cash flow direction for loan transactions
 * @param subCategory - The loan subcategory
 * @returns "in" for cash received, "out" for cash paid, null if not a loan subcategory
 */
export function getLoanCashDirection(subCategory?: string): "in" | "out" | null {
    // Cash IN: receiving a loan, or collecting loan repayment from someone
    if (subCategory === LOAN_SUBCATEGORIES.LOAN_RECEIPT ||
        subCategory === LOAN_SUBCATEGORIES.LOAN_COLLECTION) {
        return "in";
    }
    // Cash OUT: giving a loan, or repaying a loan we owe
    if (subCategory === LOAN_SUBCATEGORIES.LOAN_GIVEN ||
        subCategory === LOAN_SUBCATEGORIES.LOAN_REPAYMENT) {
        return "out";
    }
    return null;
}

/**
 * Helper function to check if a transaction is a fixed asset purchase
 * Fixed assets are Balance Sheet items (CapEx), NOT Income Statement expenses (OpEx)
 *
 * Note: This only checks the category. Depreciation expense uses category "مصاريف تشغيلية"
 * with subCategory "استهلاك أصول ثابتة", so depreciation is correctly included in P&L.
 *
 * @param category - Transaction category name
 * @returns true if this is a fixed asset purchase transaction
 */
export function isFixedAssetTransaction(category?: string): boolean {
    return category === FIXED_ASSET_CATEGORY;
}

/**
 * Helper function to check if a transaction should be excluded from P&L
 * Combines equity, advance, loan, and fixed asset checks
 *
 * Excluded transactions are Balance Sheet items, not Income Statement items:
 * - Equity: Capital contributions and owner drawings
 * - Advances: Customer and supplier prepayments
 * - Loans: Money borrowed or lent
 * - Fixed Assets: Capital expenditures (CapEx) - depreciated over time instead
 *
 * @param type - Transaction type
 * @param category - Transaction category name
 * @returns true if this transaction should be excluded from P&L
 */
export function isExcludedFromPL(type?: string, category?: string): boolean {
    return isEquityTransaction(type, category) ||
           isAdvanceTransaction(category) ||
           isLoanTransaction(type, category) ||
           isFixedAssetTransaction(category);
}

/**
 * Helper function to check if a transaction type is income
 * Handles both "دخل" and "إيراد" variants
 *
 * @param type - Transaction type
 * @returns true if this is an income transaction
 */
export function isIncomeType(type?: string): boolean {
    return type === TRANSACTION_TYPES.INCOME || type === TRANSACTION_TYPES.INCOME_ALT;
}

/**
 * Helper function to check if a transaction type is expense
 *
 * @param type - Transaction type
 * @returns true if this is an expense transaction
 */
export function isExpenseType(type?: string): boolean {
    return type === TRANSACTION_TYPES.EXPENSE;
}

/**
 * Helper function to check if a payment status indicates fully paid
 * Handles both English and Arabic status values
 *
 * @param status - Payment status
 * @returns true if the payment is fully paid
 */
export function isPaidStatus(status?: string): boolean {
    return status === PAYMENT_STATUSES.PAID ||
           status === PAYMENT_STATUS_AR.PAID ||
           status === PAYMENT_STATUS_AR.PAID_ALT;
}

/**
 * Helper function to check if a subcategory represents capital contribution (cash IN)
 * @param subCategory - The equity subcategory
 * @returns true if this is a capital contribution (increases equity)
 */
export function isCapitalContribution(subCategory?: string): boolean {
    return subCategory === "رأس مال مالك";
}

/**
 * Helper function to check if a subcategory represents owner drawing (cash OUT)
 * @param subCategory - The equity subcategory
 * @returns true if this is an owner drawing (decreases equity)
 */
export function isOwnerDrawing(subCategory?: string): boolean {
    return subCategory === "سحوبات المالك";
}

/**
 * Helper function to generate unique transaction ID
 * Format: TXN-YYYYMMDD-HHMMSS-RRR
 */
export function generateTransactionId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

    return `TXN-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

/**
 * Determine the correct journal template ID for a transaction
 *
 * This centralizes template selection logic to avoid duplication and ensure
 * consistent handling of special transaction types (equity, loans, fixed assets).
 *
 * @param entryType - Transaction type from getCategoryType()
 * @param category - Transaction category
 * @param subCategory - Transaction subcategory
 * @returns The appropriate JournalTemplateId
 */
export function getJournalTemplateForTransaction(
    entryType: string,
    category?: string,
    subCategory?: string
): JournalTemplateId {
    // 1. Check for equity/capital transactions
    if (isEquityTransaction(entryType, category)) {
        if (isOwnerDrawing(subCategory)) {
            return "OWNER_DRAWINGS";
        }
        // Default to capital contribution for equity transactions
        return "OWNER_CAPITAL";
    }

    // 2. Check for loan transactions
    if (isLoanTransaction(entryType, category)) {
        // Explicit validation - prevent unknown categories from being silently misclassified
        if (category !== LOAN_CATEGORIES.GIVEN && category !== LOAN_CATEGORIES.RECEIVED) {
            throw new Error(`Unknown loan category: ${category}`);
        }

        const isGivenLoan = category === LOAN_CATEGORIES.GIVEN;
        const isInitial = isInitialLoan(subCategory);

        if (isGivenLoan) {
            return isInitial ? "LOAN_GIVEN" : "LOAN_COLLECTION";
        } else {
            return isInitial ? "LOAN_RECEIVED" : "LOAN_REPAYMENT";
        }
    }

    // 3. Check for fixed asset purchases
    if (isFixedAssetTransaction(category)) {
        return "FIXED_ASSET_PURCHASE";
    }

    // 4. Default to income/expense templates
    return entryType === "دخل" ? "LEDGER_INCOME" : "LEDGER_EXPENSE";
}

/**
 * Determine the correct payment type for a transaction
 *
 * This handles the cash flow direction for all transaction types:
 * - Income: RECEIPT (cash IN)
 * - Expense: DISBURSEMENT (cash OUT)
 * - Capital IN: RECEIPT (cash IN from owner)
 * - Drawings OUT: DISBURSEMENT (cash OUT to owner)
 * - Loans: depends on subcategory (giving vs receiving)
 *
 * @param entryType - Transaction type
 * @param category - Transaction category
 * @param subCategory - Transaction subcategory
 * @returns "قبض" (RECEIPT) or "صرف" (DISBURSEMENT)
 */
export function getPaymentTypeForTransaction(
    entryType: string,
    category?: string,
    subCategory?: string
): string {
    const RECEIPT = "قبض";
    const DISBURSEMENT = "صرف";

    // 1. Income is always cash IN
    if (entryType === "دخل") {
        return RECEIPT;
    }

    // 2. Equity/Capital transactions
    if (isEquityTransaction(entryType, category)) {
        // Capital contribution = cash IN, Drawings = cash OUT
        return isCapitalContribution(subCategory) ? RECEIPT : DISBURSEMENT;
    }

    // 3. Loan transactions - use existing helper for cash direction
    if (isLoanTransaction(entryType, category)) {
        const cashDirection = getLoanCashDirection(subCategory);
        return cashDirection === "in" ? RECEIPT : DISBURSEMENT;
    }

    // 4. Default: expenses and fixed assets are cash OUT
    return DISBURSEMENT;
}
