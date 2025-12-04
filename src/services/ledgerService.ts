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
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  onSnapshot,
  DocumentSnapshot,
  Unsubscribe,
  WriteBatch,
  CollectionReference,
  QueryConstraint,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, StorageError } from "firebase/storage";
import type {
  LedgerEntry,
  LedgerFormData,
  CheckFormData,
  OutgoingCheckFormData,
  InventoryFormData,
  FixedAssetFormData,
  PaymentFormData,
  ChequeRelatedFormData,
  InventoryRelatedFormData,
  InventoryMovementData,
  InventoryItemData,
} from "@/components/ledger/types/ledger";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { getCategoryType, generateTransactionId } from "@/components/ledger/utils/ledger-helpers";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import { calculateWeightedAverageCost, calculateLandedCostUnitPrice } from "@/lib/inventory-utils";
import {
  parseAmount,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  sumAmounts,
  roundCurrency
} from "@/lib/currency";
import { assertNonNegative, isDataIntegrityError } from "@/lib/errors";
import { createJournalEntryForLedger, createJournalEntryForCOGS } from "@/services/journalService";

// Collection path helpers
const getUserCollectionPath = (userId: string, collectionName: string) =>
  `users/${userId}/${collectionName}`;

/**
 * Sanitizes a filename by replacing spaces and special characters
 * with underscores to prevent URL encoding issues in Firebase Storage
 */
function sanitizeFileName(filename: string): string {
  // Get file extension
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';

  // Replace spaces and special characters with underscores
  const sanitized = name
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/[^\w\-_.]/g, '_')     // Replace other special chars with underscores
    .replace(/_+/g, '_')            // Collapse multiple underscores
    .replace(/^_|_$/g, '');         // Trim leading/trailing underscores

  return sanitized + ext.toLowerCase();
}

// Result types for service methods
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DeleteResult extends ServiceResult {
  deletedRelatedCount?: number;
}

export interface InventoryUpdateResult extends ServiceResult {
  cogsCreated?: boolean;
  cogsAmount?: number;
  cogsDescription?: string;
}

export interface CreateLedgerEntryOptions {
  hasIncomingCheck?: boolean;
  checkFormData?: CheckFormData;
  hasOutgoingCheck?: boolean;
  outgoingCheckFormData?: OutgoingCheckFormData;
  // Multiple cheques support
  incomingChequesList?: CheckFormData[];
  outgoingChequesList?: OutgoingCheckFormData[];
  hasInventoryUpdate?: boolean;
  inventoryFormData?: InventoryFormData;
  hasFixedAsset?: boolean;
  fixedAssetFormData?: FixedAssetFormData;
  hasInitialPayment?: boolean;
  initialPaymentAmount?: string;
}

export interface QuickPaymentData {
  amount: number;
  entryId: string;
  entryTransactionId: string;
  entryType: string;
  entryAmount: number;
  entryDescription: string;
  entryCategory: string;
  entrySubCategory: string;
  associatedParty: string;
  totalPaid: number;
  remainingBalance: number;
  isARAPEntry: boolean;
  date?: Date;
}

export interface InvoiceData {
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  invoiceDate: Date;
  dueDate: Date;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    unit: string;
    length?: number;
    width?: number;
    thickness?: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string;
  manualInvoiceNumber?: string; // رقم فاتورة يدوي (ورقي)
  invoiceImageUrl?: string; // صورة الفاتورة الورقية (base64)
}

/**
 * LedgerService - Centralizes all ledger-related Firestore operations
 */
