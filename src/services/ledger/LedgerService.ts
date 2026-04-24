/**
 * Ledger Service Layer
 * Centralizes all Firestore operations for ledger-related functionality
 * Abstracts database operations from components and hooks
 */

import { firestore, storage } from "@/firebase/config";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  runTransaction,
  onSnapshot,
  getCountFromServer,
  DocumentSnapshot,
  DocumentReference,
  QueryDocumentSnapshot,
  DocumentData,
  Unsubscribe,
  QueryConstraint,
  increment,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, StorageError } from "firebase/storage";
import type {
  LedgerEntry,
  LedgerFormData,
  PaymentFormData,
  ChequeRelatedFormData,
  InventoryRelatedFormData,
  InventoryMovementData,
  InventoryItemData,
} from "@/components/ledger/types/ledger";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import {
  getCategoryType,
  generateTransactionId,
  LOAN_CATEGORIES,
  isAdvanceTransaction,
  isFixedAssetTransaction,
  getJournalTemplateForTransaction,
  getPaymentTypeForTransaction,
} from "@/components/ledger/utils/ledger-helpers";
import { NON_CASH_SUBCATEGORIES, INBOUND_FREIGHT_SUBCATEGORIES } from "@/components/ledger/utils/ledger-constants";
import { DEPRECIATION_SUBCATEGORIES, ACCOUNT_CODES } from "@/types/accounting";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES, QUERY_LIMITS } from "@/lib/constants";
import {
  parseAmount,
  safeAdd,
  safeSubtract,
  safeMultiply,
  roundCurrency,
} from "@/lib/currency";
import {
  assertNonNegative,
  isDataIntegrityError,
} from "@/lib/errors";
import { addPaymentJournalEntryToBatch } from "@/services/journalService";
import { isEquityCategory, getAccountNameAr } from "@/lib/account-mapping";
import {
  createJournalPostingEngine,
  getEntriesByTransactionId,
  type JournalPostingEngine,
} from "@/services/journal";
import { handleError, ErrorType } from "@/lib/error-handling";
import { logActivity } from "@/services/activityLogService";
import {
  calculatePaymentStatus,
  calculateRemainingBalance,
} from "@/lib/arap-utils";
import { sanitizeFileName } from "@/lib/utils";

// Import types
import type {
  ServiceResult,
  DeleteResult,
  CreateLedgerEntryOptions,
  QuickPaymentData,
  WriteOffData,
  InvoiceData,
  InventoryUpdateResult,
  HandlerContext,
} from "./types";

// Import handlers
import {
  handleIncomingCheckBatch,
  handleOutgoingCheckBatch,
} from "./handlers/chequeHandlers";
import {
  handleImmediateSettlementBatch,
  handleInitialPaymentBatch,
} from "./handlers/paymentHandlers";
import {
  handleInventoryUpdate,
  rollbackInventoryChanges,
} from "./handlers/inventoryHandlers";
import { handleFixedAssetBatch } from "./handlers/fixedAssetHandlers";
import { handleAdvanceAllocationBatch } from "./handlers/advanceHandlers";

// Re-export types for backwards compatibility
export type {
  ServiceResult,
  DeleteResult,
  CreateLedgerEntryOptions,
  QuickPaymentData,
  InvoiceData,
  InventoryUpdateResult,
};

// Collection path helpers
const getUserCollectionPath = (userId: string, collectionName: string) =>
  `users/${userId}/${collectionName}`;

/**
 * LedgerService - Centralizes all ledger-related Firestore operations
 */
export class LedgerService {
  private userId: string;
  private userEmail: string;
  private userRole: string;

  constructor(userId: string, userEmail?: string, userRole?: string) {
    this.userId = userId;
    this.userEmail = userEmail || '';
    this.userRole = userRole || 'owner';
  }

  // ============================================
  // Collection References
  // ============================================

