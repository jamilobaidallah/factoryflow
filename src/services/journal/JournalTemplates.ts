/**
 * Journal Templates
 *
 * Data-driven templates for journal entry creation.
 * Each template defines how to resolve account codes for a specific transaction type.
 *
 * Templates delegate to existing account-mapping.ts functions to avoid
 * duplicating mapping logic.
 */

import {
  getAccountMappingForLedgerEntry,
  getAccountMappingForPayment,
  getAccountMappingForCOGS,
  getAccountMappingForDepreciation,
  getAccountMappingForBadDebt,
  getAccountMappingForSettlementDiscount,
  getAccountMappingForAdvance,
  getAccountMappingForAdvanceApplication,
  getAccountMappingForEndorsement,
  getAccountMappingForFixedAssetPurchase,
  getAccountMappingForLoan,
  getAccountNameAr,
  type AccountMapping,
} from "@/lib/account-mapping";
import { LOAN_CATEGORIES, LOAN_SUBCATEGORIES } from "@/components/ledger/utils/ledger-helpers";
import { ACCOUNT_CODES } from "@/types/accounting";
import type { JournalTemplateId, TemplateContext, AccountMapping as TemplateAccountMapping } from "./types";

/**
 * Convert AccountMapping from account-mapping.ts to template format
 */
function toTemplateMapping(mapping: AccountMapping): TemplateAccountMapping {
  return {
    debitAccountCode: mapping.debitAccount,
    debitAccountName: mapping.debitAccount, // Will be resolved from code
    debitAccountNameAr: mapping.debitAccountNameAr,
    creditAccountCode: mapping.creditAccount,
    creditAccountName: mapping.creditAccount, // Will be resolved from code
    creditAccountNameAr: mapping.creditAccountNameAr,
  };
}

/**
 * Journal Template definition
 */
export interface JournalTemplate {
  /** Unique template identifier */
  id: JournalTemplateId;

  /** Template name in Arabic */
  nameAr: string;

  /** Template name in English */
  nameEn: string;

  /**
   * Resolve account codes for this template
   * Returns the debit and credit accounts based on context
   */
  resolveAccounts: (context: TemplateContext) => TemplateAccountMapping;
}

/**
 * All available journal templates
 */
