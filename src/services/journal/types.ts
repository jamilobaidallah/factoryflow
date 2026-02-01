/**
 * Journal Entry System V2 - Types
 *
 * New immutable ledger design with:
 * - Gapless sequence numbers
 * - Reversal-based corrections (no deletes)
 * - Unified source linking
 * - Lock date enforcement
 */

import type { JournalLine } from "@/types/accounting";

/**
 * Source types for journal entries
 * Identifies what triggered the journal creation
 */
export type JournalSourceType =
  | "ledger" // Main transaction journal
  | "payment" // Payment receipt/disbursement
  | "cheque_cash" // Cheque cashing
  | "endorsement" // Cheque endorsement
  | "inventory" // Inventory/COGS
  | "depreciation" // Asset depreciation
  | "bad_debt" // Bad debt write-off
  | "discount" // Settlement discount
  | "advance_application" // Applying advance to invoice
  | "advance_client" // Client advance creation
  | "advance_supplier" // Supplier advance creation
  | "manual"; // Manual journal entry

/**
 * Source information for tracking journal origin
 */
export interface JournalSource {
  /** Type of source document */
  type: JournalSourceType;

  /** Primary document ID (payment.id, cheque.id for endorsements, etc.) */
  documentId: string;

  /** Ledger transactionId - CRITICAL for update/delete queries */
  transactionId?: string;

  /** For cheque-related operations (cashing, endorsement advances) */
  chequeId?: string;
}

/**
 * Reversal information for journal entries
 */
export interface JournalReversal {
  /** True if this entry is a reversal of another entry */
  isReversal: boolean;

  /** ID of the entry this reverses (only if isReversal=true) */
  reversesEntryId?: string;

  /** ID of the entry that reversed this one (only if status='reversed') */
  reversedByEntryId?: string;

  /** When this entry was reversed */
  reversedAt?: Date;

  /** Reason for the reversal */
  reason?: string;

  /**
   * Type of reversal:
   * - 'void': Original entry was wrong (data entry error)
   * - 'correction': Legitimate business reversal (bounced cheque, cancelled sale)
   */
  reversalType?: "void" | "correction";
}

/**
 * Journal Entry V2 - Immutable ledger design
 *
 * Key differences from V1:
 * - Gapless sequenceNumber (1, 2, 3...)
 * - status: only 'posted' or 'reversed' (no 'draft')
 * - source: unified linking to all document types
 * - reversal: bidirectional linking for reversals
 */
export interface JournalEntryV2 {
  /** Firestore document ID */
  id: string;

  /** Gapless sequence number (1, 2, 3...) */
  sequenceNumber: number;

  /** Formatted entry number (JE-000001) */
  entryNumber: string;

  /** Entry date */
  date: Date;

  /** Description in Arabic */
  description: string;

  /** Journal lines (debits and credits) */
  lines: JournalLine[];

  /**
   * Entry status:
   * - 'posted': Active entry, included in reports
   * - 'reversed': Entry has been reversed, excluded from reports
   */
  status: "posted" | "reversed";

  /** Source document information */
  source: JournalSource;

  /** Reversal information (if applicable) */
  reversal?: JournalReversal;

  /** Audit fields */
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;

  // ============================================
  // Legacy fields for backward compatibility
  // These map to the source field internally
  // ============================================

  /** @deprecated Use source.transactionId */
  linkedTransactionId?: string;

  /** @deprecated Use source.documentId for payments */
  linkedPaymentId?: string;

  /** @deprecated Use source.type */
  linkedDocumentType?:
    | "ledger"
    | "payment"
    | "cheque"
    | "depreciation"
    | "inventory"
    | "endorsement";
}

/**
 * Firestore document format for JournalEntryV2
 * Dates are stored as Firestore Timestamps
 */
export interface JournalEntryV2Document {
  sequenceNumber: number;
  entryNumber: string;
  date: Date;
  description: string;
  lines: JournalLine[];
  totalDebits: number;
  totalCredits: number;
  status: "posted" | "reversed";
  source: JournalSource;
  reversal?: JournalReversal;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;

  // Legacy fields
  linkedTransactionId?: string;
  linkedPaymentId?: string;
  linkedDocumentType?: string;
}

/**
 * Template IDs for journal posting
 */
