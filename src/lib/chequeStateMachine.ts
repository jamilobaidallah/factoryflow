/**
 * Cheque State Machine
 *
 * Validates cheque state transitions to prevent invalid operations.
 * Cheques follow a simple state machine with the following valid transitions:
 *
 *   PENDING → CASHED | ENDORSED | BOUNCED | DELETED
 *   CASHED → BOUNCED
 *   ENDORSED → (terminal state - no transitions allowed)
 *   BOUNCED → (terminal state - no transitions allowed)
 *
 * This ensures business rules are enforced:
 * - A cashed cheque cannot be endorsed (money already received)
 * - A bounced cheque cannot be cashed again (bank rejected it)
 * - An endorsed cheque cannot be modified (transferred to another party)
 */

import { CHEQUE_STATUS_AR } from "./constants";

// Type alias for cheque status values
export type ChequeStatusValue = (typeof CHEQUE_STATUS_AR)[keyof typeof CHEQUE_STATUS_AR];

// Special pseudo-state for deletion
const DELETED = "__DELETED__" as const;
type DeletedState = typeof DELETED;

// All possible target states (including deletion)
type TargetState = ChequeStatusValue | DeletedState;

/**
 * Valid state transitions map
 * Key: current status
 * Value: array of statuses the cheque can transition to
 */
const VALID_TRANSITIONS: Record<ChequeStatusValue, TargetState[]> = {
  // PENDING can transition to: CASHED, ENDORSED, BOUNCED, or be DELETED
  [CHEQUE_STATUS_AR.PENDING]: [
    CHEQUE_STATUS_AR.CASHED,
    CHEQUE_STATUS_AR.ENDORSED,
    CHEQUE_STATUS_AR.BOUNCED,
    CHEQUE_STATUS_AR.RETURNED,
    CHEQUE_STATUS_AR.CANCELLED,
    DELETED,
  ],

  // CASHED can only transition to: BOUNCED (cheque bounced after cashing)
  [CHEQUE_STATUS_AR.CASHED]: [
    CHEQUE_STATUS_AR.BOUNCED,
    CHEQUE_STATUS_AR.RETURNED,
    CHEQUE_STATUS_AR.PENDING, // Allow reversal back to pending
  ],

  // ENDORSED is a terminal state (cheque transferred to another party)
  [CHEQUE_STATUS_AR.ENDORSED]: [],

  // BOUNCED is a terminal state (bank rejected the cheque)
  [CHEQUE_STATUS_AR.BOUNCED]: [],

  // RETURNED is a terminal state (similar to bounced)
  [CHEQUE_STATUS_AR.RETURNED]: [],

  // COLLECTED is similar to CASHED
  [CHEQUE_STATUS_AR.COLLECTED]: [
    CHEQUE_STATUS_AR.BOUNCED,
    CHEQUE_STATUS_AR.RETURNED,
  ],

  // CANCELLED is a terminal state
  [CHEQUE_STATUS_AR.CANCELLED]: [],
};

/**
 * Human-readable status names for error messages (Arabic)
 */
const STATUS_NAMES: Record<ChequeStatusValue | DeletedState, string> = {
  [CHEQUE_STATUS_AR.PENDING]: "قيد الانتظار",
  [CHEQUE_STATUS_AR.CASHED]: "تم الصرف",
  [CHEQUE_STATUS_AR.ENDORSED]: "مجيّر",
  [CHEQUE_STATUS_AR.BOUNCED]: "مرفوض",
  [CHEQUE_STATUS_AR.RETURNED]: "مرتجع",
  [CHEQUE_STATUS_AR.COLLECTED]: "محصل",
  [CHEQUE_STATUS_AR.CANCELLED]: "ملغي",
  [DELETED]: "محذوف",
};

/**
 * Check if a cheque can transition from one status to another
 *
 * @param fromStatus - Current cheque status
 * @param toStatus - Target cheque status
 * @returns true if the transition is valid, false otherwise
 *
 * @example
 * canTransition(CHEQUE_STATUS_AR.PENDING, CHEQUE_STATUS_AR.CASHED) // true
 * canTransition(CHEQUE_STATUS_AR.CASHED, CHEQUE_STATUS_AR.ENDORSED) // false
 */
export function canTransition(
  fromStatus: ChequeStatusValue,
  toStatus: ChequeStatusValue
): boolean {
  const validTargets = VALID_TRANSITIONS[fromStatus];
  if (!validTargets) {
    return false;
  }
  return validTargets.includes(toStatus);
}

/**
 * Check if a cheque can be deleted based on its current status
 *
 * @param currentStatus - Current cheque status
 * @returns true if the cheque can be deleted, false otherwise
 *
 * @example
 * canDelete(CHEQUE_STATUS_AR.PENDING) // true
 * canDelete(CHEQUE_STATUS_AR.ENDORSED) // false
 */
export function canDelete(currentStatus: ChequeStatusValue): boolean {
  const validTargets = VALID_TRANSITIONS[currentStatus];
  if (!validTargets) {
    return false;
  }
  return validTargets.includes(DELETED);
}

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidChequeTransitionError extends Error {
  public readonly fromStatus: ChequeStatusValue;
  public readonly toStatus: ChequeStatusValue | DeletedState;

  constructor(
    fromStatus: ChequeStatusValue,
    toStatus: ChequeStatusValue | DeletedState
  ) {
    const fromName = STATUS_NAMES[fromStatus] || fromStatus;
    const toName = STATUS_NAMES[toStatus] || toStatus;
    const message = `لا يمكن تغيير حالة الشيك من "${fromName}" إلى "${toName}"`;

    super(message);
    this.name = "InvalidChequeTransitionError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * Validate a cheque state transition and throw if invalid
 *
 * Use this at the start of cheque operations to fail fast with a clear error.
 *
 * @param fromStatus - Current cheque status
 * @param toStatus - Target cheque status
 * @throws InvalidChequeTransitionError if the transition is not allowed
 *
 * @example
 * // At the start of cashCheque():
 * validateTransition(cheque.status, CHEQUE_STATUS_AR.CASHED);
 * // Proceeds if valid, throws clear error if not
 */
export function validateTransition(
  fromStatus: ChequeStatusValue,
  toStatus: ChequeStatusValue
): void {
  if (!canTransition(fromStatus, toStatus)) {
    throw new InvalidChequeTransitionError(fromStatus, toStatus);
  }
}

/**
 * Validate that a cheque can be deleted and throw if not allowed
 *
 * @param currentStatus - Current cheque status
 * @throws InvalidChequeTransitionError if deletion is not allowed
 *
 * @example
 * // At the start of deleteCheque():
 * validateDeletion(cheque.status);
 */
export function validateDeletion(currentStatus: ChequeStatusValue): void {
  if (!canDelete(currentStatus)) {
    throw new InvalidChequeTransitionError(currentStatus, DELETED);
  }
}

/**
 * Get the list of valid target states from a given status
 *
 * Useful for UI to show available actions.
 *
 * @param currentStatus - Current cheque status
 * @returns Array of valid target statuses (excluding DELETED pseudo-state)
 */
export function getValidTransitions(
  currentStatus: ChequeStatusValue
): ChequeStatusValue[] {
  const validTargets = VALID_TRANSITIONS[currentStatus] || [];
  return validTargets.filter((s) => s !== DELETED) as ChequeStatusValue[];
}