export const JOURNAL_TEMPLATES: Record<JournalTemplateId, JournalTemplate> = {
  /**
   * Income transaction from ledger
   * DR: AR or Cash | CR: Revenue account
   */
  LEDGER_INCOME: {
    id: "LEDGER_INCOME",
    nameAr: "قيد دخل",
    nameEn: "Income Entry",
    resolveAccounts: (ctx) =>
      toTemplateMapping(
        getAccountMappingForLedgerEntry(
          "دخل",
          ctx.category || "مبيعات",
          ctx.subCategory,
          ctx.isARAPEntry,
          ctx.immediateSettlement
        )
      ),
  },

  /**
   * Expense transaction from ledger
   * DR: Expense account | CR: AP or Cash
   */
  LEDGER_EXPENSE: {
    id: "LEDGER_EXPENSE",
    nameAr: "قيد مصروف",
    nameEn: "Expense Entry",
    resolveAccounts: (ctx) =>
      toTemplateMapping(
        getAccountMappingForLedgerEntry(
          "مصروف",
          ctx.category || "مصاريف عامة",
          ctx.subCategory,
          ctx.isARAPEntry,
          ctx.immediateSettlement
        )
      ),
  },

  /**
   * Payment receipt (customer pays us)
   * DR: Cash | CR: AR
   */
  PAYMENT_RECEIPT: {
    id: "PAYMENT_RECEIPT",
    nameAr: "سند قبض",
    nameEn: "Payment Receipt",
    resolveAccounts: () => toTemplateMapping(getAccountMappingForPayment("قبض")),
  },

  /**
   * Payment disbursement (we pay supplier)
   * DR: AP | CR: Cash
   */
  PAYMENT_DISBURSEMENT: {
    id: "PAYMENT_DISBURSEMENT",
    nameAr: "سند صرف",
    nameEn: "Payment Disbursement",
    resolveAccounts: () => toTemplateMapping(getAccountMappingForPayment("صرف")),
  },

  /**
   * Cost of Goods Sold (inventory exit)
   * DR: COGS | CR: Inventory
   */
  COGS: {
    id: "COGS",
    nameAr: "تكلفة بضاعة مباعة",
    nameEn: "Cost of Goods Sold",
    resolveAccounts: () => toTemplateMapping(getAccountMappingForCOGS()),
  },

  /**
   * Depreciation expense
   * DR: Depreciation Expense | CR: Accumulated Depreciation
   */
  DEPRECIATION: {
    id: "DEPRECIATION",
    nameAr: "إهلاك أصل ثابت",
    nameEn: "Depreciation",
    resolveAccounts: () => toTemplateMapping(getAccountMappingForDepreciation()),
  },

  /**
   * Bad debt write-off
   * DR: Bad Debt Expense | CR: AR
   */
  BAD_DEBT: {
    id: "BAD_DEBT",
    nameAr: "دين معدوم",
    nameEn: "Bad Debt Write-off",
    resolveAccounts: () => toTemplateMapping(getAccountMappingForBadDebt()),
  },

  /**
   * Sales discount (settlement discount for income)
   * DR: Sales Discount | CR: AR
   */
  SALES_DISCOUNT: {
    id: "SALES_DISCOUNT",
    nameAr: "خصم مبيعات",
    nameEn: "Sales Discount",
    resolveAccounts: () =>
      toTemplateMapping(getAccountMappingForSettlementDiscount("دخل")),
  },

  /**
   * Purchase discount (settlement discount for expense)
   * DR: AP | CR: Purchase Discount
   */
  PURCHASE_DISCOUNT: {
    id: "PURCHASE_DISCOUNT",
    nameAr: "خصم مشتريات",
    nameEn: "Purchase Discount",
    resolveAccounts: () =>
      toTemplateMapping(getAccountMappingForSettlementDiscount("مصروف")),
  },

  /**
   * Cheque endorsement
   * DR: AP | CR: AR
   */
  ENDORSEMENT: {
    id: "ENDORSEMENT",
    nameAr: "تظهير شيك",
    nameEn: "Cheque Endorsement",
    resolveAccounts: () => toTemplateMapping(getAccountMappingForEndorsement()),
  },

  /**
   * Customer advance creation
   * Cash: DR Cash | CR Customer Advances
   * Endorsement: DR AR | CR Customer Advances
   */
  CLIENT_ADVANCE: {
    id: "CLIENT_ADVANCE",
    nameAr: "سلفة عميل",
    nameEn: "Customer Advance",
    resolveAccounts: (ctx) =>
      toTemplateMapping(
        getAccountMappingForAdvance("سلفة عميل", ctx.isEndorsementAdvance)
      ),
  },

  /**
   * Supplier advance creation
   * Cash: DR Supplier Advances | CR Cash
   * Endorsement: DR Supplier Advances | CR AR
   */
  SUPPLIER_ADVANCE: {
    id: "SUPPLIER_ADVANCE",
    nameAr: "سلفة مورد",
    nameEn: "Supplier Advance",
    resolveAccounts: (ctx) =>
      toTemplateMapping(
        getAccountMappingForAdvance("سلفة مورد", ctx.isEndorsementAdvance)
      ),
  },

  /**
   * Apply customer advance to invoice (BUG FIX)
   * DR: Customer Advances | CR: AR
   *
   * This template is used when a customer advance is applied to pay an invoice.
   * Without this journal, Trial Balance would show incorrect AR and advance balances.
   */
  APPLY_CLIENT_ADVANCE: {
    id: "APPLY_CLIENT_ADVANCE",
    nameAr: "تطبيق سلفة عميل",
    nameEn: "Apply Customer Advance",
    resolveAccounts: () =>
      toTemplateMapping(getAccountMappingForAdvanceApplication("سلفة عميل")),
  },

  /**
   * Apply supplier advance to invoice (BUG FIX)
   * DR: AP | CR: Supplier Advances
   *
   * This template is used when a supplier advance is applied to pay an invoice.
   * Without this journal, Trial Balance would show incorrect AP and advance balances.
   */
  APPLY_SUPPLIER_ADVANCE: {
    id: "APPLY_SUPPLIER_ADVANCE",
    nameAr: "تطبيق سلفة مورد",
    nameEn: "Apply Supplier Advance",
    resolveAccounts: () =>
      toTemplateMapping(getAccountMappingForAdvanceApplication("سلفة مورد")),
  },

  /**
   * Fixed asset purchase (capitalized, NOT expensed)
   * DR: Fixed Assets (1400) | CR: Cash or AP
   *
   * Fixed assets are Balance Sheet items. When a business buys equipment,
   * machinery, etc., the cost is capitalized to the Fixed Assets account,
   * not expensed on the Income Statement.
   */
  FIXED_ASSET_PURCHASE: {
    id: "FIXED_ASSET_PURCHASE",
    nameAr: "شراء أصل ثابت",
    nameEn: "Fixed Asset Purchase",
    resolveAccounts: (ctx) =>
      toTemplateMapping(
        getAccountMappingForFixedAssetPurchase(ctx.immediateSettlement ?? true)
      ),
  },

  /**
   * Owner capital contribution
   * DR: Cash | CR: Owner's Capital
   */
  OWNER_CAPITAL: {
    id: "OWNER_CAPITAL",
    nameAr: "رأس مال مالك",
    nameEn: "Owner Capital",
    resolveAccounts: () => ({
      debitAccountCode: ACCOUNT_CODES.CASH,
      debitAccountName: ACCOUNT_CODES.CASH,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
      creditAccountCode: ACCOUNT_CODES.OWNER_CAPITAL,
      creditAccountName: ACCOUNT_CODES.OWNER_CAPITAL,
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.OWNER_CAPITAL),
    }),
  },

  /**
   * Owner drawings/withdrawal
   * DR: Owner's Drawings | CR: Cash
   */
  OWNER_DRAWINGS: {
    id: "OWNER_DRAWINGS",
    nameAr: "سحوبات المالك",
    nameEn: "Owner Drawings",
    resolveAccounts: () => ({
      debitAccountCode: ACCOUNT_CODES.OWNER_DRAWINGS,
      debitAccountName: ACCOUNT_CODES.OWNER_DRAWINGS,
      debitAccountNameAr: getAccountNameAr(ACCOUNT_CODES.OWNER_DRAWINGS),
      creditAccountCode: ACCOUNT_CODES.CASH,
      creditAccountName: ACCOUNT_CODES.CASH,
      creditAccountNameAr: getAccountNameAr(ACCOUNT_CODES.CASH),
    }),
  },

  /**
   * Loan given (we lend money to someone)
   * DR: Loans Receivable (asset) | CR: Cash
   */
  LOAN_GIVEN: {
    id: "LOAN_GIVEN",
    nameAr: "منح قرض",
    nameEn: "Loan Given",
    resolveAccounts: () =>
      toTemplateMapping(
        getAccountMappingForLoan(LOAN_CATEGORIES.GIVEN, LOAN_SUBCATEGORIES.LOAN_GIVEN)
      ),
  },

  /**
   * Loan collection (we collect repayment from someone we lent to)
   * DR: Cash | CR: Loans Receivable (asset decreases)
   */
  LOAN_COLLECTION: {
    id: "LOAN_COLLECTION",
    nameAr: "تحصيل قرض",
    nameEn: "Loan Collection",
    resolveAccounts: () =>
      toTemplateMapping(
        getAccountMappingForLoan(LOAN_CATEGORIES.GIVEN, LOAN_SUBCATEGORIES.LOAN_COLLECTION)
      ),
  },

  /**
   * Loan received (we borrow money from someone)
   * DR: Cash | CR: Loans Payable (liability)
   */
  LOAN_RECEIVED: {
    id: "LOAN_RECEIVED",
    nameAr: "استلام قرض",
    nameEn: "Loan Received",
    resolveAccounts: () =>
      toTemplateMapping(
        getAccountMappingForLoan(LOAN_CATEGORIES.RECEIVED, LOAN_SUBCATEGORIES.LOAN_RECEIPT)
      ),
  },

  /**
   * Loan repayment (we repay borrowed money)
   * DR: Loans Payable (liability decreases) | CR: Cash
   */
  LOAN_REPAYMENT: {
    id: "LOAN_REPAYMENT",
    nameAr: "سداد قرض",
    nameEn: "Loan Repayment",
    resolveAccounts: () =>
      toTemplateMapping(
        getAccountMappingForLoan(LOAN_CATEGORIES.RECEIVED, LOAN_SUBCATEGORIES.LOAN_REPAYMENT)
      ),
  },
};

