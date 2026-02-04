/**
 * usePaymentAllocations Hook
 *
 * Core business logic for multi-allocation payments:
 * - FIFO distribution calculation
 * - Save allocations to Firestore
 * - Reverse allocations on payment delete
 */

import { useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  runTransaction,
  getDoc,
  arrayRemove,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import {
  UnpaidTransaction,
  AllocationEntry,
  FIFODistributionResult,
  ChequePaymentData,
} from '../types';
import { calculatePaymentStatus, calculateRemainingBalance } from '@/lib/arap-utils';
import { safeSubtract, safeAdd, sumAmounts, zeroFloor } from '@/lib/currency';
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, TRANSACTION_TYPES } from '@/lib/constants';
import {
  createJournalPostingEngine,
  getTemplateForDiscount,
  getTemplateForAdvance,
  getEntriesByLinkedPaymentId,
  getEntriesByLinkedTransactionId,
} from '@/services/journal';
import { generateTransactionId } from '@/components/ledger/utils/ledger-helpers';

/** Result from savePaymentWithAllocations */
export interface SavePaymentResult {
  paymentId: string;
  /** True if journal entry failed (payment still saved) */
  journalFailed?: boolean;
  /** ID of the created cheque (if payment method was cheque) */
  chequeId?: string;
  /** ID of the created advance ledger entry (if overpayment) */
  advanceLedgerId?: string;
  /** Amount of the advance created (if overpayment) */
  advanceAmount?: number;
}

interface UsePaymentAllocationsResult {
  loading: boolean;
  error: string | null;
  distributeFIFO: (amount: number, transactions: UnpaidTransaction[]) => FIFODistributionResult;
  savePaymentWithAllocations: (
    paymentData: {
      clientName: string;
      amount: number;
      date: Date;
      notes: string;
      type: string;
      /** Optional: Link to cheque when cashing a cheque */
      linkedChequeId?: string;
      /** Optional: Create a new cheque record when payment method is cheque */
      chequePaymentData?: ChequePaymentData;
    },
    allocations: AllocationEntry[],
    allocationMethod: 'fifo' | 'manual'
  ) => Promise<SavePaymentResult | null>;
  reversePaymentAllocations: (paymentId: string) => Promise<boolean>;
}

/**
 * Hook for managing payment allocations
 */
