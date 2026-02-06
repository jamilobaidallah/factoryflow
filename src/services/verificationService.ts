/**
 * Data Integrity Verification Service
 *
 * Verifies that every ledger entry has corresponding balanced journal entries.
 * Uses load-once, index-in-memory pattern for O(1) lookups instead of O(n) queries.
 */

import { createLedgerService } from '@/services/ledger';
import { getEntriesInDateRange, type JournalEntryV2 } from '@/services/journal';
import { getTrialBalance } from '@/services/journalService';

// ============================================================================
// TYPES
// ============================================================================

export type DiscrepancyType =
  | 'missing_journal'      // Ledger entry has no journal
  | 'unbalanced_journal'   // Debits ≠ Credits
  | 'orphan_journal'       // Journal with no ledger entry
  | 'wrong_status';        // Journal not posted

export interface Discrepancy {
  type: DiscrepancyType;
  severity: 'warning' | 'error';
  transactionId?: string;
  journalId?: string;
  ledgerDescription?: string;
  expected?: number;
  actual?: number;
  message: string;
}

export type VerificationPhase =
  | { phase: 'idle' }
  | { phase: 'loading'; message: string }
  | { phase: 'indexing'; message: string }
  | { phase: 'verifying'; current: number; total: number }
  | { phase: 'complete'; result: VerificationResult };

export interface VerificationResult {
  timestamp: Date;
  ledgerEntriesChecked: number;
  journalEntriesChecked: number;
  discrepanciesFound: number;
  discrepancies: Discrepancy[];
  trialBalanceStatus: {
    isBalanced: boolean;
    totalDebits: number;
    totalCredits: number;
    difference: number;
  };
  queryLimitReached: boolean;
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

/**
 * Verify data integrity between ledger entries and journal entries.
 *
 * Checks:
 * 1. Every ledger entry has a corresponding journal entry
 * 2. All journal entries are balanced (debits = credits)
 * 3. All journal entries have status 'posted'
 * 4. No orphan journals exist (journals without ledger entries)
 *
 * @param userId - The user/dataOwner ID
 * @param onProgress - Optional callback for progress updates
 */
export async function verifyDataIntegrity(
  userId: string,
  onProgress?: (phase: VerificationPhase) => void
): Promise<VerificationResult> {
  // Step 1: Load all data (reuse existing functions)
  onProgress?.({ phase: 'loading', message: 'جارٍ تحميل القيود...' });

  const ledgerService = createLedgerService(userId);
  const ledgerEntries = await ledgerService.getAllLedgerEntries();

  // Calculate date range from ledger entries (dynamic, not hardcoded to current year)
  // This ensures we load journals for ALL ledger entries, regardless of when they were created
  let minDate = new Date();
  let maxDate = new Date();

  if (ledgerEntries.length > 0) {
    const dates = ledgerEntries.map(e => e.date instanceof Date ? e.date : new Date(e.date));
    minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    // Extend range by 1 day on each side to handle timezone edge cases
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);
  }

  // Note: getEntriesInDateRange defaults onlyActive=true, so only 'posted' journals are returned
  // We pass false to also check for non-posted journals
  const journalEntries = await getEntriesInDateRange(userId, minDate, maxDate, false);

  // Step 2: Build indexes (index by BOTH V1 and V2 fields for safety)
  onProgress?.({ phase: 'indexing', message: 'جارٍ فهرسة البيانات...' });

  const journalsByTxn = new Map<string, JournalEntryV2[]>();

  const addToIndex = (txnId: string, journal: JournalEntryV2) => {
    const existing = journalsByTxn.get(txnId) || [];
    // Avoid duplicates if both fields point to same ID
    if (!existing.some(j => j.id === journal.id)) {
      journalsByTxn.set(txnId, [...existing, journal]);
    }
  };

