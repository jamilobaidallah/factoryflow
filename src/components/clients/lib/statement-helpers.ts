import type { Cheque } from '../hooks';

/**
 * Filter pending cheques, excluding endorsed cheques
 * Endorsed cheques are already accounted for in the statement as endorsement payments
 * Including them would double-count the amount
 */
export function filterPendingCheques(cheques: Cheque[]): Cheque[] {
  return cheques.filter(c => c.status === "قيد الانتظار" && !c.isEndorsedCheque);
}

/**
 * Calculate expected balance after pending cheques clear
 * - Incoming (وارد): We receive money → reduces what they owe us
 * - Outgoing (صادر): We pay money → reduces what we owe them
 */
export function calculateBalanceAfterCheques(
  currentBalance: number,
  pendingCheques: Cheque[]
): { incomingTotal: number; outgoingTotal: number; balanceAfterCheques: number } {
  const incomingTotal = pendingCheques
    .filter(c => c.type === "وارد")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const outgoingTotal = pendingCheques
    .filter(c => c.type === "صادر")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const balanceAfterCheques = currentBalance - incomingTotal + outgoingTotal;

  return { incomingTotal, outgoingTotal, balanceAfterCheques };
}