export type JournalTemplateId =
  | "LEDGER_INCOME"
  | "LEDGER_EXPENSE"
  | "PAYMENT_RECEIPT"
  | "PAYMENT_DISBURSEMENT"
  | "COGS"
  | "DEPRECIATION"
  | "BAD_DEBT"
  | "SALES_DISCOUNT"
  | "PURCHASE_DISCOUNT"
  | "ENDORSEMENT"
  | "CLIENT_ADVANCE"
  | "SUPPLIER_ADVANCE"
  | "APPLY_CLIENT_ADVANCE"
  | "APPLY_SUPPLIER_ADVANCE"
  | "FIXED_ASSET_PURCHASE"
  | "OWNER_CAPITAL"
  | "OWNER_DRAWINGS"
  | "LOAN_GIVEN"
  | "LOAN_COLLECTION"
  | "LOAN_RECEIVED"
  | "LOAN_REPAYMENT";

/**
 * Context for template account resolution
 */
export interface TemplateContext {
  /** Transaction type (دخل/مصروف) */
  transactionType?: "دخل" | "مصروف";

  /** Category from ledger entry */
  category?: string;

  /** Sub-category from ledger entry */
  subCategory?: string;

  /** Whether this is an AR/AP entry */
  isARAPEntry?: boolean;

  /** Whether settlement is immediate (cash) */
  immediateSettlement?: boolean;

  /** Party name for description */
  partyName?: string;

  /** Client ID for party-specific logic */
  clientId?: string;

  /** Whether this is an endorsement advance (uses AR not Cash) */
  isEndorsementAdvance?: boolean;

  /** Payment type for payment templates */
  paymentType?: "قبض" | "صرف";
}

/**
 * Account mapping result from templates
 */
export interface AccountMapping {
  debitAccountCode: string;
  debitAccountName: string;
  debitAccountNameAr: string;
  creditAccountCode: string;
  creditAccountName: string;
  creditAccountNameAr: string;
}

/**
 * Request to post a journal entry
 */
export interface PostingRequest {
  /** Template to use for account resolution */
  templateId: JournalTemplateId;

  /** Amount for the entry */
  amount: number;

  /** Entry date */
  date: Date;

  /** Description in Arabic */
  description: string;

  /** Source document information */
  source: JournalSource;

  /** Context for template resolution */
  context?: TemplateContext;

  /** Optional: Pre-resolved lines (for complex entries) */
  lines?: JournalLine[];
}

/**
 * Result of posting a journal entry
 */
export interface PostingResult {
  /** Whether posting succeeded */
  success: boolean;

  /** Created entry ID */
  entryId?: string;

  /** Assigned sequence number */
  sequenceNumber?: number;

  /** Formatted entry number */
  entryNumber?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Request to reverse a journal entry
 */
export interface ReversalRequest {
  /** ID of entry to reverse */
  entryId: string;

  /** Reason for reversal */
  reason: string;

  /** Type of reversal */
  reversalType?: "void" | "correction";
}

/**
 * Result of reversing a journal entry
 */
export interface ReversalResult {
  /** Whether reversal succeeded */
  success: boolean;

  /** ID of the original entry that was reversed */
  originalEntryId?: string;

  /** ID of the new reversal entry */
  reversalEntryId?: string;

  /** Sequence number of reversal entry */
  reversalSequenceNumber?: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Accounting settings document
 */
export interface AccountingSettings {
  /** No entries allowed on or before this date */
  lockDate?: Date;

  /** Fiscal year end (e.g., "12-31" for calendar year) */
  fiscalYearEnd?: string;

  /** Last closed period (e.g., "2024-12" for December 2024) */
  lastClosedPeriod?: string;
}

/**
 * Journal sequence counter document
 */
export interface JournalSequenceCounter {
  /** Current sequence number */
  currentSequence: number;

  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Pagination cursor for journal queries
 */
export interface JournalCursor {
  /** Last document ID */
  lastId: string;

  /** Last sequence number */
  lastSequence: number;
}

/**
 * Options for journal queries
 */
export interface JournalQueryOptions {
  /** Filter by status */
  status?: "posted" | "reversed" | "all";

  /** Filter by source type */
  sourceType?: JournalSourceType;

  /** Filter by transaction ID */
  transactionId?: string;

  /** Filter by document ID */
  documentId?: string;

  /** Start date filter */
  startDate?: Date;

  /** End date filter */
  endDate?: Date;

  /** Number of results to return */
  limit?: number;

  /** Pagination cursor */
  cursor?: JournalCursor;

  /** Sort order */
  orderBy?: "date" | "sequenceNumber";

  /** Sort direction */
  orderDirection?: "asc" | "desc";
}
