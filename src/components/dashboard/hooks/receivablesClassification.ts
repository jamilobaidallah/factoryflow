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

import { getArapDirection } from "@/components/ledger/utils/ledger-helpers";

/** Outstanding payment statuses */
export const OUTSTANDING_STATUSES = ["unpaid", "partial"] as const;

/**
 * Classify an entry as an outstanding receivable, payable, or neither.
 *
 * Gates on outstanding status + AR/AP tracking, then delegates direction to the
 * shared getArapDirection (advances flip sides, only initial loans count). Keeping
 * direction in one helper means the dashboard cards and the ledger filter agree.
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

  return getArapDirection(
    data.type as string | undefined,
    data.category as string | undefined,
    data.subCategory as string | undefined
  );
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
