/**
 * Custom hook for ledger CRUD operations
 * Centralizes all Firebase operations for ledger entries
 */

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { firestore, storage } from "@/firebase/config";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  where,
  getDocs,
  query,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { LedgerEntry } from "../utils/ledger-constants";
import { getCategoryType, generateTransactionId } from "../utils/ledger-helpers";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import type {
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
} from "../types/ledger";

export function useLedgerOperations() {
  const { user } = useUser();
  const { toast } = useToast();

  /**
   * Add or update a ledger entry
   */
  const submitLedgerEntry = async (
    formData: LedgerFormData,
    editingEntry: LedgerEntry | null,
    options: {
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
    } = {}
  ): Promise<boolean> => {
    if (!user) { return false; }

    const entryType = getCategoryType(formData.category, formData.subCategory);

    try {
      if (editingEntry) {
        // Update existing entry
        const entryRef = doc(firestore, `users/${user.uid}/ledger`, editingEntry.id);
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

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث الحركة المالية",
        });
        return true;
      }

      // Create new entry with complex batch operations
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const transactionId = generateTransactionId();

      // Validations
      if (options.hasIncomingCheck && formData.immediateSettlement && options.checkFormData) {
        const totalAmount = parseFloat(formData.amount);
        const checkAmount = parseFloat(options.checkFormData.chequeAmount);
        if (checkAmount > totalAmount) {
          toast({
            title: "خطأ في المبلغ",
            description: "مبلغ الشيك لا يمكن أن يكون أكبر من المبلغ الإجمالي",
            variant: "destructive",
          });
          return false;
        }
      }

      if (options.hasInitialPayment && options.initialPaymentAmount) {
        const totalAmount = parseFloat(formData.amount);
        const paymentAmt = parseFloat(options.initialPaymentAmount);
        if (paymentAmt > totalAmount) {
          toast({
            title: "خطأ في المبلغ",
            description: "مبلغ الدفعة الأولية لا يمكن أن يكون أكبر من المبلغ الإجمالي",
            variant: "destructive",
          });
          return false;
        }
        if (paymentAmt <= 0) {
          toast({
            title: "خطأ في المبلغ",
            description: "يرجى إدخال مبلغ صحيح للدفعة الأولية",
            variant: "destructive",
          });
          return false;
        }
      }

      // Use batch for atomic operations
      // Include trackARAP and immediateSettlement to ensure AR/AP fields and payments are created
      const needsBatch =
        options.hasIncomingCheck ||
        options.hasOutgoingCheck ||
        options.hasInventoryUpdate ||
        options.hasFixedAsset ||
        options.hasInitialPayment ||
        formData.trackARAP ||
        formData.immediateSettlement;

      if (needsBatch) {
        const batch = writeBatch(firestore);
        const ledgerDocRef = doc(ledgerRef);
        const totalAmount = parseFloat(formData.amount);

        // Calculate AR/AP tracking
        let initialPaid = 0;
        let initialStatus: "paid" | "unpaid" | "partial" = "unpaid";

        if (formData.trackARAP) {
          if (formData.immediateSettlement) {
            // For immediate settlement with incoming check:
            // - Only count cashed cheques as paid
            // - Postponed/endorsed cheques don't count toward immediate payment
            const chequeAccountingType = options.checkFormData?.accountingType || "cashed";
            const chequeAmount = parseFloat(options.checkFormData?.chequeAmount || "0");

            if (options.hasIncomingCheck && options.checkFormData) {
              if (chequeAccountingType === "cashed") {
                // Cashed cheque - counts as paid immediately
                initialPaid = totalAmount;
                initialStatus = "paid";
              } else {
                // Postponed/endorsed cheque - cash portion only
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
            // When not immediate settlement but has incoming check with AR/AP tracking:
            // Only count cashed cheques as paid
            const chequeAccountingType = options.checkFormData.accountingType || "cashed";
            if (chequeAccountingType === "cashed") {
              const chequeAmount = parseFloat(options.checkFormData.chequeAmount || "0");
              initialPaid = chequeAmount;
              initialStatus = chequeAmount >= totalAmount ? "paid" : "partial";
            }
            // For postponed/endorsed, initialPaid stays 0 and status stays unpaid
          } else if (options.hasOutgoingCheck && options.outgoingCheckFormData) {
            // When has outgoing check with AR/AP tracking (for expenses):
            // Only count cashed or endorsed cheques as paid
            const chequeAccountingType = options.outgoingCheckFormData.accountingType || "cashed";
            if (chequeAccountingType === "cashed" || chequeAccountingType === "endorsed") {
              const chequeAmount = parseFloat(options.outgoingCheckFormData.chequeAmount || "0");
              initialPaid = chequeAmount;
              initialStatus = chequeAmount >= totalAmount ? "paid" : "partial";
            }
            // For postponed, initialPaid stays 0 and status stays unpaid
          }
        } else if (formData.immediateSettlement) {
          initialPaid = totalAmount;
          initialStatus = "paid";
        }

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
          await handleIncomingCheckBatch(
            batch,
            user.uid,
            transactionId,
            options.checkFormData,
            formData,
            entryType
          );
        }

        // Handle outgoing check
        if (options.hasOutgoingCheck && options.outgoingCheckFormData) {
          await handleOutgoingCheckBatch(
            batch,
            user.uid,
            transactionId,
            options.outgoingCheckFormData,
            formData,
            entryType
          );
        }

        // Handle immediate settlement
        if (formData.immediateSettlement) {
          await handleImmediateSettlementBatch(
            batch,
            user.uid,
            transactionId,
            formData,
            entryType,
            options.hasIncomingCheck && options.checkFormData
              ? parseFloat(formData.amount) - parseFloat(options.checkFormData.chequeAmount)
              : parseFloat(formData.amount)
          );
        }

        // Handle initial payment
        if (options.hasInitialPayment && options.initialPaymentAmount && formData.trackARAP) {
          await handleInitialPaymentBatch(
            batch,
            user.uid,
            transactionId,
            formData,
            entryType,
            parseFloat(options.initialPaymentAmount)
          );
        }

        // Handle inventory update
        if (options.hasInventoryUpdate && options.inventoryFormData) {
          const success = await handleInventoryUpdateBatch(
            batch,
            user.uid,
            transactionId,
            formData,
            entryType,
            options.inventoryFormData,
            ledgerRef,
            toast
          );
          if (!success) { return false; }
        }

        // Handle fixed asset
        if (options.hasFixedAsset && options.fixedAssetFormData) {
          await handleFixedAssetBatch(
            batch,
            user.uid,
            transactionId,
            formData,
            options.fixedAssetFormData
          );
        }

        await batch.commit();
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة الحركة المالية وجميع السجلات المرتبطة",
        });
        return true;
      } else {
        // Simple ledger entry without batch
        await addDoc(ledgerRef, {
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

        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة الحركة المالية",
        });
        return true;
      }
    } catch (error) {
      console.error("Error submitting ledger entry:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الحركة المالية",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Delete a ledger entry and all related records
   */
  const deleteLedgerEntry = async (
    entry: LedgerEntry,
    entries: LedgerEntry[]
  ): Promise<boolean> => {
    if (!user) { return false; }

    try {
      const batch = writeBatch(firestore);

      // 1. Delete the ledger entry
      const entryRef = doc(firestore, `users/${user.uid}/ledger`, entry.id);
      batch.delete(entryRef);

      // 2. Delete related payments
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentsQuery = query(paymentsRef, where("linkedTransactionId", "==", entry.transactionId));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. Delete related cheques
      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
      const chequesQuery = query(chequesRef, where("linkedTransactionId", "==", entry.transactionId));
      const chequesSnapshot = await getDocs(chequesQuery);
      chequesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 4. Revert inventory quantities and delete related inventory movements
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
      const movementsQuery = query(movementsRef, where("linkedTransactionId", "==", entry.transactionId));
      const movementsSnapshot = await getDocs(movementsQuery);

      // Revert quantities before deleting movements
      for (const movementDoc of movementsSnapshot.docs) {
        const movement = movementDoc.data() as InventoryMovementData;
        const itemId = movement.itemId;
        const quantity = movement.quantity || 0;
        const movementType = movement.type; // 'entry' or 'exit'

        if (itemId) {
          // Find the inventory item
          const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
          const itemQuery = query(inventoryRef, where("__name__", "==", itemId));
          const itemSnapshot = await getDocs(itemQuery);

          if (!itemSnapshot.empty) {
            const itemDoc = itemSnapshot.docs[0];
            const currentQuantity = (itemDoc.data() as InventoryItemData).quantity || 0;

            // Revert the quantity change
            // If it was دخول/entry (+), we subtract to revert
            // If it was خروج/exit (-), we add back to revert
            const revertedQuantity = movementType === "دخول"
              ? currentQuantity - quantity
              : currentQuantity + quantity;

            const itemDocRef = doc(firestore, `users/${user.uid}/inventory`, itemId);
            batch.update(itemDocRef, { quantity: Math.max(0, revertedQuantity) });
          }
        }

        // Delete the movement record
        batch.delete(movementDoc.ref);
      }

      // 5. Delete auto-generated COGS entries
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const cogsQuery = query(ledgerRef, where("transactionId", "==", `COGS-${entry.transactionId}`));
      const cogsSnapshot = await getDocs(cogsQuery);
      cogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Commit all deletions
      await batch.commit();

      const deletedCount = paymentsSnapshot.size + chequesSnapshot.size + movementsSnapshot.size + cogsSnapshot.size;
      toast({
        title: "تم الحذف",
        description: deletedCount > 0
          ? `تم حذف الحركة المالية و ${deletedCount} سجل مرتبط`
          : "تم حذف الحركة المالية بنجاح",
      });
      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Add a payment to an existing ledger entry
   */
  const addPaymentToEntry = async (
    entry: LedgerEntry,
    formData: PaymentFormData
  ): Promise<boolean> => {
    if (!user) { return false; }

    try {
      const paymentAmount = parseFloat(formData.amount);

      // Validate payment amount
      if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
        if (paymentAmount > entry.remainingBalance) {
          toast({
            title: "خطأ في المبلغ",
            description: `المبلغ المتبقي هو ${entry.remainingBalance.toFixed(2)} دينار فقط`,
            variant: "destructive",
          });
          return false;
        }
      }

      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentType = entry.type === "دخل" ? "قبض" : "صرف";

      await addDoc(paymentsRef, {
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
        let newStatus: "paid" | "unpaid" | "partial" = "unpaid";

        if (newRemainingBalance <= 0) {
          newStatus = "paid";
        } else if (newTotalPaid > 0) {
          newStatus = "partial";
        }

        const ledgerEntryRef = doc(firestore, `users/${user.uid}/ledger`, entry.id);
        await updateDoc(ledgerEntryRef, {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          paymentStatus: newStatus,
        });
      }

      toast({
        title: "تمت الإضافة بنجاح",
        description: entry.isARAPEntry
          ? `تم إضافة الدفعة وتحديث الرصيد المتبقي`
          : "تم إضافة الدفعة المرتبطة بالمعاملة",
      });
      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Add a cheque to an existing ledger entry
   */
  const addChequeToEntry = async (
    entry: LedgerEntry,
    formData: ChequeRelatedFormData
  ): Promise<boolean> => {
    if (!user) { return false; }

    try {
      let chequeImageUrl = "";

      // Upload cheque image if provided
      if (formData.chequeImage) {
        const imageRef = ref(
          storage,
          `users/${user.uid}/cheques/${Date.now()}_${formData.chequeImage.name}`
        );
        await uploadBytes(imageRef, formData.chequeImage);
        chequeImageUrl = await getDownloadURL(imageRef);
      }

      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const chequeDirection = entry.type === "دخل" ? "وارد" : "صادر";
      const chequeAmount = parseFloat(formData.amount);
      const accountingType = formData.accountingType || "cashed";

      // Determine the correct status based on accounting type
      let chequeStatus = formData.status;
      if (accountingType === "cashed") {
        // Cashed cheques: 'cleared' for incoming, 'cashed' for outgoing
        chequeStatus = chequeDirection === "وارد" ? "تم الصرف" : "تم الصرف";
      } else if (accountingType === "postponed") {
        chequeStatus = "قيد الانتظار";
      } else if (accountingType === "endorsed") {
        chequeStatus = "مجيّر";
      }

      // Validate endorsee name for endorsed cheques
      if (accountingType === "endorsed" && !formData.endorsedToName?.trim()) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال اسم الجهة المظهر لها الشيك",
          variant: "destructive",
        });
        return false;
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
        // Store accounting type for future reference
        accountingType: accountingType,
      };

      // Add endorsee info for endorsed cheques
      if (accountingType === "endorsed") {
        chequeData.endorsedTo = formData.endorsedToName;
        chequeData.endorsedDate = new Date();
      }

      await addDoc(chequesRef, chequeData);

      // Handle different accounting flows based on cheque type
      if (accountingType === "cashed") {
        // CASHED CHEQUE: Create payment record AND update AR/AP immediately

        // Create payment record
        const paymentType = entry.type === "دخل" ? "قبض" : "صرف";
        await addDoc(paymentsRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: chequeAmount,
          type: paymentType,
          method: "cheque",
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: `شيك صرف رقم ${formData.chequeNumber} - ${entry.description}`,
          createdAt: new Date(),
        });

        // Update AR/AP tracking if enabled
        if (entry.isARAPEntry && entry.remainingBalance !== undefined) {
          if (chequeAmount > entry.remainingBalance) {
            toast({
              title: "تحذير",
              description: `المبلغ المتبقي هو ${entry.remainingBalance.toFixed(2)} دينار فقط`,
              variant: "destructive",
            });
          } else {
            const newTotalPaid = (entry.totalPaid || 0) + chequeAmount;
            const newRemainingBalance = entry.amount - newTotalPaid;
            let newStatus: "paid" | "unpaid" | "partial" = "unpaid";

            if (newRemainingBalance <= 0) {
              newStatus = "paid";
            } else if (newTotalPaid > 0) {
              newStatus = "partial";
            }

            const ledgerEntryRef = doc(firestore, `users/${user.uid}/ledger`, entry.id);
            await updateDoc(ledgerEntryRef, {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newStatus,
            });
          }
        }

        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة شيك الصرف وتسجيل الدفعة وتحديث الرصيد",
        });

      } else if (accountingType === "postponed") {
        // POSTPONED CHEQUE: Only create cheque record, NO payment, NO AR/AP update
        // The payment and AR/AP update will happen when the cheque is cleared later

        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم تسجيل الشيك المؤجل. لن يؤثر على الرصيد حتى يتم تأكيد التحصيل من صفحة الشيكات.",
        });

      } else if (accountingType === "endorsed") {
        // ENDORSED CHEQUE: Create endorsement records, NO AR/AP update on original entry
        // The cheque is passed to a third party

        // Create two payment records with noCashMovement flag
        // 1. Receipt from original client (records the endorsement)
        await addDoc(paymentsRef, {
          clientName: entry.associatedParty || "غير محدد",
          amount: chequeAmount,
          type: "قبض",
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: `تظهير شيك رقم ${formData.chequeNumber} للجهة: ${formData.endorsedToName}`,
          createdAt: new Date(),
          isEndorsement: true,
          noCashMovement: true,
        });

        // 2. Disbursement to endorsed party
        await addDoc(paymentsRef, {
          clientName: formData.endorsedToName,
          amount: chequeAmount,
          type: "صرف",
          linkedTransactionId: entry.transactionId,
          date: new Date(),
          notes: `استلام شيك مظهر رقم ${formData.chequeNumber} من العميل: ${entry.associatedParty}`,
          createdAt: new Date(),
          isEndorsement: true,
          noCashMovement: true,
        });

        toast({
          title: "تم التظهير بنجاح",
          description: `تم تظهير الشيك رقم ${formData.chequeNumber} إلى ${formData.endorsedToName}`,
        });
      }

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Add inventory movement to an existing ledger entry
   */
  const addInventoryToEntry = async (
    entry: LedgerEntry,
    formData: InventoryRelatedFormData
  ): Promise<boolean> => {
    if (!user) { return false; }

    try {
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
      const movementType = entry.type === "مصروف" ? "خروج" : "دخول";
      await addDoc(movementsRef, {
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
      toast({
        title: "تمت الإضافة بنجاح",
        description: "تم إضافة حركة المخزون المرتبطة بالمعاملة",
      });
      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    submitLedgerEntry,
    deleteLedgerEntry,
    addPaymentToEntry,
    addChequeToEntry,
    addInventoryToEntry,
  };
}

// Helper functions for batch operations
async function handleIncomingCheckBatch(
  batch: any,
  userId: string,
  transactionId: string,
  checkFormData: CheckFormData,
  formData: LedgerFormData,
  entryType: string
) {
  const accountingType = checkFormData.accountingType || "cashed";
  const chequeAmount = parseFloat(checkFormData.chequeAmount);
  const chequesRef = collection(firestore, `users/${userId}/cheques`);
  const paymentsRef = collection(firestore, `users/${userId}/payments`);

  // Determine cheque status based on accounting type
  let chequeStatus: string;
  if (accountingType === "cashed") {
    chequeStatus = "تم الصرف"; // Cleared immediately
  } else if (accountingType === "postponed") {
    chequeStatus = "قيد الانتظار"; // Pending until cleared later
  } else {
    chequeStatus = "مجيّر"; // Endorsed to third party
  }

  // Create cheque record
  const chequeDocRef = doc(chequesRef);
  const chequeData: Record<string, unknown> = {
    chequeNumber: checkFormData.chequeNumber,
    clientName: formData.associatedParty || "غير محدد",
    amount: chequeAmount,
    type: "وارد",
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

  // Add endorsee info for endorsed cheques
  if (accountingType === "endorsed" && checkFormData.endorsedToName) {
    chequeData.endorsedTo = checkFormData.endorsedToName;
    chequeData.endorsedDate = new Date();
  }

  batch.set(chequeDocRef, chequeData);

  // Handle payment records based on accounting type
  if (accountingType === "cashed") {
    // CASHED CHEQUE: Create a real payment record (affects cash flow and AR/AP)
    const paymentDocRef = doc(paymentsRef);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: entryType === "دخل" ? "قبض" : "صرف",
      method: "cheque",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `شيك صرف رقم ${checkFormData.chequeNumber} - ${formData.description}`,
      createdAt: new Date(),
    });
  } else if (accountingType === "postponed") {
    // POSTPONED CHEQUE: Do NOT create payment record
    // Payment will be created later when cheque is cleared from the cheques page
    // No action needed here
  } else if (accountingType === "endorsed") {
    // ENDORSED CHEQUE: Create two payment records with noCashMovement flag
    // 1. Receipt from original client (records the endorsement)
    const receiptDocRef = doc(paymentsRef);
    batch.set(receiptDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: "قبض",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `تظهير شيك رقم ${checkFormData.chequeNumber} للجهة: ${checkFormData.endorsedToName}`,
      createdAt: new Date(),
      isEndorsement: true,
      noCashMovement: true,
    });

    // 2. Disbursement to endorsed party
    const disbursementDocRef = doc(paymentsRef);
    batch.set(disbursementDocRef, {
      clientName: checkFormData.endorsedToName,
      amount: chequeAmount,
      type: "صرف",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `استلام شيك مظهر رقم ${checkFormData.chequeNumber} من العميل: ${formData.associatedParty}`,
      createdAt: new Date(),
      isEndorsement: true,
      noCashMovement: true,
    });
  }
}

