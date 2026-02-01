/**
 * Journal Posting Engine
 *
 * Single entry point for all journal creation and reversal operations.
 * Replaces 13+ scattered creation functions with a unified, template-based approach.
 *
 * Key features:
 * - Validates debits = credits before writing
 * - Auto-generates gapless sequence numbers
 * - Enforces lock date restrictions
 * - Supports both individual and batch operations
 * - Creates reversals instead of deleting entries
 */

import {
  doc,
  collection,
  writeBatch,
  getDocs,
  query,
  where,
  serverTimestamp,
  type WriteBatch,
  type DocumentReference,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import Decimal from "decimal.js-light";
import type { JournalLine } from "@/types/accounting";
import type {
  JournalEntryV2,
  JournalEntryV2Document,
  JournalSourceType,
  JournalSource,
  PostingRequest,
  PostingResult,
  ReversalResult,
  JournalTemplateId,
  TemplateContext,
} from "./types";
import {
  getNextSequenceNumber,
  reserveSequenceBlock,
  formatEntryNumber,
} from "./JournalSequence";
import { validatePostingDate } from "./JournalLockDate";
import { resolveTemplateAccounts, getTemplate } from "./JournalTemplates";

/**
 * Journal Posting Engine
 *
 * Usage:
 * ```typescript
 * const engine = new JournalPostingEngine(user.dataOwnerId);
 *
 * // Post a new journal entry
 * const result = await engine.post({
 *   templateId: 'PAYMENT_RECEIPT',
 *   amount: 1000,
 *   date: new Date(),
 *   description: 'سند قبض',
 *   source: { type: 'payment', documentId: paymentId }
 * });
 *
 * // Reverse an entry
 * const reversal = await engine.reverse(entryId, 'تصحيح خطأ');
 * ```
 */
export class JournalPostingEngine {
  private userId: string;
  private journalPath: string;

  constructor(userId: string) {
    if (!userId) {
      throw new Error("userId is required for JournalPostingEngine");
    }
    this.userId = userId;
    this.journalPath = `users/${userId}/journal_entries`;
  }

  /**
   * Post a new journal entry
   *
   * @param request - Posting request with template, amount, and source
   * @returns Posting result with entry ID and sequence number
   */
  async post(request: PostingRequest): Promise<PostingResult> {
    try {
      // 1. Validate lock date BEFORE any write
      await validatePostingDate(this.userId, request.date);

      // 2. Resolve accounts from template
      const accounts = resolveTemplateAccounts(
        request.templateId,
        request.context
      );

      // 3. Build journal lines
      const lines: JournalLine[] = request.lines || [
        {
          accountCode: accounts.debitAccountCode,
          accountName: accounts.debitAccountCode,
          accountNameAr: accounts.debitAccountNameAr,
          debit: request.amount,
          credit: 0,
        },
        {
          accountCode: accounts.creditAccountCode,
          accountName: accounts.creditAccountCode,
          accountNameAr: accounts.creditAccountNameAr,
          debit: 0,
          credit: request.amount,
        },
      ];

      // 4. Validate debits = credits
      const validation = this.validateLines(lines);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Journal entry is unbalanced: Debits=${validation.totalDebits}, Credits=${validation.totalCredits}`,
        };
      }

      // 5. Get next sequence number (atomic)
      const sequenceNumber = await getNextSequenceNumber(this.userId);
      const entryNumber = formatEntryNumber(sequenceNumber);

      // 6. Build entry document
      const template = getTemplate(request.templateId);

      // Determine linkedPaymentId value (only for payment/endorsement types)
      const linkedPaymentId =
        request.source.type === "payment" ||
        request.source.type === "endorsement"
          ? request.source.documentId
          : undefined;

      const entryDoc: JournalEntryV2Document = {
        sequenceNumber,
        entryNumber,
        date: request.date,
        description: request.description || template.nameAr,
        lines,
        totalDebits: validation.totalDebits,
        totalCredits: validation.totalCredits,
        status: "posted",
        source: request.source,
        createdAt: new Date(),

        // Legacy fields for backward compatibility
        linkedTransactionId: request.source.transactionId,
        ...(linkedPaymentId && { linkedPaymentId }), // Only include if defined
        linkedDocumentType: this.mapSourceTypeToLegacy(request.source.type),
      };

      // 7. Write to Firestore
      const entryRef = doc(collection(firestore, this.journalPath));
      const batch = writeBatch(firestore);
      batch.set(entryRef, {
        ...entryDoc,
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      return {
        success: true,
        entryId: entryRef.id,
        sequenceNumber,
        entryNumber,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Add a journal entry to an existing batch
   *
   * Use this for atomic operations where the journal must be created
   * together with other documents (e.g., ledger entry + journal).
   *
   * IMPORTANT: You must call reserveSequenceNumber() before using this method
   * to get the sequence number to pass in.
   *
   * @param batch - Firestore WriteBatch
   * @param request - Posting request
   * @param sequenceNumber - Pre-reserved sequence number
   * @returns Document reference for the created entry
   */
  postToBatch(
    batch: WriteBatch,
    request: PostingRequest,
    sequenceNumber: number
  ): DocumentReference {
    // Resolve accounts from template
    const accounts = resolveTemplateAccounts(
      request.templateId,
      request.context
    );

    // Build journal lines
    const lines: JournalLine[] = request.lines || [
      {
        accountCode: accounts.debitAccountCode,
        accountName: accounts.debitAccountCode,
        accountNameAr: accounts.debitAccountNameAr,
        debit: request.amount,
        credit: 0,
      },
      {
        accountCode: accounts.creditAccountCode,
        accountName: accounts.creditAccountCode,
        accountNameAr: accounts.creditAccountNameAr,
        debit: 0,
        credit: request.amount,
      },
    ];

    // Validate debits = credits
    const validation = this.validateLines(lines);
    if (!validation.isValid) {
      throw new Error(
        `Journal entry is unbalanced: Debits=${validation.totalDebits}, Credits=${validation.totalCredits}`
      );
    }

    const entryNumber = formatEntryNumber(sequenceNumber);
    const template = getTemplate(request.templateId);

    // Determine linkedPaymentId value (only for payment/endorsement types)
    const linkedPaymentId =
      request.source.type === "payment" ||
      request.source.type === "endorsement"
        ? request.source.documentId
        : undefined;

    // Build entry document
    const entryDoc: JournalEntryV2Document = {
      sequenceNumber,
      entryNumber,
      date: request.date,
      description: request.description || template.nameAr,
      lines,
      totalDebits: validation.totalDebits,
      totalCredits: validation.totalCredits,
      status: "posted",
      source: request.source,
      createdAt: new Date(),

      // Legacy fields
      linkedTransactionId: request.source.transactionId,
      ...(linkedPaymentId && { linkedPaymentId }), // Only include if defined
      linkedDocumentType: this.mapSourceTypeToLegacy(request.source.type),
    };

    // Add to batch
    const entryRef = doc(collection(firestore, this.journalPath));
    batch.set(entryRef, {
      ...entryDoc,
      createdAt: serverTimestamp(),
    });

    return entryRef;
  }

  /**
   * Reverse a journal entry by ID
   *
   * Creates a new entry with swapped debits/credits that offsets the original.
   * The original entry is marked as 'reversed' and linked to the reversal.
   *
   * @param entryId - ID of the entry to reverse
   * @param reason - Reason for the reversal (Arabic)
   * @param reversalType - 'void' for errors, 'correction' for business reversals
   * @returns Reversal result
   */
  async reverse(
    entryId: string,
    reason: string,
    reversalType: "void" | "correction" = "correction"
  ): Promise<ReversalResult> {
    try {
      // 1. Get the original entry
      const originalRef = doc(firestore, this.journalPath, entryId);
      const originalDoc = await getDocs(
        query(
          collection(firestore, this.journalPath),
          where("__name__", "==", entryId)
        )
      );

      if (originalDoc.empty) {
        return {
          success: false,
          error: `Journal entry not found: ${entryId}`,
        };
      }

      const originalData = originalDoc.docs[0].data() as JournalEntryV2Document;

      // 2. Check if already reversed
      if (originalData.status === "reversed") {
        return {
          success: false,
          error: "القيد معكوس بالفعل",
        };
      }

      // 3. Check if this is a reversal entry (cannot reverse a reversal)
      if (originalData.reversal?.isReversal) {
        return {
          success: false,
          error: "لا يمكن عكس قيد العكس",
        };
      }

      // 4. Validate lock date (original entry date)
      await validatePostingDate(this.userId, this.toDate(originalData.date));

      // 5. Get next sequence number
      const sequenceNumber = await getNextSequenceNumber(this.userId);
      const entryNumber = formatEntryNumber(sequenceNumber);

      // 6. Create reversed lines (swap debits and credits)
      const reversedLines: JournalLine[] = originalData.lines.map((line) => ({
        ...line,
        debit: line.credit,
        credit: line.debit,
      }));

      // 7. Build reversal entry
      const reversalDoc: JournalEntryV2Document = {
        sequenceNumber,
        entryNumber,
        date: new Date(), // Reversal uses current date
        description: `عكس: ${originalData.description} - ${reason}`,
        lines: reversedLines,
        status: "posted",
        source: {
          ...originalData.source,
          type: originalData.source.type,
        },
        reversal: {
          isReversal: true,
          reversesEntryId: entryId,
          reason,
          reversalType,
        },
        createdAt: new Date(),

        // Legacy fields
        linkedTransactionId: originalData.linkedTransactionId,
        linkedPaymentId: originalData.linkedPaymentId,
        linkedDocumentType: originalData.linkedDocumentType,
      };

      // 8. Write both updates atomically
      const batch = writeBatch(firestore);
      const reversalRef = doc(collection(firestore, this.journalPath));

      // Create reversal entry
      batch.set(reversalRef, {
        ...reversalDoc,
        createdAt: serverTimestamp(),
      });

      // Update original entry
      batch.update(originalRef, {
        status: "reversed",
        "reversal.reversedByEntryId": reversalRef.id,
        "reversal.reversedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      return {
        success: true,
        originalEntryId: entryId,
        reversalEntryId: reversalRef.id,
        reversalSequenceNumber: sequenceNumber,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Reverse all journal entries by source
   *
   * Use this when updating or deleting a ledger entry - all related
   * journals need to be reversed.
   *
   * @param sourceType - Type of source document
   * @param documentId - Primary document ID
   * @param reason - Reason for the reversal
   * @returns Array of reversal results
   */
  async reverseBySource(
    sourceType: JournalSourceType,
    documentId: string,
    reason: string
  ): Promise<ReversalResult[]> {
    // Find all entries with this source
    const q = query(
      collection(firestore, this.journalPath),
      where("source.type", "==", sourceType),
      where("source.documentId", "==", documentId),
      where("status", "==", "posted")
    );

    const snapshot = await getDocs(q);
    const results: ReversalResult[] = [];

    for (const doc of snapshot.docs) {
      const result = await this.reverse(doc.id, reason);
      results.push(result);
    }

    return results;
  }

  /**
   * Reverse all journal entries by transaction ID
   *
   * This finds all journals linked to a specific ledger transaction,
   * including payment journals that reference the transaction.
   *
   * @param transactionId - Ledger transaction ID
   * @param reason - Reason for the reversal
   * @returns Array of reversal results
   */
  async reverseByTransactionId(
    transactionId: string,
    reason: string
  ): Promise<ReversalResult[]> {
    // Find all entries with this transactionId in source
    const q = query(
      collection(firestore, this.journalPath),
      where("source.transactionId", "==", transactionId),
      where("status", "==", "posted")
    );

    const snapshot = await getDocs(q);
    const results: ReversalResult[] = [];

    for (const doc of snapshot.docs) {
      const result = await this.reverse(doc.id, reason);
      results.push(result);
    }

    return results;
  }

  /**
   * Add reversal operations to an existing batch
   *
   * Use this for atomic operations where reversals must happen
   * together with other updates.
   *
   * @param batch - Firestore WriteBatch
   * @param sourceType - Type of source document
   * @param documentId - Primary document ID
   * @param reason - Reason for the reversal
   * @param sequenceNumbers - Pre-reserved sequence numbers (one per entry to reverse)
   * @returns Document references for the reversal entries
   */
  async reverseBySourceToBatch(
    batch: WriteBatch,
    sourceType: JournalSourceType,
    documentId: string,
    reason: string,
    sequenceNumbers: number[]
  ): Promise<DocumentReference[]> {
    // Find all entries with this source
    const q = query(
      collection(firestore, this.journalPath),
      where("source.type", "==", sourceType),
      where("source.documentId", "==", documentId),
      where("status", "==", "posted")
    );

    const snapshot = await getDocs(q);

    if (snapshot.docs.length > sequenceNumbers.length) {
      throw new Error(
        `Not enough sequence numbers reserved. Need ${snapshot.docs.length}, have ${sequenceNumbers.length}`
      );
    }

    const reversalRefs: DocumentReference[] = [];

    snapshot.docs.forEach((originalDoc, index) => {
      const originalData = originalDoc.data() as JournalEntryV2Document;

      // Skip if already reversed or is a reversal
      if (
        originalData.status === "reversed" ||
        originalData.reversal?.isReversal
      ) {
        return;
      }

      const sequenceNumber = sequenceNumbers[index];
      const entryNumber = formatEntryNumber(sequenceNumber);

      // Create reversed lines
      const reversedLines: JournalLine[] = originalData.lines.map((line) => ({
        ...line,
        debit: line.credit,
        credit: line.debit,
      }));

      // Build reversal entry
      const reversalDoc: JournalEntryV2Document = {
        sequenceNumber,
        entryNumber,
        date: new Date(),
        description: `عكس: ${originalData.description} - ${reason}`,
        lines: reversedLines,
        status: "posted",
        source: originalData.source,
        reversal: {
          isReversal: true,
          reversesEntryId: originalDoc.id,
          reason,
          reversalType: "correction",
        },
        createdAt: new Date(),
        linkedTransactionId: originalData.linkedTransactionId,
        linkedPaymentId: originalData.linkedPaymentId,
        linkedDocumentType: originalData.linkedDocumentType,
      };

      // Add reversal to batch
      const reversalRef = doc(collection(firestore, this.journalPath));
      batch.set(reversalRef, {
        ...reversalDoc,
        createdAt: serverTimestamp(),
      });

      // Update original entry
      batch.update(originalDoc.ref, {
        status: "reversed",
        "reversal.reversedByEntryId": reversalRef.id,
        "reversal.reversedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      reversalRefs.push(reversalRef);
    });

    return reversalRefs;
  }

  /**
   * Reserve sequence numbers for batch operations
   *
   * Call this before using postToBatch or reverseBySourceToBatch
   * to get the sequence numbers you need.
   *
   * @param count - Number of sequences to reserve
   * @returns Array of reserved sequence numbers
   */
  async reserveSequences(count: number): Promise<number[]> {
    return reserveSequenceBlock(this.userId, count);
  }

  /**
   * Count entries that would be reversed by source
   *
   * Use this to know how many sequence numbers to reserve.
   *
   * @param sourceType - Type of source document
   * @param documentId - Primary document ID
   * @returns Count of entries that would be reversed
   */
  async countEntriesBySource(
    sourceType: JournalSourceType,
    documentId: string
  ): Promise<number> {
    const q = query(
      collection(firestore, this.journalPath),
      where("source.type", "==", sourceType),
      where("source.documentId", "==", documentId),
      where("status", "==", "posted")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.filter((doc) => {
      const data = doc.data() as JournalEntryV2Document;
      return !data.reversal?.isReversal;
    }).length;
  }

  // ============================================
  // Private helper methods
  // ============================================

  /**
   * Validate journal lines (debits must equal credits)
   */
  private validateLines(lines: JournalLine[]): {
    isValid: boolean;
    totalDebits: number;
    totalCredits: number;
  } {
    const totalDebits = lines.reduce(
      (sum, line) => new Decimal(sum).plus(line.debit || 0).toNumber(),
      0
    );

    const totalCredits = lines.reduce(
      (sum, line) => new Decimal(sum).plus(line.credit || 0).toNumber(),
      0
    );

    const difference = Math.abs(
      new Decimal(totalDebits).minus(totalCredits).toNumber()
    );

    // Allow for small floating point differences (0.001 tolerance)
    const isValid = difference < 0.001;

    return { isValid, totalDebits, totalCredits };
  }

  /**
   * Map new source types to legacy linkedDocumentType
   */
  private mapSourceTypeToLegacy(
    sourceType: JournalSourceType
  ): string | undefined {
    const mapping: Record<JournalSourceType, string | undefined> = {
      ledger: "ledger",
      payment: "payment",
      cheque_cash: "cheque",
      endorsement: "endorsement",
      inventory: "inventory",
      depreciation: "depreciation",
      bad_debt: "ledger",
      discount: "payment",
      advance_application: "ledger",
      advance_client: "ledger",
      advance_supplier: "ledger",
      manual: undefined,
    };

    return mapping[sourceType];
  }

  /**
   * Convert Firestore timestamp or Date to Date
   */
  private toDate(value: Date | { toDate: () => Date }): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value.toDate === "function") {
      return value.toDate();
    }
    return new Date(value as unknown as string);
  }
}

/**
 * Create a new JournalPostingEngine instance
 *
 * @param userId - The user/owner ID (use user.dataOwnerId)
 */
export function createJournalPostingEngine(
  userId: string
): JournalPostingEngine {
  return new JournalPostingEngine(userId);
}