  for (const journal of journalEntries) {
    // Index by V1 field (linkedTransactionId) - legacy journals
    if (journal.linkedTransactionId) {
      addToIndex(journal.linkedTransactionId, journal);
    }
    // Index by V2 field (source.transactionId) - may be same value, that's fine
    if (journal.source?.transactionId) {
      addToIndex(journal.source.transactionId, journal);
    }
  }

  // Step 3: Verify each ledger entry
  const discrepancies: Discrepancy[] = [];

  for (let i = 0; i < ledgerEntries.length; i++) {
    if (i % 100 === 0) {
      onProgress?.({ phase: 'verifying', current: i + 1, total: ledgerEntries.length });
    }

    const entry = ledgerEntries[i];
    const journals = journalsByTxn.get(entry.transactionId) || [];

    // Check 1: Journal exists
    if (journals.length === 0) {
      discrepancies.push({
        type: 'missing_journal',
        severity: 'error',
        transactionId: entry.transactionId,
        ledgerDescription: entry.description,
        message: `قيد محاسبي مفقود للمعاملة: ${entry.description}`,
      });
      continue;
    }

    // Check 2: Journal is balanced and status is correct
    for (const journal of journals) {
      const totalDebit = journal.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = journal.lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        discrepancies.push({
          type: 'unbalanced_journal',
          severity: 'error',
          journalId: journal.id,
          transactionId: entry.transactionId,
          expected: totalDebit,
          actual: totalCredit,
          message: `قيد غير متوازن: مدين ${totalDebit.toFixed(2)} ≠ دائن ${totalCredit.toFixed(2)}`,
        });
      }

      // Check 3: Status is posted
      if (journal.status !== 'posted') {
        discrepancies.push({
          type: 'wrong_status',
          severity: 'warning',
          journalId: journal.id,
          transactionId: entry.transactionId,
          message: `قيد بحالة "${journal.status}" بدلاً من "posted"`,
        });
      }
    }
  }

  // Check 4: Orphan journals (journals with no ledger entry)
  onProgress?.({ phase: 'verifying', current: ledgerEntries.length, total: ledgerEntries.length });

  const ledgerTxnIds = new Set(ledgerEntries.map(e => e.transactionId));
  for (const journal of journalEntries) {
    const v1Id = journal.linkedTransactionId;
    const v2Id = journal.source?.transactionId;

    // Check if at least one of the IDs matches a ledger entry
    const hasMatchingLedger =
      (v1Id && ledgerTxnIds.has(v1Id)) ||
      (v2Id && ledgerTxnIds.has(v2Id));

    // Only flag as orphan if neither ID matches AND at least one ID exists
    if ((v1Id || v2Id) && !hasMatchingLedger) {
      discrepancies.push({
        type: 'orphan_journal',
        severity: 'warning',
        journalId: journal.id,
        transactionId: v1Id || v2Id || '',
        message: `قيد يومية بدون معاملة مرتبطة`,
      });
    }
  }

  // Step 4: Get trial balance status
  const trialBalance = await getTrialBalance(userId);

  return {
    timestamp: new Date(),
    ledgerEntriesChecked: ledgerEntries.length,
    journalEntriesChecked: journalEntries.length,
    discrepanciesFound: discrepancies.length,
    discrepancies,
    trialBalanceStatus: {
      isBalanced: trialBalance.data?.isBalanced ?? false,
      totalDebits: trialBalance.data?.totalDebits ?? 0,
      totalCredits: trialBalance.data?.totalCredits ?? 0,
      difference: trialBalance.data?.difference ?? 0,
    },
    queryLimitReached: ledgerEntries.length >= 10000,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Arabic label for discrepancy type
 */
export function getDiscrepancyTypeLabel(type: DiscrepancyType): string {
  switch (type) {
    case 'missing_journal': return 'قيد مفقود';
    case 'unbalanced_journal': return 'قيد غير متوازن';
    case 'orphan_journal': return 'قيد يتيم';
    case 'wrong_status': return 'حالة خاطئة';
  }
}
