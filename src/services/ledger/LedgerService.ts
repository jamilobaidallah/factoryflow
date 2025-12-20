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
  Unsubscribe,
  QueryConstraint,
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
import { getCategoryType, generateTransactionId } from "@/components/ledger/utils/ledger-helpers";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import {
  parseAmount,
  safeAdd,
  safeSubtract,
  roundCurrency,
} from "@/lib/currency";
import {
  assertNonNegative,
  isDataIntegrityError,
} from "@/lib/errors";
import {
  addJournalEntryToBatch,
  addCOGSJournalEntryToBatch,
} from "@/services/journalService";
import { handleError, ErrorType } from "@/lib/error-handling";
import { logActivity } from "@/services/activityLogService";
import {
  calculatePaymentStatus,
  calculateRemainingBalance,
} from "@/lib/arap-utils";

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
 * Sanitizes a filename by replacing spaces and special characters
 */
function sanitizeFileName(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : "";

  const sanitized = name
    .replace(/\s+/g, "_")
    .replace(/[^\w\-_.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return sanitized + ext.toLowerCase();
}

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
   * No pagination limit - fetches all entries sorted by date ascending
   */
  async getAllLedgerEntries(): Promise<LedgerEntry[]> {
    const q = query(this.ledgerRef, orderBy("date", "asc"));
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
        reference: formData.reference,
        notes: formData.notes,
        createdAt: new Date(),
      });

      // Add journal entry to batch (atomic with ledger entry)
      addJournalEntryToBatch(batch, this.userId, {
        transactionId,
        description: formData.description,
        amount,
        type: entryType,
        category: formData.category,
        subCategory: formData.subCategory,
        date: entryDate,
        isARAPEntry: false,
        immediateSettlement: false,
      });

      // Commit batch - both ledger and journal succeed or fail together
      try {
        await batch.commit();
      } catch (batchError) {
        const { message, type } = handleError(batchError);
        console.error("Failed to commit ledger entry with journal:", batchError);
        return {
          success: false,
          error: message,
          errorType: type,
        };
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

      // Add ledger entry
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
        reference: formData.reference,
        notes: formData.notes,
        createdAt: new Date(),
        ...(shouldTrackARAP && {
          isARAPEntry: true,
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
        handleImmediateSettlementBatch(ctx, totalAmount, paymentMethod);
      }

      // Handle initial payment
      if (options.hasInitialPayment && options.initialPaymentAmount && formData.trackARAP) {
        handleInitialPaymentBatch(ctx, parseFloat(options.initialPaymentAmount));
      }

      // Handle inventory update
      let inventoryResult: InventoryUpdateResult | null = null;
      if (options.hasInventoryUpdate && options.inventoryFormData) {
        inventoryResult = await handleInventoryUpdate(ctx, options.inventoryFormData);
        if (!inventoryResult.success) {
          return { success: false, error: inventoryResult.error };
        }
      }

      // Handle fixed asset
      if (options.hasFixedAsset && options.fixedAssetFormData) {
        handleFixedAssetBatch(ctx, options.fixedAssetFormData);
      }

      // Add journal entry to batch (atomic with ledger entry)
      addJournalEntryToBatch(batch, this.userId, {
        transactionId,
        description: formData.description,
        amount: totalAmount,
        type: entryType,
        category: formData.category,
        subCategory: formData.subCategory,
        date: new Date(formData.date),
        isARAPEntry: formData.trackARAP,
        immediateSettlement: formData.immediateSettlement,
      });

      // Add COGS journal entry to batch if applicable
      if (inventoryResult?.cogsCreated && inventoryResult.cogsAmount && inventoryResult.cogsDescription) {
        addCOGSJournalEntryToBatch(batch, this.userId, {
          description: inventoryResult.cogsDescription,
          amount: inventoryResult.cogsAmount,
          date: new Date(formData.date),
          linkedTransactionId: transactionId,
        });
      }

      // Commit batch - rollback inventory on failure
      try {
        await batch.commit();
      } catch (batchError) {
        if (inventoryResult?.inventoryChange) {
          console.error("Batch commit failed, attempting inventory rollback:", batchError);
          await rollbackInventoryChanges(this.userId, [inventoryResult.inventoryChange]);
        }
        const { message, type } = handleError(batchError);
        console.error("Failed to commit ledger entry with journal:", batchError);
        return {
          success: false,
          error: message,
          errorType: type,
        };
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
   */
  async updateLedgerEntry(
    entryId: string,
    formData: LedgerFormData
  ): Promise<ServiceResult> {
    try {
      const entryType = getCategoryType(formData.category, formData.subCategory);
      const entryRef = this.getLedgerDocRef(entryId);

      await updateDoc(entryRef, {
        description: formData.description,
        type: entryType,
        amount: parseFloat(formData.amount),
        category: formData.category,
        subCategory: formData.subCategory,
        associatedParty: formData.associatedParty,
        ownerName: formData.ownerName || "",
        date: new Date(formData.date),
        reference: formData.reference,
        notes: formData.notes,
      });

      // Log activity (fire and forget - don't block the main operation)
      logActivity(this.userId, {
        action: 'update',
        module: 'ledger',
        targetId: entryId,
        userId: this.userId,
        userEmail: this.userEmail,
        description: `تعديل حركة مالية: ${formData.description}`,
        metadata: {
          amount: parseFloat(formData.amount),
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
      const batch = writeBatch(firestore);
      let deletedRelatedCount = 0;

      // Delete the ledger entry
      const entryRef = this.getLedgerDocRef(entry.id);
      batch.delete(entryRef);

      // Delete related payments
      const paymentsQuery = query(
        this.paymentsRef,
        where("linkedTransactionId", "==", entry.transactionId)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      // Delete related cheques
      const chequesQuery = query(
        this.chequesRef,
        where("linkedTransactionId", "==", entry.transactionId)
      );
      const chequesSnapshot = await getDocs(chequesQuery);
      chequesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      // Revert inventory quantities and delete movements
      const movementsQuery = query(
        this.inventoryMovementsRef,
        where("linkedTransactionId", "==", entry.transactionId)
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

      // Delete auto-generated COGS entries
      const cogsQuery = query(
        this.ledgerRef,
        where("transactionId", "==", `COGS-${entry.transactionId}`)
      );
      const cogsSnapshot = await getDocs(cogsQuery);
      cogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

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
   */
  async addPaymentToEntry(
    entry: LedgerEntry,
    formData: PaymentFormData
  ): Promise<ServiceResult> {
    try {
      const paymentAmount = parseAmount(formData.amount);

      if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
        if (paymentAmount > entry.remainingBalance) {
          return {
            success: false,
            error: `المبلغ المتبقي هو ${roundCurrency(entry.remainingBalance).toFixed(2)} دينار فقط`,
          };
        }
      }

      const paymentType = entry.type === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
      const batch = writeBatch(firestore);

      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: entry.associatedParty || "غير محدد",
        amount: paymentAmount,
        type: paymentType,
        linkedTransactionId: entry.transactionId,
        date: new Date(),
        notes: formData.notes,
        createdAt: new Date(),
      });

      if (entry.isARAPEntry) {
        const newTotalPaid = safeAdd(entry.totalPaid || 0, paymentAmount);
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

      await batch.commit();
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
      const totalSettlement = safeAdd(data.amount, discountAmount);

      // Validate: payment + discount cannot exceed remaining balance
      if (data.isARAPEntry && totalSettlement > data.remainingBalance) {
        return {
          success: false,
          error: `المجموع (${roundCurrency(totalSettlement).toFixed(2)}) أكبر من المتبقي (${roundCurrency(data.remainingBalance).toFixed(2)})`,
        };
      }

      const paymentType = data.entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
      const batch = writeBatch(firestore);

      // Create payment record (only if there's actual cash payment)
      if (data.amount > 0) {
        const paymentDocRef = doc(this.paymentsRef);
        const paymentData: Record<string, unknown> = {
          clientName: data.associatedParty || "غير محدد",
          amount: data.amount,
          type: paymentType,
          linkedTransactionId: data.entryTransactionId,
          date: data.date || new Date(),
          notes: discountAmount > 0
            ? `دفعة مع خصم - ${data.entryDescription}`
            : `دفعة جزئية - ${data.entryDescription}`,
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

        batch.set(paymentDocRef, paymentData);
      }

      // Calculate new totals using arap-utils functions
      const newTotalPaid = safeAdd(data.totalPaid, data.amount);
      const newTotalDiscount = safeAdd(data.totalDiscount || 0, discountAmount);
      const newRemainingBalance = calculateRemainingBalance(
        data.entryAmount,
        newTotalPaid,
        newTotalDiscount,
        0 // writeoffAmount
      );
      const newStatus = calculatePaymentStatus(
        newTotalPaid,
        data.entryAmount,
        newTotalDiscount,
        0 // writeoffAmount
      );

      // Build update object for ledger entry
      const updateData: Record<string, unknown> = {
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        paymentStatus: newStatus,
      };

      // Only update totalDiscount if there's a discount
      if (discountAmount > 0 || (data.totalDiscount || 0) > 0) {
        updateData.totalDiscount = newTotalDiscount;
      }

      const entryRef = this.getLedgerDocRef(data.entryId);
      batch.update(entryRef, updateData);

      await batch.commit();
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

      // TODO: Add journal entry for bad debt expense when journal service is extended
      // DR: Bad Debt Expense (5600)
      // CR: Accounts Receivable (1200)

      await batch.commit();

      // Log the writeoff activity
      try {
        logActivity(this.userId, {
          userId: this.userId,
          userEmail: this.userEmail,
          action: 'write_off',
          module: 'ledger',
          targetId: data.entryId,
          description: `شطب دين معدوم: ${data.writeoffAmount.toFixed(2)} دينار من ${data.associatedParty}`,
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
        const paymentType = entry.type === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
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
   */
  async addInventoryToEntry(
    entry: LedgerEntry,
    formData: InventoryRelatedFormData
  ): Promise<ServiceResult> {
    try {
      const movementType = entry.type === "مصروف" ? "خروج" : "دخول";
      await addDoc(this.inventoryMovementsRef, {
        itemId: "",
        itemName: formData.itemName,
        type: movementType,
        quantity: parseAmount(formData.quantity),
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
      const checkAmount = parseFloat(options.checkFormData.chequeAmount);
      if (checkAmount > totalAmount) {
        return "مبلغ الشيك لا يمكن أن يكون أكبر من المبلغ الإجمالي";
      }
    }

    if (options.hasInitialPayment && options.initialPaymentAmount) {
      const paymentAmt = parseFloat(options.initialPaymentAmount);
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
          initialPaid += parseFloat(options.initialPaymentAmount);
        }

        // Add cashed incoming cheques
        if (options.hasIncomingCheck) {
          if (options.incomingChequesList?.length) {
            options.incomingChequesList.forEach((cheque) => {
              const accountingType = cheque.accountingType || "cashed";
              if (accountingType === "cashed") {
                initialPaid += parseFloat(cheque.chequeAmount || "0");
              }
            });
          } else if (options.checkFormData) {
            const chequeAccountingType = options.checkFormData.accountingType || "cashed";
            if (chequeAccountingType === "cashed") {
              initialPaid += parseFloat(options.checkFormData.chequeAmount || "0");
            }
          }
        }

        // Add cashed outgoing cheques
        if (options.hasOutgoingCheck) {
          if (options.outgoingChequesList?.length) {
            options.outgoingChequesList.forEach((cheque) => {
              const accountingType = cheque.accountingType || "cashed";
              if (accountingType === "cashed" || accountingType === "endorsed") {
                initialPaid += parseFloat(cheque.chequeAmount || "0");
              }
            });
          } else if (options.outgoingCheckFormData) {
            const chequeAccountingType = options.outgoingCheckFormData.accountingType || "cashed";
            if (chequeAccountingType === "cashed" || chequeAccountingType === "endorsed") {
              initialPaid += parseFloat(options.outgoingCheckFormData.chequeAmount || "0");
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
