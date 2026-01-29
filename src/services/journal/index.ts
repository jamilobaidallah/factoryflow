/**
 * Journal Entry System V2
 *
 * Unified journal posting engine with:
 * - Single entry point for all journal creation
 * - Immutable append-only ledger (reversals instead of deletes)
 * - Gapless sequence numbers (JE-000001, JE-000002, etc.)
 * - Lock date enforcement for period closing
 * - Template-based account resolution
 *
 * Usage:
 * ```typescript
 * import {
 *   JournalPostingEngine,
 *   createJournalPostingEngine,
 *   JOURNAL_TEMPLATES,
 * } from '@/services/journal';
 *
 * // Create engine instance
 * const engine = createJournalPostingEngine(user.dataOwnerId);
 *
 * // Post a journal entry
 * const result = await engine.post({
 *   templateId: 'PAYMENT_RECEIPT',
 *   amount: 1000,
 *   date: new Date(),
 *   description: 'سند قبض',
 *   source: { type: 'payment', documentId: paymentId }
 * });
 *
 * // Reverse an entry
 * const reversal = await engine.reverse(entryId, 'تصحيح');
 * ```
 */

// Types
export type {
  JournalSourceType,
  JournalSource,
  JournalReversal,
  JournalEntryV2,
  JournalEntryV2Document,
  JournalTemplateId,
  TemplateContext,
  AccountMapping,
  PostingRequest,
  PostingResult,
  ReversalResult,
  AccountingSettings,
  JournalSequenceCounter,
  JournalCursor,
  JournalQueryOptions,
} from "./types";

// Posting Engine
export {
  JournalPostingEngine,
  createJournalPostingEngine,
} from "./JournalPostingEngine";

// Templates
export {
  JOURNAL_TEMPLATES,
  getTemplate,
  resolveTemplateAccounts,
  getTemplateForLedgerEntry,
  getTemplateForPayment,
  getTemplateForDiscount,
  getTemplateForAdvance,
  getTemplateForAdvanceApplication,
  type JournalTemplate,
} from "./JournalTemplates";

// Sequence Management
export {
  getNextSequenceNumber,
  reserveSequenceBlock,
  formatEntryNumber,
  parseEntryNumber,
  getCurrentSequence,
  getNextEntryNumberPreview,
} from "./JournalSequence";

// Lock Date Management
export {
  getLockDate,
  setLockDate,
  clearLockDate,
  isDateLocked,
  validatePostingDate,
  getAccountingSettings,
  updateAccountingSettings,
  formatDateArabic,
  getMonthEnd,
  getFiscalYearEnd,
} from "./JournalLockDate";

// Query Functions
export {
  getActiveJournalEntries,
  getJournalEntries,
  getJournalEntry,
  getEntriesBySource,
  getEntriesByTransactionId,
  getReversalEntry,
  getEntriesInDateRange,
  countEntriesByStatus,
  getEntriesByLinkedTransactionId,
  getEntriesByLinkedPaymentId,
} from "./JournalQueries";