export class LedgerService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
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
    // Build query constraints
    const queryConstraints: QueryConstraint[] = [
      orderBy("date", "desc"),
      limit(pageSize)
    ];

    // Add cursor if provided (for pages > 1)
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

      const docRef = await addDoc(this.ledgerRef, {
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

      // Create corresponding journal entry (async, non-blocking)
      createJournalEntryForLedger(
        this.userId,
        transactionId,
        formData.description,
        amount,
        entryType,
        formData.category,
        formData.subCategory,
        entryDate,
        false, // isARAPEntry
        false  // immediateSettlement
      ).catch(err => console.error("Failed to create journal entry:", err));

      return { success: true, data: docRef.id };
    } catch (error) {
      console.error("Error creating simple ledger entry:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء حفظ الحركة المالية",
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

      // Calculate AR/AP tracking
      const { initialPaid, initialStatus } = this.calculateARAPTracking(
        formData,
        options,
        totalAmount
      );

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
        ...(formData.trackARAP && {
          isARAPEntry: true,
          totalPaid: initialPaid,
          remainingBalance: safeSubtract(totalAmount, initialPaid),
          paymentStatus: initialStatus,
        }),
      });

      // Handle incoming cheques (multiple cheques support)
      if (options.hasIncomingCheck && options.incomingChequesList && options.incomingChequesList.length > 0) {
        // New: Handle multiple cheques
        for (const chequeData of options.incomingChequesList) {
          this.handleIncomingCheckBatch(
            batch,
            transactionId,
            chequeData,
            formData,
            entryType
          );
        }
      } else if (options.hasIncomingCheck && options.checkFormData) {
        // Backwards compatibility: Handle single cheque
        this.handleIncomingCheckBatch(
          batch,
          transactionId,
          options.checkFormData,
          formData,
          entryType
        );
      }

      // Handle outgoing cheques (multiple cheques support)
      if (options.hasOutgoingCheck && options.outgoingChequesList && options.outgoingChequesList.length > 0) {
        // New: Handle multiple cheques
        for (const chequeData of options.outgoingChequesList) {
          this.handleOutgoingCheckBatch(
            batch,
            transactionId,
            chequeData,
            formData,
            entryType
          );
        }
      } else if (options.hasOutgoingCheck && options.outgoingCheckFormData) {
        // Backwards compatibility: Handle single cheque
        this.handleOutgoingCheckBatch(
          batch,
          transactionId,
          options.outgoingCheckFormData,
          formData,
          entryType
        );
      }

      // Handle immediate settlement
      if (formData.immediateSettlement) {
        const cashAmount =
          options.hasIncomingCheck && options.checkFormData
            ? safeSubtract(totalAmount, parseAmount(options.checkFormData.chequeAmount))
            : totalAmount;
        this.handleImmediateSettlementBatch(batch, transactionId, formData, entryType, cashAmount);
      }

      // Handle initial payment
      if (options.hasInitialPayment && options.initialPaymentAmount && formData.trackARAP) {
        this.handleInitialPaymentBatch(
          batch,
          transactionId,
          formData,
          entryType,
          parseFloat(options.initialPaymentAmount)
        );
      }

      // Handle inventory update
      let inventoryResult: InventoryUpdateResult | null = null;
      if (options.hasInventoryUpdate && options.inventoryFormData) {
        inventoryResult = await this.handleInventoryUpdateBatch(
          batch,
          transactionId,
          formData,
          entryType,
          options.inventoryFormData
        );
        if (!inventoryResult.success) {
          return { success: false, error: inventoryResult.error };
        }
      }

      // Handle fixed asset
      if (options.hasFixedAsset && options.fixedAssetFormData) {
        this.handleFixedAssetBatch(batch, transactionId, formData, options.fixedAssetFormData);
      }

      await batch.commit();

      // Create corresponding journal entry (async, non-blocking)
      createJournalEntryForLedger(
        this.userId,
        transactionId,
        formData.description,
        totalAmount,
        entryType,
        formData.category,
        formData.subCategory,
        new Date(formData.date),
        formData.trackARAP,
        formData.immediateSettlement
      ).catch(err => console.error("Failed to create journal entry:", err));

      // Create COGS journal entry if inventory was sold (DR COGS, CR Inventory)
      if (inventoryResult?.cogsCreated && inventoryResult.cogsAmount && inventoryResult.cogsAmount > 0 && inventoryResult.cogsDescription) {
        createJournalEntryForCOGS(
          this.userId,
          inventoryResult.cogsDescription,
          inventoryResult.cogsAmount,
          new Date(formData.date),
          transactionId
        ).catch(err => console.error("Failed to create COGS journal entry:", err));
      }

      return { success: true, data: ledgerDocRef.id };
    } catch (error) {
      console.error("Error creating ledger entry with related records:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء حفظ الحركة المالية",
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

      return { success: true };
    } catch (error) {
      console.error("Error updating ledger entry:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء تحديث الحركة المالية",
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
      console.error("Error updating AR/AP tracking:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء تحديث تتبع الذمم",
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
    try {
      const batch = writeBatch(firestore);
      let deletedRelatedCount = 0;

      // 1. Delete the ledger entry
      const entryRef = this.getLedgerDocRef(entry.id);
      batch.delete(entryRef);

      // 2. Delete related payments
      const paymentsQuery = query(
        this.paymentsRef,
        where("linkedTransactionId", "==", entry.transactionId)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      // 3. Delete related cheques
      const chequesQuery = query(
        this.chequesRef,
        where("linkedTransactionId", "==", entry.transactionId)
      );
      const chequesSnapshot = await getDocs(chequesQuery);
      chequesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      // 4. Revert inventory quantities and delete related movements
      const movementsQuery = query(
        this.inventoryMovementsRef,
        where("linkedTransactionId", "==", entry.transactionId)
      );
      const movementsSnapshot = await getDocs(movementsQuery);

      for (const movementDoc of movementsSnapshot.docs) {
        const movement = movementDoc.data() as InventoryMovementData;
        const itemId = movement.itemId;
        const quantity = movement.quantity || 0;
        const movementType = movement.type;

        if (itemId) {
          const itemQuery = query(this.inventoryRef, where("__name__", "==", itemId));
          const itemSnapshot = await getDocs(itemQuery);

          if (!itemSnapshot.empty) {
            const itemDoc = itemSnapshot.docs[0];
            const currentQuantity = (itemDoc.data() as InventoryItemData).quantity || 0;

            const revertedQuantity =
              movementType === "دخول"
                ? currentQuantity - quantity
                : currentQuantity + quantity;

            // Fail fast on negative inventory - this indicates data corruption
            const validatedQuantity = assertNonNegative(revertedQuantity, {
              operation: 'revertInventoryOnDelete',
              entityId: itemId,
              entityType: 'inventory'
            });

            const itemDocRef = doc(firestore, getUserCollectionPath(this.userId, "inventory"), itemId);
            batch.update(itemDocRef, { quantity: validatedQuantity });
          }
        }

        batch.delete(movementDoc.ref);
        deletedRelatedCount++;
      }

      // 5. Delete auto-generated COGS entries
      const cogsQuery = query(
        this.ledgerRef,
        where("transactionId", "==", `COGS-${entry.transactionId}`)
      );
      const cogsSnapshot = await getDocs(cogsQuery);
      cogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedRelatedCount++;
      });

      await batch.commit();

      return {
        success: true,
        deletedRelatedCount,
      };
    } catch (error) {
      console.error("Error deleting ledger entry:", error);

      if (isDataIntegrityError(error)) {
        return {
          success: false,
          error: "خطأ في سلامة البيانات: الكمية ستصبح سالبة. قد يكون هناك تكرار في الحذف أو خطأ في البيانات.",
        };
      }

      return {
        success: false,
        error: "حدث خطأ أثناء حذف الحركة المالية",
      };
    }
  }

  // ============================================
  // Related Records Operations
  // ============================================

  /**
   * Add a payment to an existing ledger entry
   * Uses atomic batch operation to ensure payment + ARAP update succeed or fail together
   */
  async addPaymentToEntry(
    entry: LedgerEntry,
    formData: PaymentFormData
  ): Promise<ServiceResult> {
    try {
      const paymentAmount = parseAmount(formData.amount);

      // Validate payment amount
      if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
        if (paymentAmount > entry.remainingBalance) {
          return {
            success: false,
            error: `المبلغ المتبقي هو ${roundCurrency(entry.remainingBalance).toFixed(2)} دينار فقط`,
          };
        }
      }

      const paymentType = entry.type === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;

      // Use atomic batch for payment + ARAP update
      const batch = writeBatch(firestore);

      // Add payment document
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

      // Update ledger entry AR/AP tracking if enabled (in same batch)
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

      // Commit atomically - both succeed or both fail
      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error("Error adding payment to entry:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء إضافة الدفعة",
      };
    }
  }

  /**
   * Add a quick payment (from QuickPayDialog)
   * Uses atomic batch operation to ensure payment + ARAP update succeed or fail together
   */
  async addQuickPayment(data: QuickPaymentData): Promise<ServiceResult> {
    try {
      // Validate payment amount
      if (data.isARAPEntry && data.amount > data.remainingBalance) {
        return {
          success: false,
          error: `المبلغ المتبقي هو ${roundCurrency(data.remainingBalance).toFixed(2)} دينار فقط`,
        };
      }

      const paymentType = data.entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;

      // Use atomic batch for payment + ARAP update
      const batch = writeBatch(firestore);

      // Add payment record
      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: data.associatedParty || "غير محدد",
        amount: data.amount,
        type: paymentType,
        linkedTransactionId: data.entryTransactionId,
        date: data.date || new Date(),
        notes: `دفعة جزئية - ${data.entryDescription}`,
        category: data.entryCategory,
        subCategory: data.entrySubCategory,
        createdAt: new Date(),
      });

      // Update ledger entry AR/AP tracking (in same batch)
      const newTotalPaid = safeAdd(data.totalPaid, data.amount);
      const newRemainingBalance = safeSubtract(data.entryAmount, newTotalPaid);
      const newStatus: "paid" | "unpaid" | "partial" =
        newRemainingBalance === 0 ? "paid" : newRemainingBalance < data.entryAmount ? "partial" : "unpaid";

      const entryRef = this.getLedgerDocRef(data.entryId);
      batch.update(entryRef, {
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        paymentStatus: newStatus,
      });

      // Commit atomically - both succeed or both fail
      await batch.commit();

      return { success: true };
    } catch {
      return {
        success: false,
        error: "حدث خطأ أثناء إضافة الدفعة",
      };
    }
  }

  /**
   * Add a cheque to an existing ledger entry
   * Uses atomic batch operation to ensure cheque + payments + ARAP update succeed or fail together
   */
  async addChequeToEntry(
    entry: LedgerEntry,
    formData: ChequeRelatedFormData
  ): Promise<ServiceResult> {
    try {
      let chequeImageUrl = "";

      // Upload cheque image if provided (external storage - before batch)
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
          // Handle storage-specific errors
          if (uploadError instanceof StorageError) {
            const errorCode = uploadError.code;
            if (errorCode === 'storage/unauthorized' || errorCode === 'storage/unauthenticated') {
              return {
                success: false,
                error: "ليس لديك صلاحية لرفع الصور. يرجى التأكد من تسجيل الدخول والمحاولة مرة أخرى",
              };
            } else if (errorCode === 'storage/quota-exceeded') {
              return {
                success: false,
                error: "تم تجاوز الحد المسموح به للتخزين",
              };
            }
          }
          // Re-throw for generic error handling
          throw uploadError;
        }
      }

      const chequeDirection = entry.type === "دخل" ? CHEQUE_TYPES.INCOMING : CHEQUE_TYPES.OUTGOING;
      const chequeAmount = parseAmount(formData.amount);
      const accountingType = formData.accountingType || "cashed";

      // Determine the correct status based on accounting type
      let chequeStatus = formData.status;
      if (accountingType === "cashed") {
        chequeStatus = CHEQUE_STATUS_AR.CASHED;
      } else if (accountingType === "postponed") {
        chequeStatus = CHEQUE_STATUS_AR.PENDING;
      } else if (accountingType === "endorsed") {
        chequeStatus = CHEQUE_STATUS_AR.ENDORSED;
      }

      // Validate endorsee name for endorsed cheques
      if (accountingType === "endorsed" && !formData.endorsedToName?.trim()) {
        return {
          success: false,
          error: "يرجى إدخال اسم الجهة المظهر لها الشيك",
        };
      }

      // Use atomic batch for all Firestore operations
      const batch = writeBatch(firestore);

      // Create the cheque record
      // Use the issueDate from form if provided, otherwise use current date
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

      // Handle different accounting flows
      if (accountingType === "cashed") {
        // Create payment record - use issueDate for the payment date
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

        // Update AR/AP tracking (in same batch)
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
        // Create two payment records with noCashMovement flag - use issueDate
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
      // For postponed, no payment record is created - just the cheque

      // Commit atomically - all operations succeed or all fail
      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error("Error adding cheque to entry:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء إضافة الشيك",
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
      console.error("Error adding inventory to entry:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء إضافة حركة المخزون",
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
      // Only save optional fields if they have values
      if (data.manualInvoiceNumber) {
        invoiceDoc.manualInvoiceNumber = data.manualInvoiceNumber;
      }
      if (data.invoiceImageUrl) {
        invoiceDoc.invoiceImageUrl = data.invoiceImageUrl;
      }
      const docRef = await addDoc(this.invoicesRef, invoiceDoc);

      return { success: true, data: invoiceNumber };
    } catch (error) {
      console.error("Error creating invoice:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء إنشاء الفاتورة",
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
    totalAmount: number
  ): { initialPaid: number; initialStatus: "paid" | "unpaid" | "partial" } {
    let initialPaid = 0;
    let initialStatus: "paid" | "unpaid" | "partial" = "unpaid";

    if (formData.trackARAP) {
      if (formData.immediateSettlement) {
        const chequeAccountingType = options.checkFormData?.accountingType || "cashed";
        const chequeAmount = parseFloat(options.checkFormData?.chequeAmount || "0");

        if (options.hasIncomingCheck && options.checkFormData) {
          if (chequeAccountingType === "cashed") {
            initialPaid = totalAmount;
            initialStatus = "paid";
          } else {
            const cashAmount = totalAmount - chequeAmount;
            initialPaid = cashAmount;
            initialStatus = cashAmount >= totalAmount ? "paid" : cashAmount > 0 ? "partial" : "unpaid";
          }
        } else {
          initialPaid = totalAmount;
          initialStatus = "paid";
        }
      } else if (options.hasInitialPayment && options.initialPaymentAmount) {
        initialPaid = parseFloat(options.initialPaymentAmount);
        initialStatus = initialPaid >= totalAmount ? "paid" : "partial";
      } else if (options.hasIncomingCheck) {
        // Handle multiple incoming cheques
        if (options.incomingChequesList && options.incomingChequesList.length > 0) {
          let totalCashedAmount = 0;
          options.incomingChequesList.forEach((cheque) => {
            const accountingType = cheque.accountingType || "cashed";
            if (accountingType === "cashed") {
              totalCashedAmount += parseFloat(cheque.chequeAmount || "0");
            }
          });
          initialPaid = totalCashedAmount;
          initialStatus = totalCashedAmount >= totalAmount ? "paid" : totalCashedAmount > 0 ? "partial" : "unpaid";
        } else if (options.checkFormData) {
          // Backwards compatibility: single cheque
          const chequeAccountingType = options.checkFormData.accountingType || "cashed";
          if (chequeAccountingType === "cashed") {
            const chequeAmount = parseFloat(options.checkFormData.chequeAmount || "0");
            initialPaid = chequeAmount;
            initialStatus = chequeAmount >= totalAmount ? "paid" : "partial";
          }
        }
      } else if (options.hasOutgoingCheck) {
        // Handle multiple outgoing cheques
        if (options.outgoingChequesList && options.outgoingChequesList.length > 0) {
          let totalCashedAmount = 0;
          options.outgoingChequesList.forEach((cheque) => {
            const accountingType = cheque.accountingType || "cashed";
            if (accountingType === "cashed" || accountingType === "endorsed") {
              totalCashedAmount += parseFloat(cheque.chequeAmount || "0");
            }
          });
          initialPaid = totalCashedAmount;
          initialStatus = totalCashedAmount >= totalAmount ? "paid" : totalCashedAmount > 0 ? "partial" : "unpaid";
        } else if (options.outgoingCheckFormData) {
          // Backwards compatibility: single cheque
          const chequeAccountingType = options.outgoingCheckFormData.accountingType || "cashed";
          if (chequeAccountingType === "cashed" || chequeAccountingType === "endorsed") {
            const chequeAmount = parseFloat(options.outgoingCheckFormData.chequeAmount || "0");
            initialPaid = chequeAmount;
            initialStatus = chequeAmount >= totalAmount ? "paid" : "partial";
          }
        }
      }
    } else if (formData.immediateSettlement) {
      initialPaid = totalAmount;
      initialStatus = "paid";
    }

    return { initialPaid, initialStatus };
  }

  private handleIncomingCheckBatch(
    batch: WriteBatch,
    transactionId: string,
    checkFormData: CheckFormData,
    formData: LedgerFormData,
    entryType: string
  ): void {
    const accountingType = checkFormData.accountingType || "cashed";
    const chequeAmount = parseFloat(checkFormData.chequeAmount);

    let chequeStatus: string;
    if (accountingType === "cashed") {
      chequeStatus = CHEQUE_STATUS_AR.CASHED;
    } else if (accountingType === "postponed") {
      chequeStatus = CHEQUE_STATUS_AR.PENDING;
    } else {
      chequeStatus = CHEQUE_STATUS_AR.ENDORSED;
    }

    const chequeDocRef = doc(this.chequesRef);
    const chequeData: Record<string, unknown> = {
      chequeNumber: checkFormData.chequeNumber,
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: CHEQUE_TYPES.INCOMING,
      chequeType: accountingType === "endorsed" ? "مجير" : "عادي",
      status: chequeStatus,
      linkedTransactionId: transactionId,
      issueDate: new Date(formData.date),
      dueDate: new Date(checkFormData.dueDate),
      bankName: checkFormData.bankName,
      notes: `مرتبط بالمعاملة: ${formData.description}`,
      createdAt: new Date(),
      accountingType: accountingType,
    };

    if (accountingType === "endorsed" && checkFormData.endorsedToName) {
      chequeData.endorsedTo = checkFormData.endorsedToName;
      chequeData.endorsedDate = new Date();
    }

    batch.set(chequeDocRef, chequeData);

    if (accountingType === "cashed") {
      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: formData.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
        method: "cheque",
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `شيك صرف رقم ${checkFormData.chequeNumber} - ${formData.description}`,
        createdAt: new Date(),
      });
    } else if (accountingType === "endorsed") {
      const receiptDocRef = doc(this.paymentsRef);
      batch.set(receiptDocRef, {
        clientName: formData.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: PAYMENT_TYPES.RECEIPT,
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `تظهير شيك رقم ${checkFormData.chequeNumber} للجهة: ${checkFormData.endorsedToName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
      });

      const disbursementDocRef = doc(this.paymentsRef);
      batch.set(disbursementDocRef, {
        clientName: checkFormData.endorsedToName,
        amount: chequeAmount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `استلام شيك مظهر رقم ${checkFormData.chequeNumber} من العميل: ${formData.associatedParty}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
      });
    }
  }

  private handleOutgoingCheckBatch(
    batch: WriteBatch,
    transactionId: string,
    outgoingCheckFormData: OutgoingCheckFormData,
    formData: LedgerFormData,
    entryType: string
  ): void {
    const accountingType = outgoingCheckFormData.accountingType || "cashed";
    const chequeAmount = parseFloat(outgoingCheckFormData.chequeAmount);

    let chequeStatus: string;
    if (accountingType === "cashed") {
      chequeStatus = CHEQUE_STATUS_AR.CASHED;
    } else if (accountingType === "postponed") {
      chequeStatus = CHEQUE_STATUS_AR.PENDING;
    } else {
      chequeStatus = CHEQUE_STATUS_AR.CASHED;
    }

    const chequeDocRef = doc(this.chequesRef);
    const chequeData: Record<string, unknown> = {
      chequeNumber: outgoingCheckFormData.chequeNumber,
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: CHEQUE_TYPES.OUTGOING,
      chequeType: accountingType === "endorsed" ? "مظهر" : "عادي",
      status: chequeStatus,
      linkedTransactionId: transactionId,
      issueDate: new Date(formData.date),
      dueDate: new Date(outgoingCheckFormData.dueDate),
      bankName: outgoingCheckFormData.bankName,
      notes: `مرتبط بالمعاملة: ${formData.description}`,
      createdAt: new Date(),
      accountingType: accountingType,
    };

    if (accountingType === "endorsed" && outgoingCheckFormData.endorsedFromName) {
      chequeData.isEndorsedCheque = true;
      chequeData.endorsedFromName = outgoingCheckFormData.endorsedFromName;
      chequeData.notes = `شيك مظهر من: ${outgoingCheckFormData.endorsedFromName} - مرتبط بالمعاملة: ${formData.description}`;
    }

    batch.set(chequeDocRef, chequeData);

    if (accountingType === "cashed") {
      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: formData.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        method: "cheque",
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `شيك صرف رقم ${outgoingCheckFormData.chequeNumber} - ${formData.description}`,
        createdAt: new Date(),
      });
    } else if (accountingType === "endorsed") {
      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: formData.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        method: "cheque",
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `شيك مظهر رقم ${outgoingCheckFormData.chequeNumber} من ${outgoingCheckFormData.endorsedFromName} - ${formData.description}`,
        createdAt: new Date(),
        isEndorsement: true,
      });
    }
  }

  private handleImmediateSettlementBatch(
    batch: WriteBatch,
    transactionId: string,
    formData: LedgerFormData,
    entryType: string,
    cashAmount: number
  ): void {
    if (cashAmount > 0) {
      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: formData.associatedParty || "غير محدد",
        amount: cashAmount,
        type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `تسوية فورية نقدية - ${formData.description}`,
        category: formData.category,
        subCategory: formData.subCategory,
        createdAt: new Date(),
      });
    }
  }

  private handleInitialPaymentBatch(
    batch: WriteBatch,
    transactionId: string,
    formData: LedgerFormData,
    entryType: string,
    paymentAmount: number
  ): void {
    if (paymentAmount > 0) {
      const paymentDocRef = doc(this.paymentsRef);
      batch.set(paymentDocRef, {
        clientName: formData.associatedParty || "غير محدد",
        amount: paymentAmount,
        type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `دفعة أولية - ${formData.description}`,
        category: formData.category,
        subCategory: formData.subCategory,
        createdAt: new Date(),
      });
    }
  }

  private async handleInventoryUpdateBatch(
    batch: WriteBatch,
    transactionId: string,
    formData: LedgerFormData,
    entryType: string,
    inventoryFormData: InventoryFormData
  ): Promise<InventoryUpdateResult> {
    const movementType = entryType === "مصروف" ? "دخول" : "خروج";
    let cogsCreated = false;
    let cogsAmount = 0;
    let cogsDescription = "";
    const quantityChange = parseAmount(inventoryFormData.quantity);

    const itemQuery = query(this.inventoryRef, where("itemName", "==", inventoryFormData.itemName));
    const itemSnapshot = await getDocs(itemQuery);

    let itemId = "";

    if (!itemSnapshot.empty) {
      const existingItem = itemSnapshot.docs[0];
      itemId = existingItem.id;
      const existingItemData = existingItem.data() as InventoryItemData;
      const currentQuantity = existingItemData.quantity || 0;
      const currentUnitPrice = existingItemData.unitPrice || 0;
      const newQuantity =
        movementType === "دخول" ? safeAdd(currentQuantity, quantityChange) : safeSubtract(currentQuantity, quantityChange);

      if (newQuantity < 0) {
        return {
          success: false,
          error: `الكمية المتوفرة في المخزون (${currentQuantity}) غير كافية لإجراء عملية خروج بكمية ${quantityChange}`,
        };
      }

      const itemDocRef = doc(firestore, getUserCollectionPath(this.userId, "inventory"), itemId);

      if (movementType === "دخول" && formData.amount) {
        // Calculate total landed cost (purchase + shipping + other costs)
        const shippingCost = inventoryFormData.shippingCost ? parseAmount(inventoryFormData.shippingCost) : 0;
        const otherCosts = inventoryFormData.otherCosts ? parseAmount(inventoryFormData.otherCosts) : 0;
        const purchaseAmount = parseAmount(formData.amount);

        // Use utility function to calculate landed cost unit price
        const purchaseUnitPrice = calculateLandedCostUnitPrice(
          purchaseAmount,
          shippingCost,
          otherCosts,
          quantityChange
        );

        // Use utility function to calculate weighted average cost
        const weightedAvgPrice = calculateWeightedAverageCost(
          currentQuantity,
          currentUnitPrice,
          quantityChange,
          purchaseUnitPrice
        );

        const totalLandedCost = sumAmounts([purchaseAmount, shippingCost, otherCosts]);

        batch.update(itemDocRef, {
          quantity: newQuantity,
          unitPrice: weightedAvgPrice,
          lastPurchasePrice: purchaseUnitPrice,
          lastPurchaseDate: new Date(),
          lastPurchaseAmount: totalLandedCost,
        });
      } else {
        batch.update(itemDocRef, {
          quantity: newQuantity,
        });
      }

      // Auto-record COGS when selling
      if (entryType === "إيراد" && movementType === "خروج") {
        const unitCost = existingItemData.unitPrice || 0;
        cogsAmount = safeMultiply(quantityChange, unitCost);
        cogsDescription = `تكلفة البضاعة المباعة - ${inventoryFormData.itemName}`;
        cogsCreated = true;

        const cogsDocRef = doc(this.ledgerRef);
        batch.set(cogsDocRef, {
          transactionId: `COGS-${transactionId}`,
          description: cogsDescription,
          type: "مصروف",
          amount: cogsAmount,
          category: "تكلفة البضاعة المباعة (COGS)",
          subCategory: "مبيعات",
          date: new Date(formData.date),
          linkedTransactionId: transactionId,
          autoGenerated: true,
          notes: `حساب تلقائي: ${quantityChange} × ${roundCurrency(unitCost).toFixed(2)} = ${roundCurrency(cogsAmount).toFixed(2)} دينار`,
          createdAt: new Date(),
        });
      }
    } else {
      if (movementType === "خروج") {
        return {
          success: false,
          error: `الصنف "${inventoryFormData.itemName}" غير موجود في المخزون. لا يمكن إجراء عملية خروج`,
        };
      }

      // Calculate total landed cost (purchase + shipping + other costs)
      const shippingCost = inventoryFormData.shippingCost ? parseAmount(inventoryFormData.shippingCost) : 0;
      const otherCosts = inventoryFormData.otherCosts ? parseAmount(inventoryFormData.otherCosts) : 0;
      const purchaseAmount = formData.amount ? parseAmount(formData.amount) : 0;
      const totalLandedCost = sumAmounts([purchaseAmount, shippingCost, otherCosts]);

      // Use utility function to calculate landed cost unit price
      const calculatedUnitPrice = calculateLandedCostUnitPrice(
        purchaseAmount,
        shippingCost,
        otherCosts,
        quantityChange
      );

      const newItemRef = doc(this.inventoryRef);
      itemId = newItemRef.id;
      batch.set(newItemRef, {
        itemName: inventoryFormData.itemName,
        category: formData.category || "غير مصنف",
        quantity: quantityChange,
        unit: inventoryFormData.unit,
        unitPrice: calculatedUnitPrice,
        thickness: inventoryFormData.thickness ? parseAmount(inventoryFormData.thickness) : null,
        width: inventoryFormData.width ? parseAmount(inventoryFormData.width) : null,
        length: inventoryFormData.length ? parseAmount(inventoryFormData.length) : null,
        minStock: 0,
        location: "",
        notes: `تم الإنشاء تلقائياً من المعاملة: ${formData.description}`,
        createdAt: new Date(),
        lastPurchasePrice: calculatedUnitPrice,
        lastPurchaseDate: new Date(),
        lastPurchaseAmount: totalLandedCost,
      });
    }

    // Add movement record
    const movementDocRef = doc(this.inventoryMovementsRef);
    batch.set(movementDocRef, {
      itemId: itemId,
      itemName: inventoryFormData.itemName,
      type: movementType,
      quantity: quantityChange,
      unit: inventoryFormData.unit,
      thickness: inventoryFormData.thickness ? parseAmount(inventoryFormData.thickness) : null,
      width: inventoryFormData.width ? parseAmount(inventoryFormData.width) : null,
      length: inventoryFormData.length ? parseAmount(inventoryFormData.length) : null,
      linkedTransactionId: transactionId,
      notes: `مرتبط بالمعاملة: ${formData.description}`,
      createdAt: new Date(),
    });

    return {
      success: true,
      cogsCreated,
      cogsAmount,
      cogsDescription,
    };
  }

  private handleFixedAssetBatch(
    batch: WriteBatch,
    transactionId: string,
    formData: LedgerFormData,
    fixedAssetFormData: FixedAssetFormData
  ): void {
    const assetDocRef = doc(this.fixedAssetsRef);

    const purchaseCost = parseAmount(formData.amount);
    const usefulLifeYears = parseAmount(fixedAssetFormData.usefulLifeYears);
    const usefulLifeMonths = safeMultiply(usefulLifeYears, 12);
    const salvageValue = fixedAssetFormData.salvageValue
      ? parseAmount(fixedAssetFormData.salvageValue)
      : 0;

    const depreciableAmount = safeSubtract(purchaseCost, salvageValue);
    const monthlyDepreciation =
      fixedAssetFormData.depreciationMethod === "declining"
        ? safeDivide(safeMultiply(purchaseCost, 0.2), 12)
        : safeDivide(depreciableAmount, usefulLifeMonths);
    const bookValue = purchaseCost;

    // Generate asset number in format FA-YYYY-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const assetNumber = `FA-${year}-${random}`;

    batch.set(assetDocRef, {
      assetNumber: assetNumber,
      assetName: fixedAssetFormData.assetName,
      category: "أخرى", // Default category for ledger-created assets
      purchaseDate: new Date(formData.date),
      purchaseCost: purchaseCost,
      salvageValue: salvageValue,
      usefulLifeMonths: usefulLifeMonths,
      monthlyDepreciation: monthlyDepreciation,
      depreciationMethod: fixedAssetFormData.depreciationMethod,
      accumulatedDepreciation: 0,
      bookValue: bookValue,
      linkedTransactionId: transactionId,
      status: "active",
      notes: `مرتبط بالمعاملة: ${formData.description}`,
      createdAt: new Date(),
    });
  }
}

/**
 * Factory function to create a LedgerService instance
 */
export function createLedgerService(userId: string): LedgerService {
  return new LedgerService(userId);
}