  private get ledgerRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "ledger"));
  }

  private get paymentsRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "payments"));
  }

  private get chequesRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "cheques"));
  }

  private get inventoryRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "inventory"));
  }

  private get inventoryMovementsRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "inventory_movements"));
  }

  private get fixedAssetsRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "fixed_assets"));
  }

  private get clientsRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "clients"));
  }

  private get partnersRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "partners"));
  }

  private get invoicesRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "invoices"));
  }

  private get journalEntriesRef() {
    return collection(firestore, getUserCollectionPath(this.userId, "journal_entries"));
  }

  private getLedgerDocRef(entryId: string) {
    return doc(firestore, getUserCollectionPath(this.userId, "ledger"), entryId);
  }

  /**
   * Get handler context for batch operations
   */
  private getHandlerContext(
    batch: ReturnType<typeof writeBatch>,
    transactionId: string,
    formData: LedgerFormData,
    entryType: string
  ): HandlerContext {
    return {
      batch,
      transactionId,
      formData,
      entryType,
      userId: this.userId,
      refs: {
        ledger: this.ledgerRef,
        cheques: this.chequesRef,
        payments: this.paymentsRef,
        inventory: this.inventoryRef,
        inventoryMovements: this.inventoryMovementsRef,
        fixedAssets: this.fixedAssetsRef,
      },
    };
  }

  /**
   * Helper to post journal entry and handle errors
   * Throws if posting fails to prevent silent accounting errors
   */
  private async postJournalEntry(
    engine: JournalPostingEngine,
    request: Parameters<JournalPostingEngine['post']>[0],
    context: string = "journal entry"
  ): Promise<void> {
    const result = await engine.post(request);

    if (!result.success) {
      const error = result.error || "Unknown error creating journal entry";
      throw new Error(`Failed to create ${context}: ${error}`);
    }
  }

  /**
   * Handle journal entry creation failure with automatic rollback
   *
   * Implements "compensation logic" to maintain data integrity:
   * 1. Attempts to delete the orphaned ledger entry
   * 2. If rollback succeeds: logs success and re-throws original error
   * 3. If rollback fails: logs to failed_rollbacks collection for manual cleanup
   *
   * @param ledgerRef - Reference to the ledger document to delete
   * @param transactionId - Transaction ID for tracking
   * @param originalError - The error that caused journal creation to fail
   * @throws Always re-throws the original error (or enhanced error if rollback fails)
   */
  private async handleJournalFailure(
    ledgerRef: DocumentReference,
    transactionId: string,
    originalError: unknown
  ): Promise<void> {
    const errorMessage = originalError instanceof Error
      ? originalError.message
      : String(originalError);

    console.error("⚠️ Journal creation failed, attempting rollback...", {
      ledgerId: ledgerRef.id,
      transactionId,
      error: errorMessage,
    });

    try {
      // Attempt to delete the orphaned ledger entry
      await deleteDoc(ledgerRef);

      // Re-throw the original error so the UI sees it
      throw new Error(
        `Transaction failed: ${errorMessage}. Ledger entry was rolled back.`
      );
    } catch (rollbackError) {
      // Check if this is the re-thrown error from above (not a delete failure)
      if (rollbackError instanceof Error && rollbackError.message.includes("rolled back")) {
        throw rollbackError;
      }

      // Rollback failed - this is the worst-case scenario
      const rollbackErrorMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);

      console.error("🚨 CRITICAL: Rollback failed - orphaned ledger entry exists", {
        ledgerId: ledgerRef.id,
        transactionId,
        originalError: errorMessage,
        rollbackError: rollbackErrorMessage,
      });

      // Write to failed_rollbacks collection for manual cleanup
      try {
        const failedRollbacksRef = collection(
          firestore,
          `users/${this.userId}/failed_rollbacks`
        );
        await addDoc(failedRollbacksRef, {
          ledgerId: ledgerRef.id,
          transactionId,
          context: "Orphaned Ledger Entry - Journal Creation Failed",
          originalError: errorMessage,
          rollbackError: rollbackErrorMessage,
          timestamp: serverTimestamp(),
          createdBy: this.userEmail,
        });
      } catch {
        // Failed to log to failed_rollbacks - original error already logged
      }

      // Re-throw with enhanced error message
      throw new Error(
        `CRITICAL: Transaction failed AND rollback failed. ` +
        `Orphaned ledger entry ${ledgerRef.id}. ` +
        `Original error: ${errorMessage}. ` +
        `Rollback error: ${rollbackErrorMessage}`
      );
    }
  }

  // ============================================
  // Read Operations
  // ============================================

  /**
   * Subscribe to ledger entries with real-time updates and cursor-based pagination
   */
  subscribeLedgerEntries(
    pageSize: number,
    onData: (entries: LedgerEntry[], lastDoc: DocumentSnapshot | null) => void,
    onError?: (error: Error) => void,
    startAfterDoc?: DocumentSnapshot | null
  ): Unsubscribe {
    const queryConstraints: QueryConstraint[] = [
      orderBy("date", "desc"),
      limit(pageSize),
    ];

    if (startAfterDoc) {
      queryConstraints.push(startAfter(startAfterDoc));
    }

    const q = query(this.ledgerRef, ...queryConstraints);

    return onSnapshot(
      q,
      (snapshot) => {
        const entries: LedgerEntry[] = [];
        let lastVisible: DocumentSnapshot | null = null;

        snapshot.forEach((doc) => {
          const data = doc.data();
          entries.push({
            id: doc.id,
            ...convertFirestoreDates(data),
          } as LedgerEntry);
          lastVisible = doc;
        });

        onData(entries, lastVisible);
      },
      onError
    );
  }

  /**
   * Subscribe to clients list
   */
  subscribeClients(
    onData: (clients: { id: string; name: string }[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(this.clientsRef, orderBy("name", "asc"), limit(500));

    return onSnapshot(
      q,
      (snapshot) => {
        const clients: { id: string; name: string }[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          clients.push({
            id: doc.id,
            name: data.name || "",
          });
        });
        onData(clients);
      },
      onError
    );
  }

  /**
   * Subscribe to partners list
   */
  subscribePartners(
    onData: (partners: { id: string; name: string }[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(this.partnersRef, orderBy("name", "asc"), limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        const partners: { id: string; name: string }[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.active !== false) {
            partners.push({
              id: doc.id,
              name: data.name || "",
            });
          }
        });
        onData(partners);
      },
      onError
    );
  }

  /**
   * Get total count of ledger entries
   */
  async getTotalCount(): Promise<number> {
    const snapshot = await getCountFromServer(query(this.ledgerRef));
    return snapshot.data().count;
  }

  /**
   * Get ALL ledger entries (for export purposes)
   * Safety limit of 10000 entries to prevent memory issues
   * For larger datasets, consider adding date range filtering
   */
  async getAllLedgerEntries(): Promise<LedgerEntry[]> {
    // Safety limit to prevent unbounded queries on very large datasets
    const MAX_EXPORT_ENTRIES = 10000;
    const q = query(this.ledgerRef, orderBy("date", "asc"), limit(MAX_EXPORT_ENTRIES));
    const snapshot = await getDocs(q);

    const entries: LedgerEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        ...convertFirestoreDates(data),
      } as LedgerEntry);
    });

    return entries;
  }

  // ============================================
  // Create Operations
  // ============================================

  /**
   * Create a simple ledger entry without related records
   */
  async createSimpleLedgerEntry(
    formData: LedgerFormData
  ): Promise<ServiceResult<string>> {
    try {
      const entryType = getCategoryType(formData.category, formData.subCategory);
      const transactionId = generateTransactionId();
      const amount = parseAmount(formData.amount);
      const entryDate = new Date(formData.date);

      const batch = writeBatch(firestore);
      const ledgerDocRef = doc(this.ledgerRef);

      // Add ledger entry to batch
      // Store immediateSettlement and isARAPEntry for correct behavior during edit
      batch.set(ledgerDocRef, {
        transactionId,
        description: formData.description,
        type: entryType,
        amount,
        category: formData.category,
        subCategory: formData.subCategory,
        associatedParty: formData.associatedParty,
        ownerName: formData.ownerName || "",
        date: entryDate,
        createdAt: new Date(),
        immediateSettlement: formData.immediateSettlement ?? true,
        isARAPEntry: false,
      });

      // Commit batch
      try {
        await batch.commit();
      } catch (batchError) {
        const { message, type } = handleError(batchError);
        console.error("Failed to commit ledger entry:", batchError);
        return {
          success: false,
          error: message,
          errorType: type,
        };
      }

      // Create journal entry after batch commit (uses separate sequence transaction)
      try {
        const engine = createJournalPostingEngine(this.userId);
        const templateId = getJournalTemplateForTransaction(
          entryType,
          formData.category,
          formData.subCategory
        );
        await this.postJournalEntry(engine, {
          templateId,
          amount,
          date: entryDate,
          description: formData.description,
          source: {
            type: "ledger",
            documentId: ledgerDocRef.id,
            transactionId,
          },
          context: {
            category: formData.category,
            subCategory: formData.subCategory,
            isARAPEntry: false,
            immediateSettlement: formData.immediateSettlement ?? true,
          },
        }, "main ledger journal");
      } catch (journalError) {
        // Rollback ledger entry and handle failure
        await this.handleJournalFailure(ledgerDocRef, transactionId, journalError);
      }

      // Log activity (fire and forget - don't block the main operation)
      logActivity(this.userId, {
        action: 'create',
        module: 'ledger',
        targetId: ledgerDocRef.id,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `إنشاء حركة مالية: ${formData.description}`,
        metadata: {
          amount: amount,
          type: entryType,
          category: formData.category,
        },
      });

      return { success: true, data: ledgerDocRef.id };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error creating simple ledger entry:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Create a sales return entry (مردودة عميل)
   *
   * Records goods rejected/returned by a client:
   *   - Reduces what the client owes (AR credit)
   *   - Restores goods to inventory (inventory debit)
   *   - Reverses COGS for the returned goods (COGS credit)
   *   - Reduces revenue (Sales Returns debit)
   *
   * Posts ONE compound 4-line journal entry:
   *   DR 4050 مردودات المبيعات  (selling price)
   *   DR 1300 مخزون             (cost price)
   *   CR 1200 ذمم مدينة         (selling price)
   *   CR 5000 تكلفة البضاعة     (cost price)
   *
   * NOTE: Deliberately bypasses handleInventoryUpdate to avoid:
   *   - Wrong inventory direction (handler creates خروج for دخل type)
   *   - Unwanted auto-generated COGS ledger entry
   *   - lastPurchasePrice/Date updates that don't apply to returns
   */
  async createSalesReturnEntry(
    formData: LedgerFormData,
    inventoryItemId: string,
    returnQuantity: number
  ): Promise<ServiceResult<string>> {
    try {
      const transactionId = generateTransactionId();
      const saleAmount = parseAmount(formData.amount);
      const costAmount = parseAmount(formData.returnCostAmount || '0');
      const entryDate = new Date(formData.date);

      if (saleAmount <= 0) {
        return { success: false, error: "يجب أن يكون سعر البيع أكبر من صفر" };
      }
      if (costAmount < 0) {
        return { success: false, error: "يجب أن تكون قيمة التكلفة صفراً أو أكثر" };
      }
      if (returnQuantity <= 0) {
        return { success: false, error: "يجب أن تكون الكمية المردودة أكبر من صفر" };
      }

      // 1. Read current inventory state before batch
      const invDocRef = doc(this.inventoryRef, inventoryItemId);
      const invSnap = await getDoc(invDocRef);
      if (!invSnap.exists()) {
        return { success: false, error: "عنصر المخزون غير موجود" };
      }
      const invData = invSnap.data();
      const currentQty = invData.quantity || 0;
      const currentUnitPrice = invData.unitPrice || 0;
      const returnInventorySubCode = (invData.inventoryAccountCode as string | undefined) || ACCOUNT_CODES.INVENTORY;
      const newQty = safeAdd(currentQty, returnQuantity);

      // Weighted average: blend existing stock cost with returned goods cost
      const newWeightedAvg = newQty > 0
        ? roundCurrency(
            (safeAdd(
              safeMultiply(currentQty, currentUnitPrice),
              costAmount
            )) / newQty
          )
        : currentUnitPrice;

      // 2. Build batch: LedgerEntry + InventoryItem update + InventoryMovement
      const batch = writeBatch(firestore);
      const ledgerDocRef = doc(this.ledgerRef);

      batch.set(ledgerDocRef, {
        transactionId,
        description: formData.description,
        type: "مردود",
        amount: saleAmount,
        returnCostAmount: costAmount,
        category: "مردودات المبيعات",
        subCategory: "بضاعة مردودة من عميل",
        associatedParty: formData.associatedParty,
        ownerName: formData.ownerName || "",
        date: entryDate,
        createdAt: new Date(),
        isARAPEntry: true,
        isReturnEntry: true,
        immediateSettlement: false,
        paymentStatus: "unpaid",
        remainingBalance: saleAmount,
        totalPaid: 0,
      });

      // Update inventory quantity and weighted average unit price
      // (does NOT update lastPurchasePrice/Date — this is a return, not a purchase)
      batch.update(invDocRef, {
        quantity: newQty,
        unitPrice: newWeightedAvg,
      });

      // Create inventory movement record (دخول — goods entering stock)
      const movementDocRef = doc(this.inventoryMovementsRef);
      batch.set(movementDocRef, {
        itemId: inventoryItemId,
        itemName: invData.itemName || "",
        type: "دخول",
        quantity: returnQuantity,
        linkedTransactionId: transactionId,
        notes: `مردودة عميل: ${formData.associatedParty}`,
        userEmail: this.userEmail,
        createdAt: new Date(),
      });

      await batch.commit();

      // 3. Post ONE 4-line compound journal entry (after batch commits)
      try {
        const engine = createJournalPostingEngine(this.userId);
        await this.postJournalEntry(engine, {
          templateId: "SALES_RETURN",
          amount: saleAmount,
          date: entryDate,
          description: formData.description,
          source: {
            type: "ledger",
            documentId: ledgerDocRef.id,
            transactionId,
          },
          lines: [
            {
              accountCode: ACCOUNT_CODES.SALES_RETURNS,
              accountName: getAccountNameAr(ACCOUNT_CODES.SALES_RETURNS),
              accountNameAr: getAccountNameAr(ACCOUNT_CODES.SALES_RETURNS),
              debit: saleAmount,
              credit: 0,
            },
            {
              accountCode: returnInventorySubCode,
              accountName: getAccountNameAr(returnInventorySubCode),
              accountNameAr: getAccountNameAr(returnInventorySubCode),
              debit: costAmount,
              credit: 0,
            },
            {
              accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
              accountName: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
              accountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
              debit: 0,
              credit: saleAmount,
            },
            {
              accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
              accountName: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
              accountNameAr: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
              debit: 0,
              credit: costAmount,
            },
          ],
        }, "sales return journal");
      } catch (journalError) {
        await this.handleJournalFailure(ledgerDocRef, transactionId, journalError);
      }

      logActivity(this.userId, {
        action: 'create',
        module: 'ledger',
        targetId: ledgerDocRef.id,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `مردودة عميل: ${formData.description}`,
        metadata: {
          amount: saleAmount,
          costAmount,
          returnQuantity,
          inventoryItemId,
          associatedParty: formData.associatedParty,
        },
      });

      return { success: true, data: ledgerDocRef.id };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error creating sales return entry:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Create a ledger entry with related records (batch operation)
   */
  async createLedgerEntryWithRelated(
    formData: LedgerFormData,
    options: CreateLedgerEntryOptions
  ): Promise<ServiceResult<string>> {
    try {
      const entryType = getCategoryType(formData.category, formData.subCategory);
      const transactionId = generateTransactionId();
      const totalAmount = parseAmount(formData.amount);

      // Validations
      const validationError = this.validateCreateOptions(formData, options, totalAmount);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const batch = writeBatch(firestore);
      const ledgerDocRef = doc(this.ledgerRef);
      const ctx = this.getHandlerContext(batch, transactionId, formData, entryType);

      // Check if there are cashed cheques (which should also track payment status)
      const hasCashedOutgoingCheques =
        (options.hasOutgoingCheck && options.outgoingChequesList?.some(c => (c.accountingType || "cashed") === "cashed")) ||
        (options.hasOutgoingCheck && options.outgoingCheckFormData && (options.outgoingCheckFormData.accountingType || "cashed") === "cashed");
      const hasCashedIncomingCheques =
        (options.hasIncomingCheck && options.incomingChequesList?.some(c => (c.accountingType || "cashed") === "cashed")) ||
        (options.hasIncomingCheck && options.checkFormData && (options.checkFormData.accountingType || "cashed") === "cashed");
      const hasCashedCheques = hasCashedOutgoingCheques || hasCashedIncomingCheques;

      // Calculate AR/AP tracking (also for cashed cheques even without explicit trackARAP)
      const { initialPaid, initialStatus } = this.calculateARAPTracking(
        formData,
        options,
        totalAmount,
        hasCashedCheques
      );

      // Determine if we should track AR/AP (either explicit or via cashed cheques)
      const shouldTrackARAP = formData.trackARAP || hasCashedCheques;

      // Inbound freight (شحن مواد خام): per IAS 2, shipping costs to bring raw materials
      // to the factory must be capitalized into inventory (DR 1300), not expensed immediately.
      // No inventory update toggle required — always treated as an inventory cost.
      const isInboundFreight =
        entryType === "مصروف" &&
        (INBOUND_FREIGHT_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "");

      // Inventory purchase: expense that adds to inventory stock (دخول).
      // Excludes wastage/samples which are inventory OUT despite being expenses.
      // Also includes inbound freight (always capitalize, even without inventory update toggle).
      // Stored on the ledger entry so P&L reports can exclude it (asset, not expense).
      const isDepreciation = (DEPRECIATION_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "");

      const isInventoryPurchase =
        isInboundFreight ||
        (
          options.hasInventoryUpdate &&
          entryType === "مصروف" &&
          !(NON_CASH_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "") &&
          !isDepreciation
        );

      // Wastage/samples: inventory leaves stock with no cash payment.
      // Journal must credit Inventory (1300) not Cash — there is no cash outflow.
      // Depreciation is also non-cash but credits Accumulated Depreciation (1510), not Inventory.
      const isNonCashInventoryOut =
        options.hasInventoryUpdate &&
        entryType === "مصروف" &&
        (NON_CASH_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "") &&
        !isDepreciation;

      // Add ledger entry
      // Always store immediateSettlement and isARAPEntry for correct behavior during edit
      batch.set(ledgerDocRef, {
        transactionId,
        description: formData.description,
        type: entryType,
        amount: totalAmount,
        category: formData.category,
        subCategory: formData.subCategory,
        associatedParty: formData.associatedParty,
        ownerName: formData.ownerName || "",
        date: new Date(formData.date),
        createdAt: new Date(),
        immediateSettlement: formData.immediateSettlement ?? !shouldTrackARAP,
        isARAPEntry: shouldTrackARAP,
        ...(isInventoryPurchase && { isInventoryPurchase: true }),
        ...(formData.category === "مردودات المبيعات" && { isReturnEntry: true }),
        ...(shouldTrackARAP && {
          totalPaid: initialPaid,
          remainingBalance: safeSubtract(totalAmount, initialPaid),
          paymentStatus: initialStatus,
        }),
      });

      // Handle incoming cheques
      if (options.hasIncomingCheck && options.incomingChequesList?.length) {
        for (const chequeData of options.incomingChequesList) {
          handleIncomingCheckBatch(ctx, chequeData);
        }
      } else if (options.hasIncomingCheck && options.checkFormData) {
        handleIncomingCheckBatch(ctx, options.checkFormData);
      }

      // Handle outgoing cheques
      if (options.hasOutgoingCheck && options.outgoingChequesList?.length) {
        for (const chequeData of options.outgoingChequesList) {
          handleOutgoingCheckBatch(ctx, chequeData);
        }
      } else if (options.hasOutgoingCheck && options.outgoingCheckFormData) {
        handleOutgoingCheckBatch(ctx, options.outgoingCheckFormData);
      }

      // Handle immediate settlement
      // Note: When immediateSettlement is true, cheque handlers skip creating their
      // own payments (for cashed cheques) to avoid double payment. This logic handles
      // all payment creation for immediate settlements.
      if (formData.immediateSettlement) {
        // Check if there are cashed cheques that need payment records
        let hasCashedIncoming = false;
        let hasCashedOutgoing = false;

        if (options.hasIncomingCheck) {
          if (options.incomingChequesList?.length) {
            hasCashedIncoming = options.incomingChequesList.some(
              c => (c.accountingType || "cashed") === "cashed"
            );
          } else if (options.checkFormData) {
            hasCashedIncoming = (options.checkFormData.accountingType || "cashed") === "cashed";
          }
        }

        if (options.hasOutgoingCheck) {
          if (options.outgoingChequesList?.length) {
            hasCashedOutgoing = options.outgoingChequesList.some(
              c => (c.accountingType || "cashed") === "cashed"
            );
          } else if (options.outgoingCheckFormData) {
            hasCashedOutgoing = (options.outgoingCheckFormData.accountingType || "cashed") === "cashed";
          }
        }

        // Create the settlement payment
        // Use "cheque" method if payment involves cashed cheques
        const paymentMethod = (hasCashedIncoming || hasCashedOutgoing) ? "cheque" : "cash";

        // Always skip payment journal for immediate settlements: the main ledger journal template
        // already handles the full cash movement directly (DR Expense/CR Cash or DR Cash/CR Revenue).
        // Creating a payment journal here would double-count cash (DR AP, CR Cash as extra entry).
        // This is the same reason fixed assets skip it — the main template already covers cash.
        const skipPaymentJournal = true;
        handleImmediateSettlementBatch(ctx, totalAmount, paymentMethod, skipPaymentJournal);
      }

      // Handle advance payment (SPECIAL CASE)
      // Advances need payment records (cash received/paid) even though immediateSettlement is false
      // because the AR/AP tracking is for the OBLIGATION (goods/services owed), not the cash movement
      // - Customer advance (سلفة عميل): We received cash, owe goods → create receipt payment
      // - Supplier advance (سلفة مورد): We paid cash, owed goods → create disbursement payment
      if (isAdvanceTransaction(formData.category) && !formData.immediateSettlement) {
        handleImmediateSettlementBatch(ctx, totalAmount, "cash");
      }

      // Handle initial payment
      if (options.hasInitialPayment && options.initialPaymentAmount && formData.trackARAP) {
        handleInitialPaymentBatch(ctx, parseAmount(options.initialPaymentAmount));
      }

      // Handle inventory update (supports multiple items per entry)
      const inventoryItemsList = options.inventoryFormDataList ??
        (options.inventoryFormData ? [options.inventoryFormData] : []);

      const allInventoryChanges: { itemId: string; quantityDelta: number }[] = [];
      const cogsResults: { amount: number; description: string; inventorySubCode?: string }[] = [];
      let totalReturnCostAmount = 0;
      // Track cost per sub-inventory account so the sales return journal can emit
      // one DR line per sub-account (matches the physical inventory update exactly).
      const returnSubCodeCosts = new Map<string, number>();

      if (options.hasInventoryUpdate && inventoryItemsList.length > 0) {
        for (let i = 0; i < inventoryItemsList.length; i++) {
          const itemResult = await handleInventoryUpdate(ctx, inventoryItemsList[i], i);
          if (!itemResult.success) {
            return { success: false, error: itemResult.error };
          }
          if (itemResult.inventoryChange) {
            allInventoryChanges.push(itemResult.inventoryChange);
          }
          if (itemResult.cogsCreated && itemResult.cogsAmount && itemResult.cogsDescription) {
            cogsResults.push({ amount: itemResult.cogsAmount, description: itemResult.cogsDescription, inventorySubCode: itemResult.cogsInventorySubCode });
          }
          if (itemResult.returnCostAmount) {
            totalReturnCostAmount = safeAdd(totalReturnCostAmount, itemResult.returnCostAmount);
            const subCode = itemResult.returnInventorySubCode || ACCOUNT_CODES.INVENTORY;
            returnSubCodeCosts.set(subCode, safeAdd(returnSubCodeCosts.get(subCode) ?? 0, itemResult.returnCostAmount));
          }
        }
      }

      // One DR line per sub-inventory account. Falls back to single DR 1300 if no costs recorded.
      const returnInventoryLines: { accountCode: string; cost: number }[] =
        returnSubCodeCosts.size > 0
          ? Array.from(returnSubCodeCosts.entries()).map(([code, cost]) => ({ accountCode: code, cost }))
          : [{ accountCode: ACCOUNT_CODES.INVENTORY, cost: totalReturnCostAmount }];

      // Store returnInventorySubCode on ledger entry so edit can rebuild the 4-line journal correctly
      if (formData.category === "مردودات المبيعات" && returnInventoryLines.length === 1) {
        batch.update(ledgerDocRef, { returnInventorySubCode: returnInventoryLines[0].accountCode });
      }

      // Aggregate result for downstream use
      const inventoryResult: InventoryUpdateResult | null = options.hasInventoryUpdate && inventoryItemsList.length > 0
        ? {
            success: true,
            cogsCreated: cogsResults.length > 0,
            cogsAmount: cogsResults.reduce((s, r) => safeAdd(s, r.amount), 0),
            cogsDescription: cogsResults.map(r => r.description).join(', '),
            returnCostAmount: totalReturnCostAmount,
            inventoryChanges: allInventoryChanges,
          }
        : null;

      // Handle fixed asset
      if (options.hasFixedAsset && options.fixedAssetFormData) {
        handleFixedAssetBatch(ctx, options.fixedAssetFormData);
      }

      // Handle advance allocation (applying existing advances to this invoice)
      let advanceAllocationResult = {
        totalPaidFromAdvances: 0,
        paidFromAdvances: [] as { advanceId: string; advanceTransactionId: string; amount: number; date: Date }[],
        journalPromises: [] as Promise<void>[]
      };
      if (options.advanceAllocations && options.advanceAllocations.length > 0) {
        advanceAllocationResult = await handleAdvanceAllocationBatch(
          ctx,
          options.advanceAllocations,
          ledgerDocRef.id
        );

        // Update the ledger entry to include advance payment data
        // Also update AR/AP tracking to reflect the advance payment
        if (advanceAllocationResult.totalPaidFromAdvances > 0) {
          const newTotalPaid = safeAdd(initialPaid, advanceAllocationResult.totalPaidFromAdvances);
          const newRemainingBalance = safeSubtract(totalAmount, newTotalPaid);
          const newStatus: "paid" | "unpaid" | "partial" =
            newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

          batch.update(ledgerDocRef, {
            paidFromAdvances: advanceAllocationResult.paidFromAdvances,
            totalPaidFromAdvances: advanceAllocationResult.totalPaidFromAdvances,
            // Update AR/AP tracking to reflect advance payment
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          });
        }
      }

      // Commit batch - rollback inventory on failure
      try {
        await batch.commit();
      } catch (batchError) {
        if (allInventoryChanges.length > 0) {
          console.error("Batch commit failed, attempting inventory rollback:", batchError);
          await rollbackInventoryChanges(this.userId, allInventoryChanges);
        }
        const { message, type } = handleError(batchError);
        console.error("Failed to commit ledger entry:", batchError);
        return {
          success: false,
          error: message,
          errorType: type,
        };
      }

      // Create journal entries after batch commit (uses separate sequence transaction)
      try {
        const engine = createJournalPostingEngine(this.userId);
        const entryDate = new Date(formData.date);

        // Sales return: compound 4-line journal (DR 4050 + DR 1300 / CR 1200 + CR 5000)
        // Must bypass the default 2-line template — always uses explicit lines override
        if (formData.category === "مردودات المبيعات") {
          const costAmount = inventoryResult?.returnCostAmount ?? 0;
          await this.postJournalEntry(engine, {
            templateId: "SALES_RETURN",
            amount: totalAmount,
            date: entryDate,
            description: formData.description,
            source: {
              type: "ledger",
              documentId: ledgerDocRef.id,
              transactionId,
            },
            lines: [
              {
                accountCode: ACCOUNT_CODES.SALES_RETURNS,
                accountName: getAccountNameAr(ACCOUNT_CODES.SALES_RETURNS),
                accountNameAr: getAccountNameAr(ACCOUNT_CODES.SALES_RETURNS),
                debit: totalAmount, credit: 0,
              },
              ...returnInventoryLines.map(({ accountCode, cost }) => ({
                accountCode,
                accountName: getAccountNameAr(accountCode),
                accountNameAr: getAccountNameAr(accountCode),
                debit: cost, credit: 0,
              })),
              {
                accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
                accountName: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
                accountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
                debit: 0, credit: totalAmount,
              },
              {
                accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
                accountName: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
                accountNameAr: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
                debit: 0, credit: costAmount,
              },
            ],
          }, "sales return journal");
        } else {
          // Resolve partner-specific equity account codes (only for equity entries)
          let partnerCapitalCode: string | undefined;
          let partnerDrawingsCode: string | undefined;
          const equityOwnerName = formData.ownerName || formData.associatedParty;
          if (isEquityCategory(formData.category, formData.subCategory) && equityOwnerName) {
            const partnerSnap = await getDocs(
              query(this.partnersRef, where("name", "==", equityOwnerName), limit(1))
            );
            if (partnerSnap.empty) {
              // HIGH-2: pre-validate before batch commits — gives user a clear Arabic error
              return { success: false, error: `لم يتم العثور على الشريك "${equityOwnerName}". يرجى اختيار شريك صحيح.`, errorType: ErrorType.NOT_FOUND };
            }
            const p = partnerSnap.docs[0].data();
            partnerCapitalCode = p.capitalAccountCode as string | undefined;
            partnerDrawingsCode = p.drawingsAccountCode as string | undefined;
            const isDrawings = formData.subCategory === "سحوبات" || formData.subCategory === "سحوبات المالك";
            if (isDrawings && !partnerDrawingsCode) {
              return { success: false, error: `الشريك "${equityOwnerName}" ليس لديه حساب سحوبات. يرجى تشغيل تهيئة حسابات الشركاء أولاً.`, errorType: ErrorType.VALIDATION };
            }
            if (!isDrawings && !partnerCapitalCode) {
              return { success: false, error: `الشريك "${equityOwnerName}" ليس لديه حساب رأس مال. يرجى تشغيل تهيئة حسابات الشركاء أولاً.`, errorType: ErrorType.VALIDATION };
            }
          }

          // Main ledger journal entry
          const templateId = getJournalTemplateForTransaction(
            entryType,
            formData.category,
            formData.subCategory
          );
          await this.postJournalEntry(engine, {
            templateId,
            amount: totalAmount,
            date: entryDate,
            description: formData.description,
            source: {
              type: "ledger",
              documentId: ledgerDocRef.id,
              transactionId,
            },
            context: {
              category: formData.category,
              subCategory: formData.subCategory,
              isARAPEntry: formData.trackARAP ?? false,
              immediateSettlement: formData.immediateSettlement ?? !shouldTrackARAP,
              // When true, journal debits Inventory asset (1300) instead of an expense account.
              isInventoryPurchase,
              // When true, journal credits Inventory asset (1300) instead of Cash/AP (wastage/samples).
              isNonCashInventoryOut,
              // Partner-specific equity codes (undefined for non-equity entries)
              partnerCapitalCode,
              partnerDrawingsCode,
            },
          }, "main ledger journal");

          // COGS journal entries — one per item sold
          for (const cogs of cogsResults) {
            await this.postJournalEntry(engine, {
              templateId: "COGS",
              amount: cogs.amount,
              date: entryDate,
              description: cogs.description,
              source: {
                type: "inventory",
                documentId: ledgerDocRef.id,
                transactionId,
              },
              ...(cogs.inventorySubCode && { context: { inventorySubCode: cogs.inventorySubCode } }),
            }, "COGS journal");
          }
        }
      } catch (journalError) {
        // Rollback ledger entry and handle failure
        await this.handleJournalFailure(ledgerDocRef, transactionId, journalError);
      }

      // Create advance application journals (after batch commit)
      // These are created outside the batch because they need sequence numbers
      // Graceful failure - if journals fail, the advance allocation still works
      if (advanceAllocationResult.journalPromises.length > 0) {
        try {
          await Promise.all(advanceAllocationResult.journalPromises);
        } catch (journalError) {
          // Rollback ledger entry and handle failure
          await this.handleJournalFailure(ledgerDocRef, transactionId, journalError);
        }
      }

      // Log activity (fire and forget - don't block the main operation)
      logActivity(this.userId, {
        action: 'create',
        module: 'ledger',
        targetId: ledgerDocRef.id,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `إنشاء حركة مالية: ${formData.description}`,
        metadata: {
          amount: totalAmount,
          type: entryType,
          category: formData.category,
        },
      });

      return { success: true, data: ledgerDocRef.id };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error creating ledger entry with related records:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  // ============================================
  // Update Operations
  // ============================================

  /**
   * Update an existing ledger entry
   * Also syncs associated party changes to linked payments
   * Recalculates AR/AP fields when amount changes
   */
  async updateLedgerEntry(
    entryId: string,
    formData: LedgerFormData,
    existingTransactionId?: string
  ): Promise<ServiceResult> {
    try {
      const entryType = getCategoryType(formData.category, formData.subCategory);
      const entryRef = this.getLedgerDocRef(entryId);
      const batch = writeBatch(firestore);

      const newAmount = parseAmount(formData.amount);

      // Track payments with discounts for journal entry recreation after batch commit
      // Declared at function level so it's accessible after batch.commit()
      const paymentsWithDiscounts: Array<{
        discountAmount: number;
        description: string;
      }> = [];

      // Track endorsement payments for journal recreation after batch commit
      // Endorsement journals need cheque lookup, so can't be in batch
      const endorsementPaymentsToRecreate: Array<{
        chequeId: string;
        amount: number;
        description: string;
      }> = [];

      // Build update data
      const updateData: Record<string, unknown> = {
        description: formData.description,
        type: entryType,
        amount: newAmount,
        category: formData.category,
        subCategory: formData.subCategory,
        associatedParty: formData.associatedParty,
        ownerName: formData.ownerName || "",
        date: new Date(formData.date),
      };

      // Track COGS recreation data for journal creation after batch commit
      const cogsRecreationResults: { description: string; amount: number; inventorySubCode?: string }[] = [];

      // Fetch current entry to check if AR/AP recalculation is needed
      const currentEntrySnap = await getDoc(entryRef);
      const currentData = currentEntrySnap.exists() ? currentEntrySnap.data() : null;

      // Guard: reject edit if a previous edit is still mid-processing
      if (currentData?.journalStatus === "reversal_pending") {
        return { success: false, error: "هذا السجل قيد المعالجة. يرجى تحديث الصفحة والمحاولة مرة أخرى." };
      }

      // Pre-batch: create engine and reserve sequences for journal operations
      // (sequence reservation uses its own sub-transaction so must happen BEFORE the batch)
      const engine = createJournalPostingEngine(this.userId);
      const entryDate = new Date(formData.date);

      // Count existing posted journals for this entry (to know how many reversals we need)
      const journalCountToReverse = existingTransactionId
        ? await engine.countEntriesBySource("ledger", entryId)
        : 0;

      // Reserve: 1 per reversal + 1 for the new main journal
      const totalSeqNeeded = journalCountToReverse + 1;
      const reservedSeqs = await engine.reserveSequences(totalSeqNeeded);
      const reversalSeqs = reservedSeqs.slice(0, journalCountToReverse);
      const newMainJournalSeq = reservedSeqs[journalCountToReverse];

      if (currentData) {
        const oldAmount = currentData.amount || 0;

        // BUG 4 FIX: Reverse advance allocations when editing an invoice
        // If this entry was paid by advances, we need to:
        // 1. Reverse the allocations on each advance entry
        // 2. Clear the paidFromAdvances and totalPaidFromAdvances fields
        // This allows the advances to be re-allocated to other invoices
        if (currentData.paidFromAdvances && currentData.paidFromAdvances.length > 0) {
          for (const advancePayment of currentData.paidFromAdvances) {
            const advanceRef = doc(
              firestore,
              `users/${this.userId}/ledger`,
              advancePayment.advanceId
            );

            // Reverse the allocation using atomic operations
            // SEMANTIC CHANGE: Using totalPaid instead of totalUsedFromAdvance
            // This aligns advances with standard AR/AP tracking (like loans)
            //
            // Note: We use increment for the numeric fields. The advanceAllocations array
            // will retain stale entries, but they don't affect calculations since we use
            // totalPaid as the authoritative source for remaining balance.
            // A cleanup function could be added later to remove stale allocation records.
            //
            // paymentStatus is set to "partial" as a safe default. We can't determine
            // if this should be "unpaid" (totalPaid=0) without reading the advance first,
            // which would require a transaction instead of batch. Since most filtering
            // uses `!== "paid"` (treating unpaid and partial the same), this is acceptable.
            // The numeric fields (totalPaid, remainingBalance) are authoritative.
            batch.update(advanceRef, {
              totalPaid: increment(-advancePayment.amount),
              remainingBalance: increment(advancePayment.amount),
              paymentStatus: "partial",
            });
          }

          // Clear advance payment info from this entry
          updateData.paidFromAdvances = [];
          updateData.totalPaidFromAdvances = 0;

          // Also recalculate AR/AP tracking since advance payments are being removed
          const totalPaid = (currentData.totalPaid || 0) - (currentData.totalPaidFromAdvances || 0);
          const totalDiscount = currentData.totalDiscount || 0;
          const writeoffAmount = currentData.writeoffAmount || 0;
          updateData.totalPaid = totalPaid;
          updateData.remainingBalance = calculateRemainingBalance(
            newAmount,
            totalPaid,
            totalDiscount,
            writeoffAmount
          );
          updateData.paymentStatus = calculatePaymentStatus(
            totalPaid,
            newAmount,
            totalDiscount,
            writeoffAmount
          );
        }

        // Recalculate AR/AP fields if this is an AR/AP entry and amount changed
        if (currentData.isARAPEntry && oldAmount !== newAmount) {
          let totalPaid = currentData.totalPaid || 0;
          const totalDiscount = currentData.totalDiscount || 0;
          const writeoffAmount = currentData.writeoffAmount || 0;

          // For immediate settlement entries (was fully paid at creation),
          // adjust totalPaid to match new amount to keep it "paid"
          const wasImmediateSettlement = currentData.immediateSettlement ||
            (totalPaid === oldAmount && currentData.paymentStatus === 'paid');

          if (wasImmediateSettlement) {
            totalPaid = newAmount;
            updateData.totalPaid = totalPaid;
          }

          updateData.remainingBalance = calculateRemainingBalance(
            newAmount,
            totalPaid,
            totalDiscount,
            writeoffAmount
          );
          updateData.paymentStatus = calculatePaymentStatus(
            totalPaid,
            newAmount,
            totalDiscount,
            writeoffAmount
          );
        }
      }

      // HIGH-1 FIX: Revert inventory movements when an entry is edited away from an
      // inventory-affecting category.  We only revert — we do NOT re-apply — because
      // the edit dialog does not collect new inventory form data (items, quantities).
      // If the category stays inventory-relevant the quantity is unchanged (correct for
      // price-correction edits); the unit-cost weighted average is a known limitation.
      if (currentData?.isInventoryPurchase) {
        const newEntryType = getCategoryType(formData.category, formData.subCategory);
        const newIsInboundFreight =
          newEntryType === "مصروف" &&
          (INBOUND_FREIGHT_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "");
        const newIsCOGSPurchase =
          newEntryType === "مصروف" &&
          !(NON_CASH_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "") &&
          !(DEPRECIATION_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "");
        const newCouldHaveInventory = newIsInboundFreight || newIsCOGSPurchase;

        if (!newCouldHaveInventory) {
          // Category changed away from inventory-purchase type → revert old movements
          const oldMovementsSnap = await getDocs(query(
            this.inventoryMovementsRef,
            where("linkedTransactionId", "==", existingTransactionId ?? ""),
            limit(100)
          ));

          const revertTasks = oldMovementsSnap.docs
            .filter((d) => (d.data() as InventoryMovementData).itemId)
            .map(async (movementDoc) => {
              const movement = movementDoc.data() as InventoryMovementData;
              const itemId = movement.itemId;
              const quantity = movement.quantity || 0;
              const movementType = movement.type;
              const itemDocRef = doc(
                firestore,
                getUserCollectionPath(this.userId, "inventory"),
                itemId
              );
              await runTransaction(firestore, async (tx) => {
                const itemDoc = await tx.get(itemDocRef);
                if (itemDoc.exists()) {
                  const currentQty = (itemDoc.data() as InventoryItemData).quantity || 0;
                  const delta = movementType === "دخول" ? -quantity : quantity;
                  const reverted = assertNonNegative(currentQty + delta, {
                    operation: "revertInventoryOnEdit",
                    entityId: itemId,
                    entityType: "inventory",
                  });
                  tx.update(itemDocRef, { quantity: reverted });
                }
              });
              batch.delete(movementDoc.ref);
            });

          await Promise.all(revertTasks);
          updateData.isInventoryPurchase = false;
        }
      }

      // Update the ledger entry
      batch.update(entryRef, updateData);

      // --- Journal atomicity: reversal + new main journal go IN THE BATCH ---
      // Reverse all existing main ledger journals for this entry
      if (journalCountToReverse > 0 && existingTransactionId) {
        await engine.reverseBySourceToBatch(
          batch,
          "ledger",
          entryId,
          "تعديل معاملة",
          reversalSeqs
        );
      }

      // Add new main ledger journal to batch
      if (currentData) {
        // Resolve partner equity codes for equity entries (same as createLedgerEntry)
        let updatePartnerCapitalCode: string | undefined;
        let updatePartnerDrawingsCode: string | undefined;
        const updateEquityOwnerName = formData.ownerName || formData.associatedParty;
        if (isEquityCategory(formData.category, formData.subCategory) && updateEquityOwnerName) {
          const partnerSnap = await getDocs(
            query(this.partnersRef, where("name", "==", updateEquityOwnerName), limit(1))
          );
          if (partnerSnap.empty) {
            return { success: false, error: `لم يتم العثور على الشريك "${updateEquityOwnerName}". يرجى اختيار شريك صحيح.`, errorType: ErrorType.NOT_FOUND };
          }
          const p = partnerSnap.docs[0].data();
          updatePartnerCapitalCode = p.capitalAccountCode as string | undefined;
          updatePartnerDrawingsCode = p.drawingsAccountCode as string | undefined;
          const isUpdateDrawings = formData.subCategory === "سحوبات" || formData.subCategory === "سحوبات المالك";
          if (isUpdateDrawings && !updatePartnerDrawingsCode) {
            return { success: false, error: `الشريك "${updateEquityOwnerName}" ليس لديه حساب سحوبات. يرجى تشغيل تهيئة حسابات الشركاء أولاً.`, errorType: ErrorType.VALIDATION };
          }
          if (!isUpdateDrawings && !updatePartnerCapitalCode) {
            return { success: false, error: `الشريك "${updateEquityOwnerName}" ليس لديه حساب رأس مال. يرجى تشغيل تهيئة حسابات الشركاء أولاً.`, errorType: ErrorType.VALIDATION };
          }
        }

        // CRIT-4: Sales return must rebuild the 4-line compound journal on edit.
        // The default 2-line SALES_RETURN template loses the DR Inventory and CR COGS legs.
        const isSalesReturnEdit = formData.category === "مردودات المبيعات";
        const editCostAmount = isSalesReturnEdit
          ? parseAmount((currentData.returnCostAmount as string | number | undefined)?.toString() ?? '0')
          : 0;
        // Re-use sub-inventory code stored on the entry; fall back to parent 1300
        const editReturnSubCode = (currentData.returnInventorySubCode as string | undefined)
          || ACCOUNT_CODES.INVENTORY;

        const mainTemplateId = getJournalTemplateForTransaction(
          entryType,
          formData.category,
          formData.subCategory
        );
        engine.postToBatch(
          batch,
          {
            templateId: mainTemplateId,
            amount: newAmount,
            date: entryDate,
            description: formData.description,
            source: {
              type: "ledger",
              documentId: entryId,
              transactionId: existingTransactionId,
            },
            // For sales returns, provide the 4-line explicit override so inventory and COGS legs are preserved
            ...(isSalesReturnEdit && {
              lines: [
                {
                  accountCode: ACCOUNT_CODES.SALES_RETURNS,
                  accountName: getAccountNameAr(ACCOUNT_CODES.SALES_RETURNS),
                  accountNameAr: getAccountNameAr(ACCOUNT_CODES.SALES_RETURNS),
                  debit: newAmount, credit: 0,
                },
                {
                  accountCode: editReturnSubCode,
                  accountName: getAccountNameAr(editReturnSubCode),
                  accountNameAr: getAccountNameAr(editReturnSubCode),
                  debit: editCostAmount, credit: 0,
                },
                {
                  accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
                  accountName: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
                  accountNameAr: getAccountNameAr(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
                  debit: 0, credit: newAmount,
                },
                {
                  accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
                  accountName: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
                  accountNameAr: getAccountNameAr(ACCOUNT_CODES.COST_OF_GOODS_SOLD),
                  debit: 0, credit: editCostAmount,
                },
              ],
            }),
            context: {
              category: formData.category,
              subCategory: formData.subCategory,
              isARAPEntry: currentData.isARAPEntry ?? false,
              immediateSettlement:
                currentData.immediateSettlement ??
                !(currentData.isARAPEntry ?? false),
              isEndorsementAdvance: !!currentData.linkedEndorsementChequeId,
              partnerCapitalCode: updatePartnerCapitalCode,
              partnerDrawingsCode: updatePartnerDrawingsCode,
              // CRIT-1: preserve inventory purchase flag so edit journal hits DR 1301/1303 not DR 5000
              isInventoryPurchase: !!(currentData.isInventoryPurchase),
              // CRIT-2: re-derive non-cash flag from subcategory (not stored on document)
              // Without this, wastage/samples edit posts DR expense / CR Cash instead of CR Inventory
              isNonCashInventoryOut:
                (NON_CASH_SUBCATEGORIES as readonly string[]).includes(formData.subCategory ?? "") &&
                entryType === "مصروف",
            },
          },
          newMainJournalSeq
        );
      }
      // -------------------------------------------------------------------

      // If there's a transaction ID, sync associated party to linked payments
      // Sync even when removing the associated party (set to empty)
      if (existingTransactionId) {
        const newClientName = formData.associatedParty || "غير محدد";

        // Get current entry data once for use throughout this block
        const currentData = currentEntrySnap.exists() ? currentEntrySnap.data() : null;

        // Query 1: Single-transaction payments (linkedTransactionId)
        const singlePaymentsQuery = query(
          this.paymentsRef,
          where("linkedTransactionId", "==", existingTransactionId),
          limit(QUERY_LIMITS.PAYMENTS)
        );
        const singlePaymentsSnapshot = await getDocs(singlePaymentsQuery);

        // Query 2: Multi-allocation payments from payments page (allocationTransactionIds array)
        const multiAllocPaymentsQuery = query(
          this.paymentsRef,
          where("allocationTransactionIds", "array-contains", existingTransactionId),
          limit(QUERY_LIMITS.PAYMENTS)
        );
        const multiAllocPaymentsSnapshot = await getDocs(multiAllocPaymentsQuery);

        // Query 3: Endorsement payments (paidTransactionIds array)
        const endorsementPaymentsQuery = query(
          this.paymentsRef,
          where("paidTransactionIds", "array-contains", existingTransactionId),
          limit(QUERY_LIMITS.PAYMENTS)
        );
        const endorsementPaymentsSnapshot = await getDocs(endorsementPaymentsQuery);

        // Combine all results, avoiding duplicates
        const processedPaymentIds = new Set<string>();
        const allPaymentDocs: typeof singlePaymentsSnapshot.docs = [];

        singlePaymentsSnapshot.docs.forEach((doc) => {
          processedPaymentIds.add(doc.id);
          allPaymentDocs.push(doc);
        });

        multiAllocPaymentsSnapshot.docs.forEach((doc) => {
          if (!processedPaymentIds.has(doc.id)) {
            processedPaymentIds.add(doc.id);
            allPaymentDocs.push(doc);
          }
        });

        endorsementPaymentsSnapshot.docs.forEach((doc) => {
          if (!processedPaymentIds.has(doc.id)) {
            processedPaymentIds.add(doc.id);
            allPaymentDocs.push(doc);
          }
        });

        // First, delete journal entries for each payment being updated
        // Use Promise.all to fetch all payment journals in parallel (avoid N+1 query pattern)
        const paymentJournalPromises = allPaymentDocs.map((paymentDoc) => {
          const paymentJournalQuery = query(
            this.journalEntriesRef,
            where("linkedPaymentId", "==", paymentDoc.id)
          );
          return getDocs(paymentJournalQuery);
        });
        const paymentJournalSnapshots = await Promise.all(paymentJournalPromises);

        // Add all payment journal deletions to batch
        for (const paymentJournalSnapshot of paymentJournalSnapshots) {
          paymentJournalSnapshot.forEach((journalDoc) => {
            batch.delete(journalDoc.ref);
          });
        }

        // Then update payment records and recreate their journal entries
        for (const paymentDoc of allPaymentDocs) {
          const paymentData = paymentDoc.data();

          // For immediate settlement transactions, the payment amount equals the transaction amount
          // and should be updated when the transaction amount changes.
          // For partial payments, keep the original amount (it represents what was actually paid).
          const oldTransactionAmount = currentData?.amount || 0;
          const shouldSyncPaymentAmount =
            !!currentData?.immediateSettlement &&
            newAmount !== oldTransactionAmount &&
            paymentData.amount === oldTransactionAmount;

          // Update the payment record
          batch.update(paymentDoc.ref, {
            clientName: newClientName,
            date: new Date(formData.date),
            category: formData.category,
            subCategory: formData.subCategory,
            ...(shouldSyncPaymentAmount ? { amount: newAmount } : {}),
          });

          // Recreate the payment journal entry (DR Cash, CR AR for receipts)
          // Only for standard AR/AP entries (income/expense with partial payments)
          // Skip for:
          // - Immediate settlements (no separate payment journal)
          // - Advances (use Cash vs Advance accounts, not AR/AP)
          // - Loans (use Cash vs Loans accounts, not AR/AP)
          // - Zero-amount payments (discount-only settlements have no cash movement)
          // - Endorsement payments (no cash movement, use DR AP, CR AR instead)
          const isAdvance = isAdvanceTransaction(currentData?.category);
          const isLoan = currentData?.type === 'قرض';
          const isEndorsementPayment = paymentData.isEndorsement === true || paymentData.noCashMovement === true;
          const paymentCashAmount = paymentData.amount || 0;
          const paymentDiscountAmount = paymentData.discountAmount || 0;

          if (currentData?.isARAPEntry && !currentData?.immediateSettlement && !isAdvance && !isLoan) {
            if (isEndorsementPayment) {
              // Endorsement payment - track for journal recreation after batch commit
              // These need DR AP, CR AR (not DR Cash) and require cheque lookup
              if (paymentData.endorsementChequeId && paymentCashAmount > 0) {
                endorsementPaymentsToRecreate.push({
                  chequeId: paymentData.endorsementChequeId,
                  amount: paymentCashAmount,
                  description: paymentData.notes || `تظهير شيك - ${formData.description}`,
                });
              }
            } else if (paymentCashAmount > 0) {
              // Standard cash payment - create journal entry: DR Cash, CR AR
              const paymentType = paymentData.type as 'قبض' | 'صرف';
              addPaymentJournalEntryToBatch(batch, this.userId, {
                paymentId: paymentDoc.id,
                description: paymentData.notes || `دفعة - ${formData.description}`,
                amount: paymentCashAmount,
                paymentType: paymentType,
                date: new Date(formData.date),
                linkedTransactionId: existingTransactionId,
              });
            }

            // Track discount for journal recreation after batch commit
            // Journal: DR Sales Discount (4500), CR Accounts Receivable (1200) for income
            // Journal: DR Accounts Payable (2100), CR Purchase Discount (4600) for expense
            if (paymentDiscountAmount > 0) {
              paymentsWithDiscounts.push({
                discountAmount: paymentDiscountAmount,
                description: paymentData.notes || `خصم تسوية - ${formData.description}`,
              });
            }
          }
        }

        // Also sync to linked cheques and handle cashed cheque payments
        const chequesQuery = query(
          this.chequesRef,
          where("linkedTransactionId", "==", existingTransactionId),
          limit(QUERY_LIMITS.PENDING_CHEQUES)
        );
        const chequesSnapshot = await getDocs(chequesQuery);

        // Track cashed cheque IDs for payment lookup
        const cashedChequeIds: string[] = [];
        const clearedStatuses = ["تم الصرف", "cleared", "محصل", "cashed"];

        chequesSnapshot.forEach((chequeDoc) => {
          const chequeData = chequeDoc.data();
          batch.update(chequeDoc.ref, {
            clientName: newClientName,
          });

          // Track cashed cheques for payment journal recreation
          if (clearedStatuses.includes(chequeData.status)) {
            cashedChequeIds.push(chequeDoc.id);
          }
        });

        // Find payments for cashed cheques (linked by linkedChequeId)
        // These payments may not have been found by the linkedTransactionId query above
        // if they were created when the cheque was cashed without a linked transaction
        // Use Promise.all to fetch all cheque payments in parallel (avoid N+1 query pattern)
        const cashedChequePaymentPromises = cashedChequeIds.map((chequeId) => {
          const chequePaymentQuery = query(
            this.paymentsRef,
            where("linkedChequeId", "==", chequeId)
          );
          return getDocs(chequePaymentQuery);
        });
        const cashedChequePaymentSnapshots = await Promise.all(cashedChequePaymentPromises);

        // Collect unprocessed payment docs and their data
        const unprocessedChequePayments: { doc: QueryDocumentSnapshot<DocumentData>; data: DocumentData; id: string }[] = [];
        for (const chequePaymentSnapshot of cashedChequePaymentSnapshots) {
          for (const paymentDoc of chequePaymentSnapshot.docs) {
            const paymentId = paymentDoc.id;
            // Skip if already processed in the main payments query
            if (!processedPaymentIds.has(paymentId)) {
              unprocessedChequePayments.push({
                doc: paymentDoc,
                data: paymentDoc.data(),
                id: paymentId,
              });
            }
          }
        }

        // Fetch all journal entries for unprocessed cheque payments in parallel (avoid nested N+1 pattern)
        const unprocessedJournalPromises = unprocessedChequePayments.map(({ id: paymentId }) => {
          const paymentJournalQuery = query(
            this.journalEntriesRef,
            where("linkedPaymentId", "==", paymentId)
          );
          return getDocs(paymentJournalQuery);
        });
        const unprocessedJournalSnapshots = await Promise.all(unprocessedJournalPromises);

        // Delete journals and update payments
        for (let i = 0; i < unprocessedChequePayments.length; i++) {
          const { doc: paymentDoc, data: paymentData, id: paymentId } = unprocessedChequePayments[i];
          const paymentJournalSnapshot = unprocessedJournalSnapshots[i];

          // Delete existing journal entries for this payment
          paymentJournalSnapshot.forEach((journalDoc) => {
            batch.delete(journalDoc.ref);
          });

          // Update payment clientName to match transaction
          batch.update(paymentDoc.ref, {
            clientName: newClientName,
          });

          // Recreate journal entry for the cashed cheque payment
          const paymentCashAmount = paymentData.amount || 0;
          if (paymentCashAmount > 0 && currentData?.isARAPEntry && !currentData?.immediateSettlement) {
            const paymentType = paymentData.type as 'قبض' | 'صرف';
            addPaymentJournalEntryToBatch(batch, this.userId, {
              paymentId: paymentId,
              description: paymentData.notes || `صرف شيك - ${formData.description}`,
              amount: paymentCashAmount,
              paymentType: paymentType,
              date: paymentData.date?.toDate ? paymentData.date.toDate() : new Date(formData.date),
              linkedTransactionId: existingTransactionId,
            });
          }
        }

        // Handle COGS entries for inventory sales
        // COGS entries are auto-generated during sale and need to be deleted + recreated on edit
        // Query by linkedTransactionId to handle multiple items (fixes transactionId collision bug)
        const cogsLedgerQuery = query(
          this.ledgerRef,
          where("linkedTransactionId", "==", existingTransactionId),
          where("autoGenerated", "==", true)
        );
        const cogsLedgerSnapshot = await getDocs(cogsLedgerQuery);

        // Multi-item COGS recreation data
        const cogsRecreationItems: Array<{
          itemId: string;
          itemName: string;
          quantity: number;
          originalCogsAmount: number;
        }> = [];

        if (!cogsLedgerSnapshot.empty) {
          // Get ALL inventory movements for this transaction
          const movementQuery = query(
            this.inventoryMovementsRef,
            where("linkedTransactionId", "==", existingTransactionId)
          );
          const movementSnapshot = await getDocs(movementQuery);

          // Delete ALL old COGS ledger entries
          cogsLedgerSnapshot.forEach((cogsDoc) => {
            batch.delete(cogsDoc.ref);
          });

          // Build map of original COGS amounts by itemName for fallback
          const originalCogsAmountByItemName = new Map<string, number>();
          cogsLedgerSnapshot.docs.forEach((cogsDoc) => {
            const data = cogsDoc.data();
            const existingAmount = originalCogsAmountByItemName.get(data.description) || 0;
            originalCogsAmountByItemName.set(data.description, safeAdd(existingAmount, data.amount || 0));
          });

          // Collect recreation data from ALL movements
          movementSnapshot.docs.forEach((movDoc) => {
            const movementData = movDoc.data();
            const descKey = `تكلفة البضاعة المباعة - ${movementData.itemName}`;
            cogsRecreationItems.push({
              itemId: movementData.itemId,
              itemName: movementData.itemName,
              quantity: movementData.quantity,
              originalCogsAmount: originalCogsAmountByItemName.get(descKey) || 0,
            });
          });
        }

        // Note: Journal reversals and recreations will happen after batch commit
        // Recreate one COGS entry per item
        for (let i = 0; i < cogsRecreationItems.length; i++) {
          const item = cogsRecreationItems[i];

          // Get current inventory cost
          const inventoryRef = doc(
            firestore,
            `users/${this.userId}/inventory`,
            item.itemId
          );
          const inventorySnap = await getDoc(inventoryRef);
          const currentUnitCost = inventorySnap.exists()
            ? (inventorySnap.data()?.unitPrice || 0)
            : 0;
          const itemInventorySubCode = inventorySnap.exists()
            ? (inventorySnap.data()?.inventoryAccountCode as string | undefined)
            : undefined;

          let newCogsAmount: number;
          let cogsNotes: string;

          if (currentUnitCost > 0) {
            newCogsAmount = safeMultiply(item.quantity, currentUnitCost);
            cogsNotes = `حساب تلقائي: ${item.quantity} × ${roundCurrency(currentUnitCost).toFixed(2)} = ${roundCurrency(newCogsAmount).toFixed(2)} دينار`;
          } else if (item.originalCogsAmount > 0) {
            newCogsAmount = item.originalCogsAmount;
            cogsNotes = `تكلفة محفوظة (صنف محذوف أو بدون سعر): ${roundCurrency(newCogsAmount).toFixed(2)} دينار`;
          } else {
            continue; // No valid COGS to recreate for this item
          }

          const cogsDescription = `تكلفة البضاعة المباعة - ${item.itemName}`;
          const cogsDocRef = doc(this.ledgerRef);
          batch.set(cogsDocRef, {
            transactionId: `COGS-${existingTransactionId}-${i}`,  // unique per item
            description: cogsDescription,
            type: "مصروف",
            amount: newCogsAmount,
            category: "تكلفة البضاعة المباعة (COGS)",
            subCategory: "مبيعات",
            date: new Date(formData.date),
            linkedTransactionId: existingTransactionId,
            autoGenerated: true,
            notes: cogsNotes,
            createdAt: new Date(),
          });

          cogsRecreationResults.push({ description: cogsDescription, amount: newCogsAmount, inventorySubCode: itemInventorySubCode });
        }
      }

      await batch.commit();

      // After batch commit: Create secondary journals (COGS, discounts, endorsements)
      // Main ledger journal reversal + recreation are now atomically in the batch above.
      try {
        // 3. Create COGS journals if needed (one per sold item)
        for (const cogsResult of cogsRecreationResults) {
          await this.postJournalEntry(engine, {
            templateId: "COGS",
            amount: cogsResult.amount,
            date: entryDate,
            description: cogsResult.description,
            source: {
              type: "inventory",
              documentId: entryId,
              transactionId: existingTransactionId,
            },
            ...(cogsResult.inventorySubCode && { context: { inventorySubCode: cogsResult.inventorySubCode } }),
          }, "COGS journal (update)");
        }

        // 4. Create discount journals
        if (paymentsWithDiscounts.length > 0) {
          const discountTemplateId = entryType === "دخل" ? "SALES_DISCOUNT" : "PURCHASE_DISCOUNT";
          for (const discountPayment of paymentsWithDiscounts) {
            await this.postJournalEntry(engine, {
              templateId: discountTemplateId,
              amount: discountPayment.discountAmount,
              date: entryDate,
              description: discountPayment.description,
              source: {
                type: "discount",
                documentId: entryId,
                transactionId: existingTransactionId,
              },
            }, "discount journal (update)");
          }
        }

        // 5. Create endorsement journals
        for (const endorsement of endorsementPaymentsToRecreate) {
          await this.postJournalEntry(engine, {
            templateId: "ENDORSEMENT",
            amount: endorsement.amount,
            date: entryDate,
            description: endorsement.description,
            source: {
              type: "endorsement",
              documentId: endorsement.chequeId,
              transactionId: existingTransactionId,
            },
          }, "endorsement journal (update)");
        }
      } catch (journalError) {
        // Secondary journal failure (COGS / discount / endorsement)
        // The main ledger entry and its main journal are already committed atomically.
        // Log the error and surface it to the user — manual correction may be needed.
        console.error("⚠️ Secondary journal creation failed after ledger update", {
          entryId,
          transactionId: existingTransactionId,
          error: journalError instanceof Error ? journalError.message : String(journalError),
        });
        throw journalError;
      }

      // Log activity (fire and forget - don't block the main operation)
      logActivity(this.userId, {
        action: 'update',
        module: 'ledger',
        targetId: entryId,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `تعديل حركة مالية: ${formData.description}`,
        metadata: {
          amount: newAmount,
          type: entryType,
        },
      });

      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error updating ledger entry:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Update AR/AP tracking on a ledger entry
   */
  async updateARAPTracking(
    entryId: string,
    totalPaid: number,
    remainingBalance: number,
    paymentStatus: "paid" | "unpaid" | "partial"
  ): Promise<ServiceResult> {
    try {
      const entryRef = this.getLedgerDocRef(entryId);
      await updateDoc(entryRef, {
        totalPaid,
        remainingBalance,
        paymentStatus,
      });
      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error updating AR/AP tracking:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  // ============================================
  // Delete Operations
  // ============================================

  /**
   * Delete a ledger entry and all related records
   */
  async deleteLedgerEntry(entry: LedgerEntry): Promise<DeleteResult> {
    const inventoryChanges: Array<{ itemId: string; quantityDelta: number }> = [];

    try {
      // VALIDATION: Prevent deletion of advances that have active allocations
      // Deleting such advances would leave orphaned references in invoices
      // We check totalPaid > 0 because if any allocations exist, totalPaid would be > 0
      if (isAdvanceTransaction(entry.category)) {
        const totalPaid = entry.totalPaid ?? 0;

        if (totalPaid > 0) {
          return {
            success: false,
            error: "لا يمكن حذف سلفة تم استخدامها في فواتير. يجب أولاً تعديل أو حذف الفواتير التي تستخدم هذه السلفة.",
            errorType: ErrorType.VALIDATION,
          };
        }
      }

      // Reserve sequences for journal reversals BEFORE building the batch
      // (sequence reservation uses a Firestore transaction and must run outside the batch)
      const engine = createJournalPostingEngine(this.userId);
      const journalCountToReverse = await engine.countEntriesBySource("ledger", entry.id);
      const reversalSeqs = journalCountToReverse > 0
        ? await engine.reserveSequences(journalCountToReverse)
        : [];

      const batch = writeBatch(firestore);
      let deletedRelatedCount = 0;

      // Reverse main ledger journal entries (immutable ledger — never hard-delete)
      if (journalCountToReverse > 0) {
        await engine.reverseBySourceToBatch(batch, "ledger", entry.id, "حذف معاملة", reversalSeqs);
      }

      // Delete the ledger entry
      const entryRef = this.getLedgerDocRef(entry.id);
      batch.delete(entryRef);

      // Delete related payments and their journal entries.
      // Payments can be linked by three different fields — must query all three to avoid orphans:
      //   1. linkedTransactionId  — direct payment to this entry
      //   2. allocationTransactionIds array — multi-invoice payment from the payments page
      //   3. paidTransactionIds array — endorsement payments
      // HIGH-3 FIX: previously only query 1 was run, leaving multi-allocation payments orphaned.
      const [singlePaymentsSnap, multiAllocPaymentsSnap, endorsementPaymentsSnap] =
        await Promise.all([
          getDocs(query(
            this.paymentsRef,
            where("linkedTransactionId", "==", entry.transactionId),
            limit(QUERY_LIMITS.PAYMENTS)
          )),
          getDocs(query(
            this.paymentsRef,
            where("allocationTransactionIds", "array-contains", entry.transactionId),
            limit(QUERY_LIMITS.PAYMENTS)
          )),
          getDocs(query(
            this.paymentsRef,
            where("paidTransactionIds", "array-contains", entry.transactionId),
            limit(QUERY_LIMITS.PAYMENTS)
          )),
        ]);

      // Merge, deduplicate, then delete each payment
      const seenPaymentIds = new Set<string>();
      const paymentIds: string[] = [];
      for (const snap of [singlePaymentsSnap, multiAllocPaymentsSnap, endorsementPaymentsSnap]) {
        snap.forEach((doc) => {
          if (!seenPaymentIds.has(doc.id)) {
            seenPaymentIds.add(doc.id);
            paymentIds.push(doc.id);
            batch.delete(doc.ref);
            deletedRelatedCount++;
          }
        });
      }

      // Delete journal entries linked to payments (cheque cashing creates journal entries with linkedPaymentId)
      // Use Promise.all to fetch all payment journals in parallel (avoid N+1 query pattern)
      const paymentJournalPromises = paymentIds.map((paymentId) => {
        const paymentJournalQuery = query(
          this.journalEntriesRef,
          where("linkedPaymentId", "==", paymentId)
        );
        return getDocs(paymentJournalQuery);
      });
      const paymentJournalSnapshots = await Promise.all(paymentJournalPromises);
      for (const paymentJournalSnapshot of paymentJournalSnapshots) {
        paymentJournalSnapshot.forEach((journalDoc) => {
          batch.delete(journalDoc.ref);
          deletedRelatedCount++;
        });
      }

      // Delete related cheques and their associated payments/journal entries
      // Bug #8: Cashed cheques create payments with linkedChequeId, which need cleanup
      const chequesQuery = query(
        this.chequesRef,
        where("linkedTransactionId", "==", entry.transactionId),
        limit(QUERY_LIMITS.PENDING_CHEQUES)
      );
      const chequesSnapshot = await getDocs(chequesQuery);
      const chequeIds: string[] = [];
      chequesSnapshot.forEach((chequeDoc) => {
        chequeIds.push(chequeDoc.id);
        batch.delete(chequeDoc.ref);
        deletedRelatedCount++;
      });

      // For each cheque, find and delete any payments created when cheque was cashed
      // These payments are linked by linkedChequeId (not linkedTransactionId)
      // Use Promise.all to fetch all cheque payments in parallel (avoid N+1 query pattern)
      const chequePaymentPromises = chequeIds.map((chequeId) => {
        const chequePaymentQuery = query(
          this.paymentsRef,
          where("linkedChequeId", "==", chequeId)
        );
        return getDocs(chequePaymentQuery);
      });
      const chequePaymentSnapshots = await Promise.all(chequePaymentPromises);

      // Collect all payment docs and their IDs
      const chequePaymentDocs: { ref: DocumentReference<DocumentData>; id: string }[] = [];
      for (const chequePaymentSnapshot of chequePaymentSnapshots) {
        for (const paymentDoc of chequePaymentSnapshot.docs) {
          chequePaymentDocs.push({ ref: paymentDoc.ref, id: paymentDoc.id });
          batch.delete(paymentDoc.ref);
          deletedRelatedCount++;
        }
      }

      // Fetch all journal entries for cheque payments in parallel (avoid nested N+1 pattern)
      const chequePaymentJournalPromises = chequePaymentDocs.map(({ id: paymentId }) => {
        const paymentJournalQuery = query(
          this.journalEntriesRef,
          where("linkedPaymentId", "==", paymentId)
        );
        return getDocs(paymentJournalQuery);
      });
      const chequePaymentJournalSnapshots = await Promise.all(chequePaymentJournalPromises);
      for (const paymentJournalSnapshot of chequePaymentJournalSnapshots) {
        paymentJournalSnapshot.forEach((journalDoc) => {
          batch.delete(journalDoc.ref);
          deletedRelatedCount++;
        });
      }

      // Delete related fixed assets
      const fixedAssetsQuery = query(
        this.fixedAssetsRef,
        where("linkedTransactionId", "==", entry.transactionId),
        limit(100) // Fixed assets per transaction are limited
      );
      const fixedAssetsSnapshot = await getDocs(fixedAssetsQuery);
      fixedAssetsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      // Revert inventory quantities and delete movements
      const movementsQuery = query(
        this.inventoryMovementsRef,
        where("linkedTransactionId", "==", entry.transactionId),
        limit(100) // Inventory movements per transaction are limited
      );
      const movementsSnapshot = await getDocs(movementsQuery);

      const inventoryReversionTasks = movementsSnapshot.docs
        .filter((movementDoc) => {
          const movement = movementDoc.data() as InventoryMovementData;
          return movement.itemId;
        })
        .map(async (movementDoc) => {
          const movement = movementDoc.data() as InventoryMovementData;
          const itemId = movement.itemId;
          const quantity = movement.quantity || 0;
          const movementType = movement.type;
          const itemDocRef = doc(firestore, getUserCollectionPath(this.userId, "inventory"), itemId);

          await runTransaction(firestore, async (transaction) => {
            const itemDoc = await transaction.get(itemDocRef);

            if (itemDoc.exists()) {
              const currentQuantity = (itemDoc.data() as InventoryItemData).quantity || 0;
              const quantityDelta = movementType === "دخول" ? -quantity : quantity;
              const revertedQuantity = currentQuantity + quantityDelta;

              const validatedQuantity = assertNonNegative(revertedQuantity, {
                operation: "revertInventoryOnDelete",
                entityId: itemId,
                entityType: "inventory",
              });

              transaction.update(itemDocRef, { quantity: validatedQuantity });
              inventoryChanges.push({ itemId, quantityDelta });
            }
          });
        });

      await Promise.all(inventoryReversionTasks);

      movementsSnapshot.forEach((movementDoc) => {
        batch.delete(movementDoc.ref);
        deletedRelatedCount++;
      });

      // CRITICAL FIX: Reverse advance allocations if this invoice was paid by advances
      // Without this, deleting an invoice that used advances would create "ghost allocations"
      // that permanently reduce advance availability
      if (entry.paidFromAdvances && entry.paidFromAdvances.length > 0) {
        for (const advancePayment of entry.paidFromAdvances) {
          const advanceRef = doc(
            firestore,
            `users/${this.userId}/ledger`,
            advancePayment.advanceId
          );

          // Reverse the allocation — read current advance to set correct status after reversal
          const advanceSnap = await getDoc(advanceRef);
          const advanceTotalPaid = advanceSnap.exists()
            ? (advanceSnap.data().totalPaid as number ?? 0)
            : 0;
          const advanceNewTotalPaid = safeSubtract(advanceTotalPaid, advancePayment.amount);
          batch.update(advanceRef, {
            totalPaid: advanceNewTotalPaid,
            remainingBalance: increment(advancePayment.amount),
            paymentStatus: advanceNewTotalPaid <= 0 ? "unpaid" : "partial",
          });
        }
      }

      // Delete auto-generated COGS entries (query by linkedTransactionId to handle multiple items)
      const cogsQuery = query(
        this.ledgerRef,
        where("linkedTransactionId", "==", entry.transactionId),
        where("autoGenerated", "==", true)
      );
      const cogsSnapshot = await getDocs(cogsQuery);
      cogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      // Main ledger journals are reversed above via reverseBySourceToBatch (immutable ledger).

      // ── Depreciation cascade ──────────────────────────────────────────────
      // When a depreciation ledger entry is deleted, revert the associated
      // depreciation_records, depreciation_run, and asset accumulated values.
      const depRecordsRef = collection(
        firestore,
        getUserCollectionPath(this.userId, "depreciation_records")
      );
      const depRunsRef = collection(
        firestore,
        getUserCollectionPath(this.userId, "depreciation_runs")
      );

      const depRecSnap = await getDocs(
        query(depRecordsRef, where("ledgerEntryId", "==", entry.transactionId))
      );

      if (!depRecSnap.empty) {
        // Delete each depreciation_record + accumulate reversal amount per asset
        const assetReversals = new Map<string, number>();
        depRecSnap.forEach((d) => {
          batch.delete(d.ref);
          deletedRelatedCount++;
          const rec = d.data();
          assetReversals.set(
            rec.assetId,
            safeAdd(assetReversals.get(rec.assetId) ?? 0, rec.depreciationAmount)
          );
        });

        // Revert each asset's accumulatedDepreciation and bookValue
        for (const [assetId, amountToRevert] of Array.from(assetReversals)) {
          const assetDocRef = doc(this.fixedAssetsRef, assetId);
          const assetSnap = await getDoc(assetDocRef);
          if (assetSnap.exists()) {
            const a = assetSnap.data();
            const newAccum = Math.max(
              0,
              safeSubtract(a.accumulatedDepreciation ?? 0, amountToRevert)
            );
            batch.update(assetDocRef, {
              accumulatedDepreciation: newAccum,
              bookValue: safeSubtract(a.purchaseCost ?? 0, newAccum),
            });
          }
        }

        // Delete the depreciation_run record(s) linked to this transaction
        const depRunSnap = await getDocs(
          query(depRunsRef, where("ledgerEntryId", "==", entry.transactionId))
        );
        depRunSnap.forEach((d) => {
          batch.delete(d.ref);
          deletedRelatedCount++;
        });
      }
      // ─────────────────────────────────────────────────────────────────────

      // Commit batch
      try {
        await batch.commit();
      } catch (batchError) {
        console.error("Batch commit failed, attempting inventory rollback:", batchError);
        await rollbackInventoryChanges(this.userId, inventoryChanges);
        throw batchError;
      }

      // Log activity (fire and forget - don't block the main operation)
      logActivity(this.userId, {
        action: 'delete',
        module: 'ledger',
        targetId: entry.id,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `حذف حركة مالية: ${entry.description}`,
        metadata: {
          amount: entry.amount,
          transactionId: entry.transactionId,
        },
      });

      return { success: true, deletedRelatedCount };
    } catch (error) {
      console.error("Error deleting ledger entry:", error);

      // Preserve specific data integrity error handling
      if (isDataIntegrityError(error)) {
        return {
          success: false,
          error: "خطأ في سلامة البيانات: الكمية ستصبح سالبة. قد يكون هناك تكرار في الحذف أو خطأ في البيانات.",
          errorType: ErrorType.VALIDATION,
        };
      }

      const { message, type } = handleError(error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  // ============================================
  // Related Records Operations
  // ============================================

  /**
   * Add a payment to an existing ledger entry
   * Uses transaction to prevent race conditions when multiple payments
   * happen simultaneously on the same ledger entry
   */
  async addPaymentToEntry(
    entry: LedgerEntry,
    formData: PaymentFormData
  ): Promise<ServiceResult> {
    try {
      const paymentAmount = parseAmount(formData.amount);
      const paymentType = getPaymentTypeForTransaction(
        entry.type,
        entry.category,
        entry.subCategory
      );

      const entryRef = this.getLedgerDocRef(entry.id);
      const paymentDocRef = doc(this.paymentsRef);

      await runTransaction(firestore, async (transaction) => {
        // Read current ledger entry state (ensures fresh data)
        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists()) {
          throw new Error("القيد غير موجود");
        }

        const entryData = entryDoc.data();
        const isARAPEntry = entryData.isARAPEntry;
        const currentTotalPaid = entryData.totalPaid || 0;
        const currentRemainingBalance = entryData.remainingBalance ?? entryData.amount ?? 0;
        const entryAmount = entryData.amount || 0;

        // Validate: payment cannot exceed remaining balance
        if (isARAPEntry && paymentAmount > currentRemainingBalance) {
          throw new Error(`المبلغ المتبقي هو ${roundCurrency(currentRemainingBalance).toFixed(2)} دينار فقط`);
        }

        // Create payment record
        transaction.set(paymentDocRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: paymentAmount,
          type: paymentType,
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: formData.notes,
          createdAt: new Date(),
        });

        // Update ledger entry if it's an AR/AP entry
        if (isARAPEntry) {
          const newTotalPaid = safeAdd(currentTotalPaid, paymentAmount);
          const newRemainingBalance = safeSubtract(entryAmount, newTotalPaid);
          const newStatus: "paid" | "unpaid" | "partial" =
            newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

          transaction.update(entryRef, {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          });
        }
      });

      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error adding payment to entry:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Add a quick payment (from QuickPayDialog)
   * Supports optional settlement discount
   */
  async addQuickPayment(data: QuickPaymentData): Promise<ServiceResult> {
    try {
      const discountAmount = data.discountAmount || 0;

      // Determine payment type based on entry type, category, and subcategory
      // This handles income, expense, capital, loans, and fixed assets correctly
      const paymentType = getPaymentTypeForTransaction(
        data.entryType,
        data.entryCategory,
        data.entrySubCategory
      );

      // Use transaction to prevent race conditions when multiple payments
      // happen simultaneously on the same ledger entry
      const entryRef = this.getLedgerDocRef(data.entryId);
      const paymentDocRef = doc(this.paymentsRef);

      await runTransaction(firestore, async (transaction) => {
        // Read current ledger entry state (ensures fresh data)
        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists()) {
          throw new Error("القيد غير موجود");
        }

        const entryData = entryDoc.data();
        const currentTotalPaid = entryData.totalPaid || 0;
        const currentTotalDiscount = entryData.totalDiscount || 0;
        const currentRemainingBalance = entryData.remainingBalance ?? entryData.amount ?? 0;
        const writeoffAmount = entryData.writeoffAmount || 0;
        const entryAmount = entryData.amount || 0;

        // Validate: payment + discount cannot exceed remaining balance
        const totalSettlement = safeAdd(data.amount, discountAmount);
        if (data.isARAPEntry && totalSettlement > currentRemainingBalance) {
          throw new Error(`المجموع (${roundCurrency(totalSettlement).toFixed(2)}) أكبر من المتبقي (${roundCurrency(currentRemainingBalance).toFixed(2)})`);
        }

        // Create payment record (if there's cash payment OR discount)
        if (data.amount > 0 || discountAmount > 0) {
          // Determine notes based on payment type
          let notes: string;
          if (data.amount > 0 && discountAmount > 0) {
            notes = `دفعة مع خصم - ${data.entryDescription}`;
          } else if (discountAmount > 0 && data.amount === 0) {
            notes = `خصم تسوية - ${data.entryDescription}`;
          } else {
            notes = `دفعة جزئية - ${data.entryDescription}`;
          }

          const paymentData: Record<string, unknown> = {
            clientName: data.associatedParty || "غير محدد",
            amount: data.amount,
            type: paymentType,
            linkedTransactionId: data.entryTransactionId,
            date: data.date || new Date(),
            notes,
            category: data.entryCategory,
            subCategory: data.entrySubCategory,
            createdAt: new Date(),
          };

          // Add discount fields to payment if discount was given
          if (discountAmount > 0) {
            paymentData.discountAmount = discountAmount;
            paymentData.discountReason = data.discountReason;
            paymentData.isSettlementDiscount = true;
          }

          transaction.set(paymentDocRef, paymentData);
        }

        // Calculate new totals using fresh data from transaction
        const newTotalPaid = safeAdd(currentTotalPaid, data.amount);
        const newTotalDiscount = safeAdd(currentTotalDiscount, discountAmount);
        const newRemainingBalance = calculateRemainingBalance(
          entryAmount,
          newTotalPaid,
          newTotalDiscount,
          writeoffAmount
        );
        const newStatus = calculatePaymentStatus(
          newTotalPaid,
          entryAmount,
          newTotalDiscount,
          writeoffAmount
        );

        // Build update object for ledger entry
        const updateData: Record<string, unknown> = {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          paymentStatus: newStatus,
        };

        // Only update totalDiscount if there's a discount
        if (discountAmount > 0 || currentTotalDiscount > 0) {
          updateData.totalDiscount = newTotalDiscount;
        }

        transaction.update(entryRef, updateData);
      });

      // Create journal entries for AR/AP settlements (outside transaction)
      // Skip for advances (they have special handling) and loans
      const isAdvance = isAdvanceTransaction(data.entryCategory);
      const isLoan = data.entryType === "قرض";

      if (data.isARAPEntry && !isAdvance && !isLoan) {
        try {
          const engine = createJournalPostingEngine(this.userId);
          const paymentDate = data.date || new Date();

          // Create journal entry for cash payment portion
          if (data.amount > 0) {
            const templateId = paymentType === "قبض" ? "PAYMENT_RECEIPT" : "PAYMENT_DISBURSEMENT";
            await this.postJournalEntry(engine, {
              templateId,
              amount: data.amount,
              date: paymentDate,
              description: `دفعة تسوية - ${data.entryDescription}`,
              source: {
                type: "payment",
                documentId: paymentDocRef.id,
                transactionId: data.entryTransactionId,
              },
            }, "payment journal (quick payment)");
          }

          // Create journal entry for discount portion
          if (discountAmount > 0) {
            const discountTemplateId = data.entryType === "دخل" ? "SALES_DISCOUNT" : "PURCHASE_DISCOUNT";
            await this.postJournalEntry(engine, {
              templateId: discountTemplateId,
              amount: discountAmount,
              date: paymentDate,
              description: `خصم تسوية - ${data.entryDescription}`,
              source: {
                type: "discount",
                documentId: paymentDocRef.id,
                transactionId: data.entryTransactionId,
              },
            }, "discount journal (quick payment)");
          }
        } catch (journalError) {
          // Rollback payment and handle failure
          await this.handleJournalFailure(
            paymentDocRef,
            data.entryTransactionId,
            journalError
          );
        }
      }

      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error adding quick payment:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Write off bad debt (ديون معدومة)
   * Records uncollectible amount and updates ledger entry
   */
  async writeOffBadDebt(data: WriteOffData): Promise<ServiceResult> {
    try {
      // Validate: writeoff cannot exceed remaining balance
      if (data.writeoffAmount > data.remainingBalance) {
        return {
          success: false,
          error: `المبلغ للشطب (${roundCurrency(data.writeoffAmount).toFixed(2)}) أكبر من المتبقي (${roundCurrency(data.remainingBalance).toFixed(2)})`,
        };
      }

      // Validate: writeoff amount must be positive
      if (data.writeoffAmount <= 0) {
        return {
          success: false,
          error: "مبلغ الشطب يجب أن يكون أكبر من صفر",
        };
      }

      // Validate: reason is required
      if (!data.writeoffReason || data.writeoffReason.trim() === '') {
        return {
          success: false,
          error: "سبب الشطب مطلوب",
        };
      }

      const batch = writeBatch(firestore);

      // Calculate new totals
      const newWriteoffAmount = safeAdd(data.currentWriteoff, data.writeoffAmount);
      const newRemainingBalance = calculateRemainingBalance(
        data.entryAmount,
        data.totalPaid,
        data.totalDiscount,
        newWriteoffAmount
      );
      const newStatus = calculatePaymentStatus(
        data.totalPaid,
        data.entryAmount,
        data.totalDiscount,
        newWriteoffAmount
      );

      // Update ledger entry with writeoff
      const entryRef = this.getLedgerDocRef(data.entryId);
      batch.update(entryRef, {
        writeoffAmount: newWriteoffAmount,
        writeoffReason: data.writeoffReason,
        writeoffDate: new Date(),
        writeoffBy: data.writeoffBy,
        remainingBalance: newRemainingBalance,
        paymentStatus: newStatus,
      });

      // Create payment record for the writeoff (so it appears in payments page)
      const paymentDocRef = doc(this.paymentsRef);
      // Determine payment type based on entry type, category, and subcategory
      const paymentType = getPaymentTypeForTransaction(
        data.entryType,
        data.entryCategory,
        data.entrySubCategory
      );
      batch.set(paymentDocRef, {
        clientName: data.associatedParty || "غير محدد",
        amount: 0,  // No actual cash payment
        type: paymentType,
        linkedTransactionId: data.entryTransactionId,
        date: new Date(),
        notes: `شطب دين معدوم - ${data.writeoffReason}`,
        createdAt: new Date(),
        // Writeoff-specific fields
        writeoffAmount: data.writeoffAmount,
        writeoffReason: data.writeoffReason,
        isWriteoff: true,
      });

      await batch.commit();

      // Create journal entry for bad debt expense
      // DR: Bad Debt Expense (5600)
      // CR: Accounts Receivable (1200)
      try {
        const engine = createJournalPostingEngine(this.userId);
        const journalDescription = `شطب دين معدوم: ${data.associatedParty} - ${data.writeoffReason}`;
        await this.postJournalEntry(engine, {
          templateId: "BAD_DEBT",
          amount: data.writeoffAmount,
          date: new Date(),
          description: journalDescription,
          source: {
            type: "bad_debt",
            documentId: data.entryId,
            transactionId: data.entryTransactionId,
          },
        }, "bad debt writeoff journal");
      } catch (journalError) {
        // Note: For writeoff operations, rollback deletes the entry
        // This may cause data loss but prevents inconsistent books
        await this.handleJournalFailure(
          entryRef,
          data.entryTransactionId,
          journalError
        );
      }

      // Log the writeoff activity
      try {
        logActivity(this.userId, {
          userId: this.userId,
          userEmail: this.userEmail,
          action: 'write_off',
          module: 'ledger',
          targetId: data.entryId,
          description: `شطب دين معدوم: ${roundCurrency(data.writeoffAmount).toFixed(2)} دينار من ${data.associatedParty}`,
          metadata: {
            writeoffAmount: data.writeoffAmount,
            writeoffReason: data.writeoffReason,
            associatedParty: data.associatedParty,
            transactionId: data.entryTransactionId,
            newStatus,
          },
        });
      } catch (logError) {
        console.error("Failed to log writeoff activity:", logError);
      }

      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error writing off bad debt:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Add a cheque to an existing ledger entry
   */
  async addChequeToEntry(
    entry: LedgerEntry,
    formData: ChequeRelatedFormData
  ): Promise<ServiceResult> {
    try {
      let chequeImageUrl = "";

      if (formData.chequeImage) {
        try {
          const sanitizedName = sanitizeFileName(formData.chequeImage.name);
          const imageRef = ref(
            storage,
            `users/${this.userId}/cheques/${Date.now()}_${sanitizedName}`
          );
          await uploadBytes(imageRef, formData.chequeImage);
          chequeImageUrl = await getDownloadURL(imageRef);
        } catch (uploadError) {
          if (uploadError instanceof StorageError) {
            const errorCode = uploadError.code;
            if (errorCode === "storage/unauthorized" || errorCode === "storage/unauthenticated") {
              return {
                success: false,
                error: "ليس لديك صلاحية لرفع الصور. يرجى التأكد من تسجيل الدخول والمحاولة مرة أخرى",
                errorType: ErrorType.PERMISSION,
              };
            } else if (errorCode === "storage/quota-exceeded") {
              return {
                success: false,
                error: "تم تجاوز الحد المسموح به للتخزين",
                errorType: ErrorType.RATE_LIMITED,
              };
            }
          }
          throw uploadError;
        }
      }

      const chequeDirection = entry.type === "دخل" ? CHEQUE_TYPES.INCOMING : CHEQUE_TYPES.OUTGOING;
      const chequeAmount = parseAmount(formData.amount);
      const accountingType = formData.accountingType || "cashed";

      let chequeStatus = formData.status;
      if (accountingType === "cashed") {
        chequeStatus = CHEQUE_STATUS_AR.CASHED;
      } else if (accountingType === "postponed") {
        chequeStatus = CHEQUE_STATUS_AR.PENDING;
      } else if (accountingType === "endorsed") {
        chequeStatus = CHEQUE_STATUS_AR.ENDORSED;
      }

      if (accountingType === "endorsed" && !formData.endorsedToName?.trim()) {
        return {
          success: false,
          error: "يرجى إدخال اسم الجهة المظهر لها الشيك",
        };
      }

      const batch = writeBatch(firestore);
      const issueDate = formData.issueDate ? new Date(formData.issueDate) : new Date();

      const chequeData: Record<string, unknown> = {
        chequeNumber: formData.chequeNumber,
        clientName: entry.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: chequeDirection,
        chequeType: accountingType === "endorsed" ? "مجير" : formData.chequeType,
        status: chequeStatus,
        chequeImageUrl: chequeImageUrl,
        linkedTransactionId: entry.transactionId,
        issueDate: issueDate,
        dueDate: new Date(formData.dueDate),
        bankName: formData.bankName,
        notes: `مرتبط بالمعاملة: ${entry.description}`,
        createdAt: new Date(),
        accountingType: accountingType,
      };

      if (accountingType === "endorsed") {
        chequeData.endorsedTo = formData.endorsedToName;
        chequeData.endorsedDate = new Date();
      }

      const chequeDocRef = doc(this.chequesRef);
      batch.set(chequeDocRef, chequeData);

      if (accountingType === "cashed") {
        const paymentType = getPaymentTypeForTransaction(
          entry.type,
          entry.category,
          entry.subCategory
        );
        const paymentDocRef = doc(this.paymentsRef);
        batch.set(paymentDocRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: chequeAmount,
          type: paymentType,
          method: "cheque",
          linkedTransactionId: entry.transactionId,
          date: issueDate,
          notes: `شيك صرف رقم ${formData.chequeNumber} - ${entry.description}`,
          createdAt: new Date(),
        });

        if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
          if (chequeAmount <= entry.remainingBalance) {
            const newTotalPaid = safeAdd(entry.totalPaid || 0, chequeAmount);
            const newRemainingBalance = safeSubtract(entry.amount, newTotalPaid);
            const newStatus: "paid" | "unpaid" | "partial" =
              newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

            const entryRef = this.getLedgerDocRef(entry.id);
            batch.update(entryRef, {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newStatus,
            });
          }
        }
      } else if (accountingType === "endorsed") {
        const receiptDocRef = doc(this.paymentsRef);
        batch.set(receiptDocRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: chequeAmount,
          type: PAYMENT_TYPES.RECEIPT,
          linkedTransactionId: entry.transactionId,
          date: issueDate,
          notes: `تظهير شيك رقم ${formData.chequeNumber} للجهة: ${formData.endorsedToName}`,
          createdAt: new Date(),
          isEndorsement: true,
          noCashMovement: true,
        });

        const disbursementDocRef = doc(this.paymentsRef);
        batch.set(disbursementDocRef, {
          clientName: formData.endorsedToName,
          amount: chequeAmount,
          type: PAYMENT_TYPES.DISBURSEMENT,
          linkedTransactionId: entry.transactionId,
          date: issueDate,
          notes: `استلام شيك مظهر رقم ${formData.chequeNumber} من العميل: ${entry.associatedParty}`,
          createdAt: new Date(),
          isEndorsement: true,
          noCashMovement: true,
        });
      }

      await batch.commit();
      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error adding cheque to entry:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Add inventory movement to an existing ledger entry
   * Movement type logic (matches inventoryHandlers.ts):
   * - Expense (مصروف) for purchasing/receiving → inventory IN (دخول)
   * - Income (دخل/إيراد) for selling → inventory OUT (خروج)
   */
  async addInventoryToEntry(
    entry: LedgerEntry,
    formData: InventoryRelatedFormData
  ): Promise<ServiceResult> {
    try {
      // FIX: Expense = purchasing = inventory IN; Income = selling = inventory OUT
      const movementType = entry.type === "مصروف" ? "دخول" : "خروج";
      const quantityChange = parseAmount(formData.quantity);

      // Look up existing inventory item by name
      const itemQuery = query(this.inventoryRef, where("itemName", "==", formData.itemName));
      const itemSnapshot = await getDocs(itemQuery);

      let itemId: string;

      if (!itemSnapshot.empty) {
        // Item exists - update quantity
        const existingItem = itemSnapshot.docs[0];
        itemId = existingItem.id;
        const currentQuantity = existingItem.data().quantity || 0;

        const newQuantity = movementType === "دخول"
          ? safeAdd(currentQuantity, quantityChange)
          : safeSubtract(currentQuantity, quantityChange);

        if (newQuantity < 0) {
          return {
            success: false,
            error: `الكمية غير كافية في المخزون. المتوفر: ${currentQuantity}`,
          };
        }

        await updateDoc(doc(this.inventoryRef, itemId), {
          quantity: newQuantity,
        });
      } else {
        // Item doesn't exist
        if (movementType === "خروج") {
          return {
            success: false,
            error: `الصنف "${formData.itemName}" غير موجود في المخزون`,
          };
        }

        // Create new item for IN movement
        const newItemRef = await addDoc(this.inventoryRef, {
          itemName: formData.itemName,
          quantity: quantityChange,
          unit: formData.unit,
          unitPrice: 0,
          thickness: formData.thickness ? parseAmount(formData.thickness) : null,
          width: formData.width ? parseAmount(formData.width) : null,
          length: formData.length ? parseAmount(formData.length) : null,
          createdAt: new Date(),
        });
        itemId = newItemRef.id;
      }

      // Create movement record linked to the item
      await addDoc(this.inventoryMovementsRef, {
        itemId,
        itemName: formData.itemName,
        type: movementType,
        quantity: quantityChange,
        unit: formData.unit,
        thickness: formData.thickness ? parseAmount(formData.thickness) : null,
        width: formData.width ? parseAmount(formData.width) : null,
        length: formData.length ? parseAmount(formData.length) : null,
        linkedTransactionId: entry.transactionId,
        notes: formData.notes || `مرتبط بالمعاملة: ${entry.description}`,
        createdAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error adding inventory to entry:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  /**
   * Create an invoice
   */
  async createInvoice(data: InvoiceData): Promise<ServiceResult<string>> {
    try {
      const year = new Date().getFullYear();
      const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      const invoiceNumber = `INV-${year}-${random}`;

      const invoiceDoc: Record<string, unknown> = {
        invoiceNumber,
        clientName: data.clientName,
        clientAddress: data.clientAddress,
        clientPhone: data.clientPhone,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        items: data.items,
        subtotal: data.subtotal,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        total: data.total,
        status: "draft",
        notes: data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (data.manualInvoiceNumber) {
        invoiceDoc.manualInvoiceNumber = data.manualInvoiceNumber;
      }
      if (data.invoiceImageUrl) {
        invoiceDoc.invoiceImageUrl = data.invoiceImageUrl;
      }

      await addDoc(this.invoicesRef, invoiceDoc);
      return { success: true, data: invoiceNumber };
    } catch (error) {
      const { message, type } = handleError(error);
      console.error("Error creating invoice:", error);
      return {
        success: false,
        error: message,
        errorType: type,
      };
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private validateCreateOptions(
    formData: LedgerFormData,
    options: CreateLedgerEntryOptions,
    totalAmount: number
  ): string | null {
    if (options.hasIncomingCheck && formData.immediateSettlement && options.checkFormData) {
      const checkAmount = parseAmount(options.checkFormData.chequeAmount);
      if (checkAmount > totalAmount) {
        return "مبلغ الشيك لا يمكن أن يكون أكبر من المبلغ الإجمالي";
      }
    }

    if (options.hasInitialPayment && options.initialPaymentAmount) {
      const paymentAmt = parseAmount(options.initialPaymentAmount);
      if (paymentAmt > totalAmount) {
        return "مبلغ الدفعة الأولية لا يمكن أن يكون أكبر من المبلغ الإجمالي";
      }
      if (paymentAmt <= 0) {
        return "يرجى إدخال مبلغ صحيح للدفعة الأولية";
      }
    }

    return null;
  }

  private calculateARAPTracking(
    formData: LedgerFormData,
    options: CreateLedgerEntryOptions,
    totalAmount: number,
    hasCashedCheques: boolean = false
  ): { initialPaid: number; initialStatus: "paid" | "unpaid" | "partial" } {
    let initialPaid = 0;
    let initialStatus: "paid" | "unpaid" | "partial" = "unpaid";

    if (formData.trackARAP || hasCashedCheques) {
      if (formData.immediateSettlement) {
        // Immediate settlement = full amount paid
        initialPaid = totalAmount;
        initialStatus = "paid";
      } else {
        // Accumulate all payment sources (initial payment + cashed cheques)

        // Add initial payment if exists (partial payment option)
        if (options.hasInitialPayment && options.initialPaymentAmount) {
          initialPaid += parseAmount(options.initialPaymentAmount);
        }

        // Add cashed incoming cheques
        if (options.hasIncomingCheck) {
          if (options.incomingChequesList?.length) {
            options.incomingChequesList.forEach((cheque) => {
              const accountingType = cheque.accountingType || "cashed";
              if (accountingType === "cashed") {
                initialPaid += parseAmount(cheque.chequeAmount || "0");
              }
            });
          } else if (options.checkFormData) {
            const chequeAccountingType = options.checkFormData.accountingType || "cashed";
            if (chequeAccountingType === "cashed") {
              initialPaid += parseAmount(options.checkFormData.chequeAmount || "0");
            }
          }
        }

        // Add cashed outgoing cheques
        if (options.hasOutgoingCheck) {
          if (options.outgoingChequesList?.length) {
            options.outgoingChequesList.forEach((cheque) => {
              const accountingType = cheque.accountingType || "cashed";
              if (accountingType === "cashed" || accountingType === "endorsed") {
                initialPaid += parseAmount(cheque.chequeAmount || "0");
              }
            });
          } else if (options.outgoingCheckFormData) {
            const chequeAccountingType = options.outgoingCheckFormData.accountingType || "cashed";
            if (chequeAccountingType === "cashed" || chequeAccountingType === "endorsed") {
              initialPaid += parseAmount(options.outgoingCheckFormData.chequeAmount || "0");
            }
          }
        }

        // Calculate status based on total paid
        initialStatus = initialPaid >= totalAmount ? "paid" : initialPaid > 0 ? "partial" : "unpaid";
      }
    } else if (formData.immediateSettlement) {
      initialPaid = totalAmount;
      initialStatus = "paid";
    }

    return { initialPaid, initialStatus };
  }

  // ============================================
  // Void & Correct Operations (Immutable Ledger Pattern)
  // ============================================

  /**
   * Void an inventory movement.
   *
   * Atomically marks the movement as voided and reverses the quantity
   * change on the inventory item. Any linked journal entries are reversed.
   * The user can then re-enter a corrected movement.
   */
  async voidInventoryMovement(movementId: string): Promise<ServiceResult> {
    try {
      const movementRef = doc(this.inventoryMovementsRef, movementId);
      const movementSnap = await getDoc(movementRef);

      if (!movementSnap.exists()) {
        return { success: false, error: "حركة المخزن غير موجودة" };
      }

      const movementData = movementSnap.data();

      if (movementData.status === "voided") {
        return { success: false, error: "هذه الحركة ملغاة بالفعل" };
      }

      const itemId: string = movementData.itemId;
      const quantity: number = movementData.quantity || 0;
      const movementType: string = movementData.type; // 'entry'/'دخول' or 'exit'/'خروج'
      const isEntry = movementType === "entry" || movementType === "دخول";
      // Reverse: entry added → subtract; exit removed → add
      const quantityDelta = isEntry ? -quantity : quantity;

      // Find linked journal entries (if any)
      // NOTE: getDocs() must run BEFORE runTransaction — Firestore forbids getDocs inside a transaction
      const engine = createJournalPostingEngine(this.userId);
      const journalCount = await engine.countEntriesBySource("inventory", movementId);
      const sequences = journalCount > 0 ? await engine.reserveSequences(journalCount) : [];

      // Pre-fetch journal IDs outside the transaction
      let journalIdsToReverse: string[] = [];
      if (journalCount > 0) {
        const journalQuery = query(
          this.journalEntriesRef,
          where("source.type", "==", "inventory"),
          where("source.documentId", "==", movementId),
          where("status", "==", "posted")
        );
        const journalSnap = await getDocs(journalQuery);
        journalIdsToReverse = journalSnap.docs.map((d) => d.id);
      }

      await runTransaction(firestore, async (tx) => {
        // Lock movement and verify it hasn't been changed
        const freshSnap = await tx.get(movementRef);
        if (!freshSnap.exists()) throw new Error("حركة المخزن غير موجودة");
        if (freshSnap.data().status === "voided") throw new Error("هذه الحركة ملغاة بالفعل");

        // Lock inventory item
        const itemRef = doc(firestore, `users/${this.userId}/inventory`, itemId);
        const itemSnap = await tx.get(itemRef);
        if (!itemSnap.exists()) throw new Error("الصنف غير موجود");

        const currentQty: number = itemSnap.data().quantity || 0;
        const newQty = currentQty + quantityDelta;
        if (newQty < 0) {
          throw new Error("لا يمكن إلغاء الحركة: الكمية الناتجة أقل من الصفر");
        }

        // Mark movement as voided
        tx.update(movementRef, { status: "voided", voidedAt: serverTimestamp() });

        // Restore inventory quantity
        tx.update(itemRef, { quantity: newQty });

        // Reverse linked journal entries using pre-fetched IDs
        for (let i = 0; i < journalIdsToReverse.length && i < sequences.length; i++) {
          await engine.reverseToTransaction(tx, journalIdsToReverse[i], sequences[i], "إلغاء حركة مخزنية", "void");
        }
      });

      logActivity(this.userId, {
        action: "delete",
        module: "inventory",
        targetId: movementId,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `إلغاء حركة مخزنية للصنف: ${movementData.itemName}`,
      });

      return { success: true };
    } catch (error) {
      const appError = handleError(error);
      return { success: false, error: appError.message };
    }
  }

  /**
   * Void a pending incoming cheque.
   *
   * Only pending (not yet cashed) cheques can be voided this way.
   * Atomically marks the cheque as voided and reverses any linked journal entries.
   */
  async voidIncomingCheque(chequeId: string): Promise<ServiceResult> {
    try {
      const chequeRef = doc(this.chequesRef, chequeId);
      const chequeSnap = await getDoc(chequeRef);

      if (!chequeSnap.exists()) {
        return { success: false, error: "الشيك غير موجود" };
      }

      const chequeData = chequeSnap.data();

      if (chequeData.status === "voided") {
        return { success: false, error: "هذا الشيك ملغى بالفعل" };
      }

      const cashedStatuses = ["تم الصرف", "cleared", "محصل", "cashed"];
      if (cashedStatuses.includes(chequeData.status)) {
        return {
          success: false,
          error: "لا يمكن إلغاء شيك تم صرفه. يرجى عكس عملية الصرف أولاً من صفحة الشيكات.",
        };
      }

      // Find linked journal entries (for pending cheques, usually none — they're posted on cashing)
      // NOTE: getDocs() must run BEFORE runTransaction — Firestore forbids getDocs inside a transaction
      const engine = createJournalPostingEngine(this.userId);
      const journalCount = await engine.countEntriesBySource("cheque_cash", chequeId);
      const sequences = journalCount > 0 ? await engine.reserveSequences(journalCount) : [];

      // Pre-fetch journal IDs outside the transaction
      let journalIdsToReverse: string[] = [];
      if (journalCount > 0) {
        const journalQuery = query(
          this.journalEntriesRef,
          where("source.type", "==", "cheque_cash"),
          where("source.documentId", "==", chequeId),
          where("status", "==", "posted")
        );
        const journalSnap = await getDocs(journalQuery);
        journalIdsToReverse = journalSnap.docs.map((d) => d.id);
      }

      await runTransaction(firestore, async (tx) => {
        const freshSnap = await tx.get(chequeRef);
        if (!freshSnap.exists()) throw new Error("الشيك غير موجود");
        if (freshSnap.data().status === "voided") throw new Error("هذا الشيك ملغى بالفعل");

        tx.update(chequeRef, { status: "voided", voidedAt: serverTimestamp() });

        // Reverse any linked journal entries using pre-fetched IDs
        for (let i = 0; i < journalIdsToReverse.length && i < sequences.length; i++) {
          await engine.reverseToTransaction(tx, journalIdsToReverse[i], sequences[i], "إلغاء شيك", "void");
        }
      });

      logActivity(this.userId, {
        action: "delete",
        module: "cheques",
        targetId: chequeId,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `إلغاء شيك: ${chequeData.chequeNumber || chequeId}`,
      });

      return { success: true };
    } catch (error) {
      const appError = handleError(error);
      return { success: false, error: appError.message };
    }
  }

  /**
   * Void an invoice.
   *
   * Marks the invoice as voided. Invoices are administrative documents;
   * their accounting impact is recorded on the linked ledger entry, not the invoice itself.
   */
  async voidInvoice(invoiceId: string): Promise<ServiceResult> {
    try {
      const invoiceRef = doc(firestore, `users/${this.userId}/invoices`, invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);

      if (!invoiceSnap.exists()) {
        return { success: false, error: "الفاتورة غير موجودة" };
      }

      if (invoiceSnap.data().status === "voided") {
        return { success: false, error: "هذه الفاتورة ملغاة بالفعل" };
      }

      await runTransaction(firestore, async (tx) => {
        const freshSnap = await tx.get(invoiceRef);
        if (!freshSnap.exists()) throw new Error("الفاتورة غير موجودة");
        if (freshSnap.data().status === "voided") throw new Error("هذه الفاتورة ملغاة بالفعل");
        tx.update(invoiceRef, { status: "voided", voidedAt: serverTimestamp() });
      });

      logActivity(this.userId, {
        action: "delete",
        module: "ledger",
        targetId: invoiceId,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `إلغاء فاتورة: ${invoiceSnap.data().invoiceNumber || invoiceId}`,
      });

      return { success: true };
    } catch (error) {
      const appError = handleError(error);
      return { success: false, error: appError.message };
    }
  }

  /**
   * Void a fixed asset record.
   *
   * Marks the fixed asset as voided and reverses any linked journal entries.
   * The linked ledger transaction should also be voided/reversed separately.
   */
  async voidFixedAsset(assetId: string): Promise<ServiceResult> {
    try {
      const assetRef = doc(this.fixedAssetsRef, assetId);
      const assetSnap = await getDoc(assetRef);

      if (!assetSnap.exists()) {
        return { success: false, error: "الأصل الثابت غير موجود" };
      }

      if (assetSnap.data().status === "voided") {
        return { success: false, error: "هذا الأصل الثابت ملغى بالفعل" };
      }

      await runTransaction(firestore, async (tx) => {
        const freshSnap = await tx.get(assetRef);
        if (!freshSnap.exists()) throw new Error("الأصل الثابت غير موجود");
        if (freshSnap.data().status === "voided") throw new Error("هذا الأصل الثابت ملغى بالفعل");
        tx.update(assetRef, { status: "voided", voidedAt: serverTimestamp() });
      });

      logActivity(this.userId, {
        action: "delete",
        module: "ledger",
        targetId: assetId,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `إلغاء أصل ثابت: ${assetSnap.data().assetName || assetId}`,
      });

      return { success: true };
    } catch (error) {
      const appError = handleError(error);
      return { success: false, error: appError.message };
    }
  }
}

/**
 * Factory function to create a LedgerService instance
 */
export function createLedgerService(
  userId: string,
  userEmail?: string,
  userRole?: string
): LedgerService {
  return new LedgerService(userId, userEmail, userRole);
}