/**
 * Get a journal template by ID
 */
export function getTemplate(templateId: JournalTemplateId): JournalTemplate {
  const template = JOURNAL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown journal template: ${templateId}`);
  }
  return template;
}

/**
 * Resolve account mapping for a template with context
 */
export function resolveTemplateAccounts(
  templateId: JournalTemplateId,
  context: TemplateContext = {}
): TemplateAccountMapping {
  const template = getTemplate(templateId);
  return template.resolveAccounts(context);
}

/**
 * Get the appropriate template ID for a ledger entry
 */
export function getTemplateForLedgerEntry(
  transactionType: "دخل" | "مصروف"
): JournalTemplateId {
  return transactionType === "دخل" ? "LEDGER_INCOME" : "LEDGER_EXPENSE";
}

/**
 * Get the appropriate template ID for a payment
 */
export function getTemplateForPayment(
  paymentType: "قبض" | "صرف"
): JournalTemplateId {
  return paymentType === "قبض" ? "PAYMENT_RECEIPT" : "PAYMENT_DISBURSEMENT";
}

/**
 * Get the appropriate template ID for a discount
 */
export function getTemplateForDiscount(
  entryType: "دخل" | "مصروف"
): JournalTemplateId {
  return entryType === "دخل" ? "SALES_DISCOUNT" : "PURCHASE_DISCOUNT";
}

/**
 * Get the appropriate template ID for an advance
 */
export function getTemplateForAdvance(
  advanceType: "سلفة عميل" | "سلفة مورد"
): JournalTemplateId {
  return advanceType === "سلفة عميل" ? "CLIENT_ADVANCE" : "SUPPLIER_ADVANCE";
}

/**
 * Get the appropriate template ID for applying an advance
 */
export function getTemplateForAdvanceApplication(
  advanceType: "سلفة عميل" | "سلفة مورد"
): JournalTemplateId {
  return advanceType === "سلفة عميل"
    ? "APPLY_CLIENT_ADVANCE"
    : "APPLY_SUPPLIER_ADVANCE";
}