export function usePaymentAllocations(): UsePaymentAllocationsResult {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Distribute payment amount across transactions using FIFO (oldest first)
   */
  const distributeFIFO = (
    amount: number,
    transactions: UnpaidTransaction[]
  ): FIFODistributionResult => {
    // Sort by date ascending (oldest first) - should already be sorted, but ensure
    const sorted = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    let remainingPayment = amount;
    const allocations: AllocationEntry[] = [];

    for (const txn of sorted) {
      if (remainingPayment <= 0) {
        // No more money to allocate, add with 0 allocation
        allocations.push({
          transactionId: txn.transactionId,
          ledgerDocId: txn.id,
          transactionDate: txn.date,
          description: txn.description,
          totalAmount: txn.amount,
          remainingBalance: txn.remainingBalance,
          allocatedAmount: 0,
        });
        continue;
      }

      // Calculate how much to allocate to this transaction
      const allocationAmount = Math.min(remainingPayment, txn.remainingBalance);
      remainingPayment = safeSubtract(remainingPayment, allocationAmount);

      allocations.push({
        transactionId: txn.transactionId,
        ledgerDocId: txn.id,
        transactionDate: txn.date,
        description: txn.description,
        totalAmount: txn.amount,
        remainingBalance: txn.remainingBalance,
        allocatedAmount: allocationAmount,
      });
    }

    const totalAllocated = sumAmounts(allocations.map(a => a.allocatedAmount));

    return {
      allocations,
      totalAllocated,
      remainingPayment: zeroFloor(remainingPayment),
    };
  };

  /**
   * Save payment document and all allocations, update ledger entries
   * Uses Firestore transaction for atomicity - all operations succeed or all fail
   * If chequePaymentData is provided, also creates an incoming cheque record
   */
  const savePaymentWithAllocations = async (
    paymentData: {
      clientName: string;
      amount: number;
      date: Date;
      notes: string;
      type: string;
      /** Optional: Link to cheque when cashing a cheque */
      linkedChequeId?: string;
      /** Optional: Create a new cheque record when payment method is cheque */
      chequePaymentData?: ChequePaymentData;
    },
    allocations: AllocationEntry[],
    allocationMethod: 'fifo' | 'manual'
  ): Promise<SavePaymentResult | null> => {
    if (!user) {
      setError('المستخدم غير مسجل الدخول');
      return null;
    }

    setLoading(true);
    setError(null);

    // Filter to only allocations with amounts > 0
    const activeAllocations = allocations.filter((a) => a.allocatedAmount > 0);

    if (activeAllocations.length === 0) {
      setError('يجب تخصيص مبلغ واحد على الأقل');
      setLoading(false);
      return null;
    }

    try {
      const totalAllocated = sumAmounts(activeAllocations.map(a => a.allocatedAmount));

      // Calculate excess amount (overpayment that will become an advance)
      // Use threshold to avoid floating point issues
      const excessAmount = safeSubtract(paymentData.amount, totalAllocated);
      const hasExcess = excessAmount > 0.01;

      // Extract transaction IDs for display in the payments table
      const allocationTransactionIds = activeAllocations.map(
        (a) => a.transactionId
      );

      // Create document reference for the payment (ID generated before transaction)
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentDocRef = doc(paymentsRef);

      // Create cheque document reference if cheque payment data is provided
      let chequeDocRef: ReturnType<typeof doc> | null = null;
      if (paymentData.chequePaymentData) {
        const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
        chequeDocRef = doc(chequesRef);
      }

      // Create advance ledger document reference if there's excess (overpayment)
      // The excess will be recorded as an advance (سلفة عميل/سلفة مورد)
      let advanceLedgerDocRef: ReturnType<typeof doc> | null = null;
      let advanceTransactionId: string | null = null;
      if (hasExcess) {
        const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
        advanceLedgerDocRef = doc(ledgerRef);
        advanceTransactionId = generateTransactionId();
      }

      // Use a transaction for atomic read-modify-write
      await runTransaction(firestore, async (transaction) => {
        // 1. Read all ledger entries first (required before writes in transaction)
        const ledgerReads: { ref: ReturnType<typeof doc>; data: Record<string, unknown>; allocation: AllocationEntry }[] = [];

        for (const allocation of activeAllocations) {
          const ledgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, allocation.ledgerDocId);
          const ledgerDoc = await transaction.get(ledgerRef);

          if (!ledgerDoc.exists()) {
            throw new Error(`Ledger entry ${allocation.ledgerDocId} not found`);
          }

          ledgerReads.push({
            ref: ledgerRef,
            data: ledgerDoc.data() as Record<string, unknown>,
            allocation,
          });
        }

        // 2. Create the payment document
        // Determine the linked cheque ID (either from cashing an existing cheque or from creating a new cheque)
        const linkedChequeId = paymentData.linkedChequeId || (chequeDocRef ? chequeDocRef.id : undefined);

        // Build allocationTransactionIds - include advance if created
        // This ensures all linked transactions appear in the payments table
        const finalAllocationTransactionIds = hasExcess && advanceTransactionId
          ? [...allocationTransactionIds, advanceTransactionId]
          : allocationTransactionIds;

        transaction.set(paymentDocRef, {
          clientName: paymentData.clientName,
          amount: paymentData.amount,
          type: paymentData.type,
          date: paymentData.date,
          notes: paymentData.notes,
          createdAt: new Date(),
          isMultiAllocation: true,
          totalAllocated,
          allocationMethod,
          // Include advance in count if created
          allocationCount: hasExcess ? activeAllocations.length + 1 : activeAllocations.length,
          allocationTransactionIds: finalAllocationTransactionIds,
          linkedTransactionId: '',
          ...(linkedChequeId && { linkedChequeId }),
          // Mark as cheque payment if creating a new cheque
          ...(paymentData.chequePaymentData && { paymentMethod: 'cheque' }),
          // Advance tracking fields (if overpayment created an advance)
          ...(hasExcess && advanceLedgerDocRef && {
            advanceLedgerId: advanceLedgerDocRef.id,
            advanceTransactionId: advanceTransactionId,
            advanceAmount: excessAmount,
          }),
        });

        // 2.3. Create advance ledger entry if there's excess (overpayment)
        // This converts the overpayment into a trackable advance that can be used for future transactions
        if (hasExcess && advanceLedgerDocRef && advanceTransactionId) {
          // Determine advance category based on payment type:
          // - قبض (receipt from customer) → سلفة عميل (we owe them goods/services)
          // - صرف (payment to supplier) → سلفة مورد (they owe us goods/services)
          const advanceCategory = paymentData.type === 'قبض' ? 'سلفة عميل' : 'سلفة مورد';
          const advanceType = paymentData.type === 'قبض' ? TRANSACTION_TYPES.INCOME : TRANSACTION_TYPES.EXPENSE;
          const advanceSubCategory = advanceCategory === 'سلفة عميل' ? 'دفعة مقدمة من عميل' : 'دفعة مقدمة لمورد';

          transaction.set(advanceLedgerDocRef, {
            transactionId: advanceTransactionId,
            description: `سلفة من دفعة متعددة - ${paymentData.clientName}`,
            type: advanceType,
            category: advanceCategory,
            subCategory: advanceSubCategory,
            amount: excessAmount,
            associatedParty: paymentData.clientName,
            date: paymentData.date,
            createdAt: new Date(),
            // AR/AP tracking fields - advance is "unpaid" meaning not yet used
            isARAPEntry: true,
            totalPaid: 0,
            remainingBalance: excessAmount,
            paymentStatus: 'unpaid',
            // Link back to payment for traceability and reversal
            linkedPaymentId: paymentDocRef.id,
            // Advance-specific fields
            advanceAllocations: [], // Will be populated when advance is used
          });
        }

        // 2.5. Create the cheque document if cheque payment data is provided
        if (chequeDocRef && paymentData.chequePaymentData) {
          const { chequeNumber, bankName, issueDate, dueDate } = paymentData.chequePaymentData;

          transaction.set(chequeDocRef, {
            chequeNumber,
            clientName: paymentData.clientName,
            amount: paymentData.amount,
            type: CHEQUE_TYPES.INCOMING, // Incoming cheque (received from client)
            status: CHEQUE_STATUS_AR.CASHED, // Already cashed since payment is being made
            bankName,
            issueDate,
            dueDate,
            clearedDate: paymentData.date, // Date when it was cashed
            notes: paymentData.notes || `شيك مستلم ومحصل - ${chequeNumber}`,
            linkedPaymentId: paymentDocRef.id, // Link to the payment
            paidTransactionIds: allocationTransactionIds, // Link to the transactions that were paid
            linkedTransactionId: '', // No single linked transaction since it's multi-allocation
            createdAt: new Date(),
          });
        }

        // 3. Create allocation documents and update ledger entries
        for (const { ref: ledgerRef, data: ledgerData, allocation } of ledgerReads) {
          // Create allocation document
          const allocationsRef = collection(
            firestore,
            `users/${user.dataOwnerId}/payments/${paymentDocRef.id}/allocations`
          );
          const allocationDocRef = doc(allocationsRef);

          const allocationData: Record<string, unknown> = {
            transactionId: allocation.transactionId,
            ledgerDocId: allocation.ledgerDocId,
            allocatedAmount: allocation.allocatedAmount,
            transactionDate: allocation.transactionDate,
            description: allocation.description,
            createdAt: new Date(),
          };

          // Add discount fields if discount was given
          if (allocation.discountAmount && allocation.discountAmount > 0) {
            allocationData.discountAmount = allocation.discountAmount;
            allocationData.discountReason = allocation.discountReason || 'خصم تسوية';
          }

          transaction.set(allocationDocRef, allocationData);

          // Update ledger entry with new payment totals (including discount if any)
          const transactionAmount = (ledgerData.amount as number) || 0;
          const currentTotalPaid = (ledgerData.totalPaid as number) || 0;
          const currentTotalDiscount = (ledgerData.totalDiscount as number) || 0;
          const writeoffAmount = (ledgerData.writeoffAmount as number) || 0;

          const newTotalPaid = safeAdd(currentTotalPaid, allocation.allocatedAmount);
          const discountAmount = allocation.discountAmount || 0;
          const newTotalDiscount = safeAdd(currentTotalDiscount, discountAmount);

          const newRemainingBalance = calculateRemainingBalance(
            transactionAmount,
            newTotalPaid,
            newTotalDiscount,
            writeoffAmount
          );
          const newStatus = calculatePaymentStatus(
            newTotalPaid,
            transactionAmount,
            newTotalDiscount,
            writeoffAmount
          );

          // Build update object
          const updateData: Record<string, unknown> = {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          };

          // Only update totalDiscount if there's a discount
          if (discountAmount > 0 || currentTotalDiscount > 0) {
            updateData.totalDiscount = newTotalDiscount;
          }

          transaction.update(ledgerRef, updateData);
        }
      });

      // Create journal entry for the payment
      const paymentDescription = `دفعة ${paymentData.type === 'قبض' ? 'واردة من' : 'صادرة إلى'} ${paymentData.clientName}`;
      let journalCreated = true;

      try {
        const engine = createJournalPostingEngine(user.dataOwnerId);
        const templateId = paymentData.type === "قبض" ? "PAYMENT_RECEIPT" : "PAYMENT_DISBURSEMENT";
        const journalResult = await engine.post({
          templateId,
          amount: totalAllocated,
          date: paymentData.date,
          description: paymentDescription,
          source: {
            type: "payment",
            documentId: paymentDocRef.id,
            transactionId: allocationTransactionIds[0], // Link to first transaction
          },
        });

        if (!journalResult.success) {
          journalCreated = false;
          console.error(
            "Journal entry failed for payment:",
            paymentDocRef.id,
            journalResult.error
          );
        }
      } catch (err) {
        journalCreated = false;
        console.error("Failed to create journal entry for payment:", paymentDocRef.id, err);
      }

      // BUG FIX: Create discount journal entries for each allocation with discount
      // Without these journals, Trial Balance would show incorrect AR/AP balances
      // because discounts reduce the outstanding amount without a journal entry.
      //
      // For income (قبض): DR Sales Discount (4300), CR AR (1200)
      // For expense (صرف): DR AP (2000), CR Purchase Discount (5050)
      const discountAllocations = activeAllocations.filter(
        (a) => a.discountAmount && a.discountAmount > 0
      );

      if (discountAllocations.length > 0) {
        const engine = createJournalPostingEngine(user.dataOwnerId);
        const entryType = paymentData.type === 'قبض' ? 'دخل' : 'مصروف';

        for (const allocation of discountAllocations) {
          if (!allocation.discountAmount) {continue;}

          try {
            const templateId = getTemplateForDiscount(entryType as 'دخل' | 'مصروف');
            const discountResult = await engine.post({
              templateId,
              amount: allocation.discountAmount,
              date: paymentData.date,
              description: `خصم تسوية - ${allocation.description}`,
              source: {
                type: 'discount',
                documentId: paymentDocRef.id,
                transactionId: allocation.transactionId,
              },
            });

            if (!discountResult.success) {
              console.error(
                "Discount journal failed for allocation:",
                allocation.transactionId,
                discountResult.error
              );
            }
          } catch (discountErr) {
            // Log but don't fail - payment is already saved
            console.error(
              "Failed to create discount journal for allocation:",
              allocation.transactionId,
              discountErr
            );
          }
        }
      }

      // Create advance journal entry if overpayment created an advance
      // This is critical for Trial Balance accuracy:
      // - Customer advance (قبض): DR Cash, CR Customer Advances (liability - we owe goods/services)
      // - Supplier advance (صرف): DR Supplier Advances (asset - they owe us goods/services), CR Cash
      if (hasExcess && advanceLedgerDocRef && advanceTransactionId) {
        try {
          const engine = createJournalPostingEngine(user.dataOwnerId);
          const advanceCategory = paymentData.type === 'قبض' ? 'سلفة عميل' : 'سلفة مورد';
          const advanceTemplateId = getTemplateForAdvance(advanceCategory);
          // Source type for journal - matches JournalSourceType enum
          const advanceSourceType = paymentData.type === 'قبض' ? 'advance_client' : 'advance_supplier';

          const advanceJournalResult = await engine.post({
            templateId: advanceTemplateId,
            amount: excessAmount,
            date: paymentData.date,
            description: `سلفة من دفعة متعددة - ${paymentData.clientName}`,
            source: {
              type: advanceSourceType,
              documentId: advanceLedgerDocRef.id,
              transactionId: advanceTransactionId,
            },
          });

          if (!advanceJournalResult.success) {
            console.error(
              "Advance journal failed:",
              advanceLedgerDocRef.id,
              advanceJournalResult.error
            );
          }
        } catch (advanceErr) {
          // Log but don't fail - payment and advance ledger entry are already saved
          console.error(
            "Failed to create advance journal:",
            advanceLedgerDocRef.id,
            advanceErr
          );
        }
      }

      setLoading(false);

      return {
        paymentId: paymentDocRef.id,
        journalFailed: !journalCreated,
        // Include advance info in result so caller can show confirmation to user
        ...(hasExcess && advanceLedgerDocRef && {
          advanceLedgerId: advanceLedgerDocRef.id,
          advanceAmount: excessAmount,
        }),
        ...(chequeDocRef && { chequeId: chequeDocRef.id }),
      };
    } catch (err) {
      console.error('Error saving payment with allocations:', err);
      setError('حدث خطأ أثناء حفظ الدفعة');
      setLoading(false);
      return null;
    }
  };

  /**
   * Reverse all allocations for a payment (used when deleting)
   * Uses Firestore transaction for atomicity - all operations succeed or all fail
   *
   * Also cleans up orphaned array references:
   * - For advance allocations: removes entry from advanceAllocations array on the advance
   * - For regular allocations: removes entry from paidFromAdvances array if paid by advance
   */
  const reversePaymentAllocations = async (paymentId: string): Promise<boolean> => {
    if (!user) {
      setError('المستخدم غير مسجل الدخول');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // First, fetch allocations outside transaction (can't query in transaction)
      const allocationsRef = collection(
        firestore,
        `users/${user.dataOwnerId}/payments/${paymentId}/allocations`
      );
      const allocationsSnapshot = await getDocs(allocationsRef);
      const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, paymentId);

      // Read payment document outside transaction to get advanceTransactionId for journal reversal
      // (We also read inside transaction for atomicity, but need this for post-transaction journal work)
      const prePaymentDoc = await getDoc(paymentRef);
      const advanceTransactionIdForJournals = prePaymentDoc.exists()
        ? (prePaymentDoc.data()?.advanceTransactionId as string | undefined)
        : undefined;

      // Use transaction for atomic reversal
      // IMPORTANT: Firestore transactions require ALL reads before ANY writes
      await runTransaction(firestore, async (transaction) => {
        // ============ PHASE 1: ALL READS ============

        // 1a. Read the payment document to check for linked advance
        const paymentDoc = await transaction.get(paymentRef);
        const paymentData = paymentDoc.exists() ? paymentDoc.data() : null;

        // Store advance info for deletion after reads
        const advanceLedgerId = paymentData?.advanceLedgerId as string | undefined;
        const advanceTransactionId = paymentData?.advanceTransactionId as string | undefined;

        // Read advance ledger entry if it exists
        let advanceLedgerRef: ReturnType<typeof doc> | null = null;
        if (advanceLedgerId) {
          advanceLedgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, advanceLedgerId);
          await transaction.get(advanceLedgerRef); // Read to satisfy Firestore requirements
        }

        // 1b. Read all ledger entries that need updating
        const ledgerUpdates: {
          ref: ReturnType<typeof doc>;
          data: Record<string, unknown>;
          allocatedAmount: number;
          discountAmount: number;
          isAdvance: boolean;
          transactionId: string;
          ledgerDocId: string;
        }[] = [];

        for (const allocationDoc of allocationsSnapshot.docs) {
          const allocation = allocationDoc.data();
          const ledgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, allocation.ledgerDocId);
          const ledgerDoc = await transaction.get(ledgerRef);

          if (ledgerDoc.exists()) {
            ledgerUpdates.push({
              ref: ledgerRef,
              data: ledgerDoc.data() as Record<string, unknown>,
              allocatedAmount: allocation.allocatedAmount || 0,
              discountAmount: allocation.discountAmount || 0,
              isAdvance: allocation.isAdvance === true,
              transactionId: allocation.transactionId || '',
              ledgerDocId: allocation.ledgerDocId || '',
            });
          }
        }

        // 1b. Collect all advance IDs that need cleanup and read them upfront
        // This must happen BEFORE any writes to satisfy Firestore transaction requirements
        const advanceUpdates: {
          ref: ReturnType<typeof doc>;
          data: Record<string, unknown>;
          invoiceLedgerDocId: string;
          invoiceTransactionId: string;
        }[] = [];

        for (const { data: ledgerData, isAdvance, transactionId, ledgerDocId } of ledgerUpdates) {
          const paidFromAdvances = ledgerData.paidFromAdvances as Array<{
            advanceId: string;
            advanceTransactionId: string;
            amount: number;
            date: Date;
          }> | undefined;

          if (paidFromAdvances && paidFromAdvances.length > 0 && !isAdvance) {
            for (const advancePayment of paidFromAdvances) {
              // Check if we already read this advance (avoid duplicate reads)
              const alreadyRead = advanceUpdates.some(au => au.ref.id === advancePayment.advanceId);
              if (!alreadyRead) {
                try {
                  const advanceRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, advancePayment.advanceId);
                  const advanceDoc = await transaction.get(advanceRef);

                  if (advanceDoc.exists()) {
                    advanceUpdates.push({
                      ref: advanceRef,
                      data: advanceDoc.data() as Record<string, unknown>,
                      invoiceLedgerDocId: ledgerDocId,
                      invoiceTransactionId: transactionId,
                    });
                  }
                } catch (advanceError) {
                  // Log but continue - advance may have been deleted
                  console.error(`Failed to read advance ${advancePayment.advanceId}:`, advanceError);
                }
              }
            }
          }
        }

        // ============ PHASE 2: ALL WRITES ============

        // 2. Delete allocation documents
        for (const allocationDoc of allocationsSnapshot.docs) {
          transaction.delete(allocationDoc.ref);
        }

        // 3. Delete payment document
        transaction.delete(paymentRef);

        // 3b. Delete advance ledger entry if this payment created one
        if (advanceLedgerRef) {
          transaction.delete(advanceLedgerRef);
        }

        // 4. Update ledger entries (reverse the payments and discounts)
        for (const { ref: ledgerRef, data: ledgerData, allocatedAmount, discountAmount, isAdvance } of ledgerUpdates) {
          const transactionAmount = (ledgerData.amount as number) || 0;
          const currentTotalPaid = (ledgerData.totalPaid as number) || 0;
          const currentTotalDiscount = (ledgerData.totalDiscount as number) || 0;
          const writeoffAmount = (ledgerData.writeoffAmount as number) || 0;

          const newTotalPaid = zeroFloor(safeSubtract(currentTotalPaid, allocatedAmount));
          const newTotalDiscount = zeroFloor(safeSubtract(currentTotalDiscount, discountAmount));

          const newRemainingBalance = calculateRemainingBalance(
            transactionAmount,
            newTotalPaid,
            newTotalDiscount,
            writeoffAmount
          );
          const newStatus = calculatePaymentStatus(
            newTotalPaid,
            transactionAmount,
            newTotalDiscount,
            writeoffAmount
          );

          // Build update object
          const updateData: Record<string, unknown> = {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          };

          // Update totalDiscount if it was affected
          if (discountAmount > 0 || currentTotalDiscount > 0) {
            updateData.totalDiscount = newTotalDiscount;
          }

          // Clean up paidFromAdvances array if this invoice was paid by advances
          const paidFromAdvances = ledgerData.paidFromAdvances as Array<{
            advanceId: string;
            advanceTransactionId: string;
            amount: number;
            date: Date;
          }> | undefined;

          if (paidFromAdvances && paidFromAdvances.length > 0 && !isAdvance) {
            // Clear the entire paidFromAdvances array and totalPaidFromAdvances
            // since we're reversing the full payment
            updateData.paidFromAdvances = [];
            updateData.totalPaidFromAdvances = 0;
          }

          transaction.update(ledgerRef, updateData);
        }

        // 5. Update advance entries (clean up advanceAllocations arrays)
        // We collected all invoice IDs that were paid by each advance
        for (const { ref: advanceRef, data: advanceData, invoiceLedgerDocId, invoiceTransactionId } of advanceUpdates) {
          const advanceAllocations = advanceData.advanceAllocations as Array<{
            invoiceId: string;
            invoiceTransactionId: string;
            amount: number;
            date: Date;
            description: string;
          }> | undefined;

          if (advanceAllocations && advanceAllocations.length > 0) {
            // Find and remove the allocation entry for this invoice
            const filteredAllocations = advanceAllocations.filter(
              (alloc) => alloc.invoiceId !== invoiceLedgerDocId && alloc.invoiceTransactionId !== invoiceTransactionId
            );

            // Recalculate totalPaid based on remaining allocations
            const newAdvanceTotalPaid = filteredAllocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
            const advanceAmount = (advanceData.amount as number) || 0;
            const newAdvanceRemainingBalance = zeroFloor(safeSubtract(advanceAmount, newAdvanceTotalPaid));
            const newAdvanceStatus = newAdvanceTotalPaid <= 0 ? 'unpaid' :
              newAdvanceRemainingBalance <= 0 ? 'paid' : 'partial';

            transaction.update(advanceRef, {
              advanceAllocations: filteredAllocations,
              totalPaid: newAdvanceTotalPaid,
              remainingBalance: newAdvanceRemainingBalance,
              paymentStatus: newAdvanceStatus,
            });
          }
        }
      });

      // Reverse linked journal entries (immutable ledger pattern)
      try {
        const engine = createJournalPostingEngine(user.dataOwnerId);

        // Reverse payment journal entries
        const linkedJournals = await getEntriesByLinkedPaymentId(user.dataOwnerId, paymentId);
        for (const journal of linkedJournals) {
          if (journal.status !== "reversed") {
            await engine.reverse(journal.id, "حذف مدفوعة");
          }
        }

        // Reverse advance journal entries if this payment created an advance
        if (advanceTransactionIdForJournals) {
          const advanceJournals = await getEntriesByLinkedTransactionId(
            user.dataOwnerId,
            advanceTransactionIdForJournals
          );
          for (const journal of advanceJournals) {
            if (journal.status !== "reversed") {
              await engine.reverse(journal.id, "حذف دفعة متعددة (إلغاء السلفة)");
            }
          }
        }
      } catch (journalError) {
        console.error("Failed to reverse journal entries for payment:", journalError);
        // Continue - payment is already deleted, journal cleanup failure is logged
      }

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error reversing payment allocations:', err);
      setError('حدث خطأ أثناء حذف الدفعة');
      setLoading(false);
      return false;
    }
  };

  return {
    loading,
    error,
    distributeFIFO,
    savePaymentWithAllocations,
    reversePaymentAllocations,
  };
}