async function handleImmediateSettlementBatch(
  batch: any,
  userId: string,
  transactionId: string,
  formData: LedgerFormData,
  entryType: string,
  cashAmount: number
) {
  if (cashAmount > 0) {
    const paymentsRef = collection(firestore, `users/${userId}/payments`);
    const paymentDocRef = doc(paymentsRef);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: cashAmount,
      type: entryType === "دخل" ? "قبض" : "صرف",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `تسوية فورية نقدية - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });
  }
}

async function handleInitialPaymentBatch(
  batch: any,
  userId: string,
  transactionId: string,
  formData: LedgerFormData,
  entryType: string,
  paymentAmount: number
) {
  if (paymentAmount > 0) {
    const paymentsRef = collection(firestore, `users/${userId}/payments`);
    const paymentDocRef = doc(paymentsRef);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: paymentAmount,
      type: entryType === "دخل" ? "قبض" : "صرف",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `دفعة أولية - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });
  }
}

async function handleInventoryUpdateBatch(
  batch: any,
  userId: string,
  transactionId: string,
  formData: LedgerFormData,
  entryType: string,
  inventoryFormData: InventoryFormData,
  ledgerRef: any,
  toast: any
): Promise<boolean> {
  const movementType = entryType === "مصروف" ? "دخول" : "خروج";
  const quantityChange = parseFloat(inventoryFormData.quantity);

  // Check if inventory item exists
  const inventoryRef = collection(firestore, `users/${userId}/inventory`);
  const itemQuery = query(inventoryRef, where("itemName", "==", inventoryFormData.itemName));
  const itemSnapshot = await getDocs(itemQuery);

  let itemId = "";

  if (!itemSnapshot.empty) {
    // Item exists - update quantity
    const existingItem = itemSnapshot.docs[0];
    itemId = existingItem.id;
    const existingItemData = existingItem.data() as InventoryItemData;
    const currentQuantity = existingItemData.quantity || 0;
    const currentUnitPrice = existingItemData.unitPrice || 0;
    const newQuantity =
      movementType === "دخول" ? currentQuantity + quantityChange : currentQuantity - quantityChange;

    // Validate we don't go negative
    if (newQuantity < 0) {
      toast({
        title: "خطأ في المخزون",
        description: `الكمية المتوفرة في المخزون (${currentQuantity}) غير كافية لإجراء عملية خروج بكمية ${quantityChange}`,
        variant: "destructive",
      });
      return false;
    }

    const itemDocRef = doc(firestore, `users/${userId}/inventory`, itemId);

    // Calculate weighted average cost when adding inventory
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

      const cogsDocRef = doc(ledgerRef);
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
    // Item doesn't exist
    if (movementType === "خروج") {
      toast({
        title: "خطأ في المخزون",
        description: `الصنف "${inventoryFormData.itemName}" غير موجود في المخزون. لا يمكن إجراء عملية خروج`,
        variant: "destructive",
      });
      return false;
    }

    // Create new item
    const shippingCost = inventoryFormData.shippingCost ? parseFloat(inventoryFormData.shippingCost) : 0;
    const otherCosts = inventoryFormData.otherCosts ? parseFloat(inventoryFormData.otherCosts) : 0;
    const purchaseAmount = formData.amount ? parseFloat(formData.amount) : 0;
    const totalLandedCost = purchaseAmount + shippingCost + otherCosts;
    const calculatedUnitPrice =
      totalLandedCost > 0 ? parseFloat((totalLandedCost / quantityChange).toFixed(2)) : 0;

    const newItemRef = doc(inventoryRef);
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
  const movementsRef = collection(firestore, `users/${userId}/inventory_movements`);
  const movementDocRef = doc(movementsRef);
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

  return true;
}

async function handleFixedAssetBatch(
  batch: any,
  userId: string,
  transactionId: string,
  formData: LedgerFormData,
  fixedAssetFormData: FixedAssetFormData
) {
  const fixedAssetsRef = collection(firestore, `users/${userId}/fixed_assets`);
  const assetDocRef = doc(fixedAssetsRef);

  const purchaseAmount = parseFloat(formData.amount);
  const usefulLifeYears = parseFloat(fixedAssetFormData.usefulLifeYears);
  const salvageValue = fixedAssetFormData.salvageValue
    ? parseFloat(fixedAssetFormData.salvageValue)
    : 0;

  // Calculate annual depreciation
  const depreciableAmount = purchaseAmount - salvageValue;
  const annualDepreciation =
    fixedAssetFormData.depreciationMethod === "declining"
      ? purchaseAmount * 0.2 // 20% declining balance
      : depreciableAmount / usefulLifeYears; // Straight line

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

/**
 * معالجة الشيكات الصادرة ضمن دفعة واحدة (Batch Operation)
 *
 * هذه الدالة تُنشئ سجل شيك صادر وسجل دفع حسب نوع الشيك:
 * - شيك صرف (cashed): يُنشئ سجل دفع فوري
 * - شيك مؤجل (postponed): لا يُنشئ سجل دفع - ينتظر التصريف لاحقاً
 * - شيك مظهر (endorsed): يُنشئ سجل دفع فوري (تحويل قيمة الشيك للمورد)
 *
 * @param batch - كائن الدفعة للعمليات الذرية
 * @param userId - معرف المستخدم
 * @param transactionId - معرف المعاملة المرتبطة
 * @param outgoingCheckFormData - بيانات نموذج الشيك الصادر
 * @param formData - بيانات القيد الرئيسي
 * @param entryType - نوع القيد (مصروف/دخل)
 */
async function handleOutgoingCheckBatch(
  batch: any,
  userId: string,
  transactionId: string,
  outgoingCheckFormData: OutgoingCheckFormData,
  formData: LedgerFormData,
  entryType: string
) {
  const accountingType = outgoingCheckFormData.accountingType || "cashed";
  const chequeAmount = parseFloat(outgoingCheckFormData.chequeAmount);
  const chequesRef = collection(firestore, `users/${userId}/cheques`);
  const paymentsRef = collection(firestore, `users/${userId}/payments`);

  // تحديد حالة الشيك بناءً على نوعه المحاسبي
  // Determine cheque status based on accounting type
  let chequeStatus: string;
  if (accountingType === "cashed") {
    chequeStatus = "تم الصرف"; // تم صرفه فوراً
  } else if (accountingType === "postponed") {
    chequeStatus = "قيد الانتظار"; // معلق حتى تاريخ الاستحقاق
  } else {
    chequeStatus = "تم الصرف"; // الشيك المظهر يُعتبر مصروفاً
  }

  // إنشاء سجل الشيك في قاعدة البيانات
  const chequeDocRef = doc(chequesRef);
  const chequeData: Record<string, unknown> = {
    chequeNumber: outgoingCheckFormData.chequeNumber,
    clientName: formData.associatedParty || "غير محدد", // اسم المورد
    amount: chequeAmount,
    type: "صادر", // نوع الشيك: صادر
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

  // إضافة معلومات التظهير للشيكات المظهرة
  if (accountingType === "endorsed" && outgoingCheckFormData.endorsedFromName) {
    chequeData.isEndorsedCheque = true;
    chequeData.endorsedFromName = outgoingCheckFormData.endorsedFromName;
    chequeData.notes = `شيك مظهر من: ${outgoingCheckFormData.endorsedFromName} - مرتبط بالمعاملة: ${formData.description}`;
  }

  batch.set(chequeDocRef, chequeData);

  // معالجة سجلات الدفع حسب نوع الشيك المحاسبي
  // مهم: إنشاء سجل الدفع فقط للشيكات الفورية والمظهرة
  // Important: Create payment record only for cashed and endorsed cheques
  if (accountingType === "cashed") {
    // شيك صرف: إنشاء سجل دفع حقيقي (يؤثر على التدفق النقدي والذمم الدائنة)
    const paymentDocRef = doc(paymentsRef);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: "صرف", // صرف - دفعنا للمورد
      method: "cheque",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `شيك صرف رقم ${outgoingCheckFormData.chequeNumber} - ${formData.description}`,
      createdAt: new Date(),
    });
  } else if (accountingType === "postponed") {
    // شيك مؤجل: لا يتم إنشاء سجل دفع الآن
    // سيتم إنشاء سجل الدفع لاحقاً عند تغيير حالة الشيك إلى "تم الصرف"
    // من صفحة الشيكات الصادرة
    // No payment record created - will be created when cheque is cleared
  } else if (accountingType === "endorsed") {
    // شيك مظهر: إنشاء سجل دفع - نحن ننقل قيمة الشيك الوارد للمورد
    const paymentDocRef = doc(paymentsRef);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: "صرف", // صرف
      method: "cheque",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `شيك مظهر رقم ${outgoingCheckFormData.chequeNumber} من ${outgoingCheckFormData.endorsedFromName} - ${formData.description}`,
      createdAt: new Date(),
      isEndorsement: true,
    });
  }
}
