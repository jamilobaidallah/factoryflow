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
  writeBatch,
  onSnapshot,
  DocumentSnapshot,
  Unsubscribe,
  WriteBatch,
  CollectionReference,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

// Collection path helpers
const getUserCollectionPath = (userId: string, collectionName: string) =>
  `users/${userId}/${collectionName}`;

// Result types for service methods
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DeleteResult extends ServiceResult {
  deletedRelatedCount?: number;
}

export interface CreateLedgerEntryOptions {
  hasIncomingCheck?: boolean;
  checkFormData?: CheckFormData;
  hasOutgoingCheck?: boolean;
  outgoingCheckFormData?: OutgoingCheckFormData;
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
   * Subscribe to ledger entries with real-time updates
   */
  subscribeLedgerEntries(
    pageSize: number,
    onData: (entries: LedgerEntry[], lastDoc: DocumentSnapshot | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(this.ledgerRef, orderBy("date", "desc"), limit(pageSize));

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

      const docRef = await addDoc(this.ledgerRef, {
        transactionId,
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
        createdAt: new Date(),
      });

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
      const totalAmount = parseFloat(formData.amount);

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
          remainingBalance: totalAmount - initialPaid,
          paymentStatus: initialStatus,
        }),
      });

      // Handle incoming check
      if (options.hasIncomingCheck && options.checkFormData) {
        this.handleIncomingCheckBatch(
          batch,
          transactionId,
          options.checkFormData,
          formData,
          entryType
        );
      }

      // Handle outgoing check
      if (options.hasOutgoingCheck && options.outgoingCheckFormData) {
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
            ? totalAmount - parseFloat(options.checkFormData.chequeAmount)
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
      if (options.hasInventoryUpdate && options.inventoryFormData) {
        const inventoryResult = await this.handleInventoryUpdateBatch(
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

            const itemDocRef = doc(firestore, getUserCollectionPath(this.userId, "inventory"), itemId);
            batch.update(itemDocRef, { quantity: Math.max(0, revertedQuantity) });
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
   */
  async addPaymentToEntry(
    entry: LedgerEntry,
    formData: PaymentFormData
  ): Promise<ServiceResult> {
    try {
      const paymentAmount = parseFloat(formData.amount);

      // Validate payment amount
      if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
        if (paymentAmount > entry.remainingBalance) {
          return {
            success: false,
            error: `المبلغ المتبقي هو ${entry.remainingBalance.toFixed(2)} دينار فقط`,
          };
        }
      }

      const paymentType = entry.type === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;

      await addDoc(this.paymentsRef, {
        clientName: entry.associatedParty || "غير محدد",
        amount: paymentAmount,
        type: paymentType,
        linkedTransactionId: entry.transactionId,
        date: new Date(),
        notes: formData.notes,
        createdAt: new Date(),
      });

      // Update ledger entry AR/AP tracking if enabled
      if (entry.isARAPEntry) {
        const newTotalPaid = (entry.totalPaid || 0) + paymentAmount;
        const newRemainingBalance = entry.amount - newTotalPaid;
        const newStatus: "paid" | "unpaid" | "partial" =
          newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

        await this.updateARAPTracking(entry.id, newTotalPaid, newRemainingBalance, newStatus);
      }

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
   */
  async addQuickPayment(data: QuickPaymentData): Promise<ServiceResult> {
    try {
      // Validate payment amount
      if (data.isARAPEntry && data.amount > data.remainingBalance) {
        return {
          success: false,
          error: `المبلغ المتبقي هو ${data.remainingBalance.toFixed(2)} دينار فقط`,
        };
      }

      const paymentType = data.entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;

      // Add payment record
      await addDoc(this.paymentsRef, {
        clientName: data.associatedParty || "غير محدد",
        amount: data.amount,
        type: paymentType,
        linkedTransactionId: data.entryTransactionId,
        date: new Date(),
        notes: `دفعة جزئية - ${data.entryDescription}`,
        category: data.entryCategory,
        subCategory: data.entrySubCategory,
        createdAt: new Date(),
      });

      // Update ledger entry AR/AP tracking
      const newTotalPaid = data.totalPaid + data.amount;
      const newRemainingBalance = data.entryAmount - newTotalPaid;
      const newStatus: "paid" | "unpaid" | "partial" =
        newRemainingBalance === 0 ? "paid" : newRemainingBalance < data.entryAmount ? "partial" : "unpaid";

      await this.updateARAPTracking(data.entryId, newTotalPaid, newRemainingBalance, newStatus);

      return { success: true };
    } catch (error) {
      console.error("Error adding quick payment:", error);
      return {
        success: false,
        error: "حدث خطأ أثناء إضافة الدفعة",
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

      // Upload cheque image if provided
      if (formData.chequeImage) {
        const imageRef = ref(
          storage,
          `users/${this.userId}/cheques/${Date.now()}_${formData.chequeImage.name}`
        );
        await uploadBytes(imageRef, formData.chequeImage);
        chequeImageUrl = await getDownloadURL(imageRef);
      }

      const chequeDirection = entry.type === "دخل" ? CHEQUE_TYPES.INCOMING : CHEQUE_TYPES.OUTGOING;
      const chequeAmount = parseFloat(formData.amount);
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

      // Create the cheque record
      const chequeData: Record<string, unknown> = {
        chequeNumber: formData.chequeNumber,
        clientName: entry.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: chequeDirection,
        chequeType: accountingType === "endorsed" ? "مجير" : formData.chequeType,
        status: chequeStatus,
        chequeImageUrl: chequeImageUrl,
        linkedTransactionId: entry.transactionId,
        issueDate: new Date(),
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

      await addDoc(this.chequesRef, chequeData);

      // Handle different accounting flows
      if (accountingType === "cashed") {
        // Create payment record
        const paymentType = entry.type === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
        await addDoc(this.paymentsRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: chequeAmount,
          type: paymentType,
          method: "cheque",
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: `شيك صرف رقم ${formData.chequeNumber} - ${entry.description}`,
          createdAt: new Date(),
        });

        // Update AR/AP tracking
        if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
          if (chequeAmount <= entry.remainingBalance) {
            const newTotalPaid = (entry.totalPaid || 0) + chequeAmount;
            const newRemainingBalance = entry.amount - newTotalPaid;
            const newStatus: "paid" | "unpaid" | "partial" =
              newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

            await this.updateARAPTracking(entry.id, newTotalPaid, newRemainingBalance, newStatus);
          }
        }
      } else if (accountingType === "endorsed") {
        // Create two payment records with noCashMovement flag
        await addDoc(this.paymentsRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: chequeAmount,
          type: PAYMENT_TYPES.RECEIPT,
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: `تظهير شيك رقم ${formData.chequeNumber} للجهة: ${formData.endorsedToName}`,
          createdAt: new Date(),
          isEndorsement: true,
          noCashMovement: true,
        });

        await addDoc(this.paymentsRef, {
          clientName: formData.endorsedToName,
          amount: chequeAmount,
          type: PAYMENT_TYPES.DISBURSEMENT,
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: `استلام شيك مظهر رقم ${formData.chequeNumber} من العميل: ${entry.associatedParty}`,
          createdAt: new Date(),
          isEndorsement: true,
          noCashMovement: true,
        });
      }
      // For postponed, no payment record is created

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
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        thickness: formData.thickness ? parseFloat(formData.thickness) : null,
        width: formData.width ? parseFloat(formData.width) : null,
        length: formData.length ? parseFloat(formData.length) : null,
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

      const docRef = await addDoc(this.invoicesRef, {
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
      });

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
      } else if (options.hasIncomingCheck && options.checkFormData) {
        const chequeAccountingType = options.checkFormData.accountingType || "cashed";
        if (chequeAccountingType === "cashed") {
          const chequeAmount = parseFloat(options.checkFormData.chequeAmount || "0");
          initialPaid = chequeAmount;
          initialStatus = chequeAmount >= totalAmount ? "paid" : "partial";
        }
      } else if (options.hasOutgoingCheck && options.outgoingCheckFormData) {
        const chequeAccountingType = options.outgoingCheckFormData.accountingType || "cashed";
        if (chequeAccountingType === "cashed" || chequeAccountingType === "endorsed") {
          const chequeAmount = parseFloat(options.outgoingCheckFormData.chequeAmount || "0");
          initialPaid = chequeAmount;
          initialStatus = chequeAmount >= totalAmount ? "paid" : "partial";
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
  ): Promise<ServiceResult> {
    const movementType = entryType === "مصروف" ? "دخول" : "خروج";
    const quantityChange = parseFloat(inventoryFormData.quantity);

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
        movementType === "دخول" ? currentQuantity + quantityChange : currentQuantity - quantityChange;

      if (newQuantity < 0) {
        return {
          success: false,
          error: `الكمية المتوفرة في المخزون (${currentQuantity}) غير كافية لإجراء عملية خروج بكمية ${quantityChange}`,
        };
      }

      const itemDocRef = doc(firestore, getUserCollectionPath(this.userId, "inventory"), itemId);

      if (movementType === "دخول" && formData.amount) {
        const purchaseUnitPrice = parseFloat(formData.amount) / quantityChange;
        const oldValue = currentQuantity * currentUnitPrice;
        const newValue = quantityChange * purchaseUnitPrice;
        const weightedAvgPrice = parseFloat(((oldValue + newValue) / newQuantity).toFixed(2));

        batch.update(itemDocRef, {
          quantity: newQuantity,
          unitPrice: weightedAvgPrice,
          lastPurchasePrice: parseFloat(purchaseUnitPrice.toFixed(2)),
          lastPurchaseDate: new Date(),
          lastPurchaseAmount: formData.amount,
        });
      } else {
        batch.update(itemDocRef, {
          quantity: newQuantity,
        });
      }

      // Auto-record COGS when selling
      if (entryType === "إيراد" && movementType === "خروج") {
        const unitCost = existingItemData.unitPrice || 0;
        const cogsAmount = quantityChange * unitCost;

        const cogsDocRef = doc(this.ledgerRef);
        batch.set(cogsDocRef, {
          transactionId: `COGS-${transactionId}`,
          description: `تكلفة البضاعة المباعة - ${inventoryFormData.itemName}`,
          type: "مصروف",
          amount: cogsAmount,
          category: "تكلفة البضاعة المباعة (COGS)",
          subCategory: "مبيعات",
          date: new Date(formData.date),
          linkedTransactionId: transactionId,
          autoGenerated: true,
          notes: `حساب تلقائي: ${quantityChange} × ${unitCost.toFixed(2)} = ${cogsAmount.toFixed(2)} دينار`,
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

      const shippingCost = inventoryFormData.shippingCost ? parseFloat(inventoryFormData.shippingCost) : 0;
      const otherCosts = inventoryFormData.otherCosts ? parseFloat(inventoryFormData.otherCosts) : 0;
      const purchaseAmount = formData.amount ? parseFloat(formData.amount) : 0;
      const totalLandedCost = purchaseAmount + shippingCost + otherCosts;
      const calculatedUnitPrice =
        totalLandedCost > 0 ? parseFloat((totalLandedCost / quantityChange).toFixed(2)) : 0;

      const newItemRef = doc(this.inventoryRef);
      itemId = newItemRef.id;
      batch.set(newItemRef, {
        itemName: inventoryFormData.itemName,
        category: formData.category || "غير مصنف",
        quantity: quantityChange,
        unit: inventoryFormData.unit,
        unitPrice: calculatedUnitPrice,
        thickness: inventoryFormData.thickness ? parseFloat(inventoryFormData.thickness) : null,
        width: inventoryFormData.width ? parseFloat(inventoryFormData.width) : null,
        length: inventoryFormData.length ? parseFloat(inventoryFormData.length) : null,
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
      thickness: inventoryFormData.thickness ? parseFloat(inventoryFormData.thickness) : null,
      width: inventoryFormData.width ? parseFloat(inventoryFormData.width) : null,
      length: inventoryFormData.length ? parseFloat(inventoryFormData.length) : null,
      linkedTransactionId: transactionId,
      notes: `مرتبط بالمعاملة: ${formData.description}`,
      createdAt: new Date(),
    });

    return { success: true };
  }

  private handleFixedAssetBatch(
    batch: WriteBatch,
    transactionId: string,
    formData: LedgerFormData,
    fixedAssetFormData: FixedAssetFormData
  ): void {
    const assetDocRef = doc(this.fixedAssetsRef);

    const purchaseAmount = parseFloat(formData.amount);
    const usefulLifeYears = parseFloat(fixedAssetFormData.usefulLifeYears);
    const salvageValue = fixedAssetFormData.salvageValue
      ? parseFloat(fixedAssetFormData.salvageValue)
      : 0;

    const depreciableAmount = purchaseAmount - salvageValue;
    const annualDepreciation =
      fixedAssetFormData.depreciationMethod === "declining"
        ? purchaseAmount * 0.2
        : depreciableAmount / usefulLifeYears;

    batch.set(assetDocRef, {
      assetName: fixedAssetFormData.assetName,
      purchaseAmount: purchaseAmount,
      purchaseDate: new Date(formData.date),
      usefulLifeYears: usefulLifeYears,
      salvageValue: salvageValue,
      depreciationMethod: fixedAssetFormData.depreciationMethod,
      annualDepreciation: annualDepreciation,
      accumulatedDepreciation: 0,
      bookValue: purchaseAmount,
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
