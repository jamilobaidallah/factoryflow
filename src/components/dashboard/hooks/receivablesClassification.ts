/**
 * Pure classification helpers for dashboard receivables/payables alerts.
 *
 * Extracted from useReceivablesAlerts so they can be unit-tested without
 * pulling in the Firebase-coupled hook.
 *
 * IMPORTANT — advances run OPPOSITE to trade invoices:
 *   - سلفة مورد (supplier advance): money we prepaid the supplier. The supplier owes
 *     us goods/services → an ASSET → counts as a RECEIVABLE (owed TO us), even though
 *     it is stored with expense type.
 *   - سلفة عميل (customer advance): money the customer prepaid us. We owe them
 *     goods/services → a LIABILITY → counts as a PAYABLE (owed BY us), even though it
 *     is stored with income type.
 *
 * Loans behave the same way (type "قرض", so not caught by income/expense checks):
 *   - قروض ممنوحة (loan given): an ASSET → RECEIVABLE.
 *   - قروض مستلمة (loan received): a LIABILITY → PAYABLE.
 * Only the initial loan entry is counted — repayments/collections are separate netting
 * entries (see lib/client-balance.ts).
 *
 * Direction comes from getAdvanceType / getLoanType; see
 * services/ledger/handlers/advanceHandlers.ts and lib/client-balance.ts.
 */

import { INCOME_TYPES, EXPENSE_TYPE } from "../constants/dashboard.constants";
import {
  getAdvanceType,
  getLoanType,
  isInitialLoan,
} from "@/components/ledger/utils/ledger-helpers";

/** Outstanding payment statuses */
export const OUTSTANDING_STATUSES = ["unpaid", "partial"] as const;

/**
 * Classify an entry as an outstanding receivable, payable, or neither.
 * Advances override the income/expense-based direction (they run the opposite way).
 */
export function classifyOutstanding(
  data: Record<string, unknown>
): "receivable" | "payable" | null {
  // Must have an outstanding balance to count.
  const hasOutstandingStatus = OUTSTANDING_STATUSES.includes(
    data.paymentStatus as typeof OUTSTANDING_STATUSES[number]
  );
  if (!hasOutstandingStatus) {
    return null;
  }

  // Must be an AR/AP entry. Truthy check for compatibility; entries with a
  // paymentStatus are AR/AP even if the legacy isARAPEntry flag is missing.
  const isARAPEntry = Boolean(data.isARAPEntry);
  const hasPaymentTracking = data.paymentStatus !== undefined;
  if (!isARAPEntry && !hasPaymentTracking) {
    return null;
  }

  // Advances run opposite to their income/expense type, so they decide direction first.
  const advanceType = getAdvanceType(data.category as string | undefined);
  if (advanceType) {
    return advanceType;
  }

  // Loans (type "قرض", so not caught by the income/expense checks below):
  // - قروض ممنوحة (loan given): money we lent → asset → receivable.
  // - قروض مستلمة (loan received): money we borrowed → liability → payable.
  // Only the INITIAL loan entry carries the obligation. Collection/repayment entries
  // (تحصيل قرض / سداد قرض) are separate entries that net the balance down
  // (see lib/client-balance.ts), so they must NOT be counted as new obligations.
  const loanType = getLoanType(data.category as string | undefined);
  if (loanType) {
    return isInitialLoan(data.subCategory as string | undefined) ? loanType : null;
  }

  // Trade invoices: income → receivable, expense → payable.
  if (INCOME_TYPES.some((type) => data.type === type)) {
    return "receivable";
  }
  if (data.type === EXPENSE_TYPE) {
    return "payable";
  }
  return null;
}

/** Check if entry is an outstanding receivable (value owed TO us) */
export function isOutstandingReceivable(data: Record<string, unknown>): boolean {
  return classifyOutstanding(data) === "receivable";
}

/** Check if entry is an outstanding payable (value owed BY us) */
export function isOutstandingPayable(data: Record<string, unknown>): boolean {
  return classifyOutstanding(data) === "payable";
}

/** Get the outstanding amount for an entry */
export function getOutstandingAmount(data: Record<string, unknown>): number {
  // For partial payments, remainingBalance is accurate
  if (typeof data.remainingBalance === "number" && data.remainingBalance > 0) {
    return data.remainingBalance;
  }

  // For unpaid entries without remainingBalance, use amount
  if (data.paymentStatus === "unpaid" && typeof data.amount === "number") {
    return data.amount;
  }

  return 0;
}
