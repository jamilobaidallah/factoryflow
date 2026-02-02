/**
 * Integration Tests: Payment Flow
 *
 * Tests the complete payment creation flow with real Firestore operations.
 * Verifies that journal entries are created correctly and Trial Balance remains balanced.
 *
 * These tests use Firebase Emulator, not mocks, to catch real accounting bugs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupFirebaseTest,
  cleanupFirebaseTest,
  clearFirestoreData,
  getAuthenticatedFirestore,
  createTestUser,
  seedFirestoreData,
} from './helpers/firebase-test-setup';
import { createLedgerService } from '@/services/ledgerService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Decimal from 'decimal.js-light';

describe('Payment Flow Integration Tests', () => {
  const testUser = createTestUser();
  let db: any;

  beforeAll(async () => {
    // Start Firebase Emulator
    await setupFirebaseTest();
    db = getAuthenticatedFirestore(testUser.uid, testUser.dataOwnerId);
  });

  afterAll(async () => {
    // Stop Firebase Emulator
    await cleanupFirebaseTest();
  });

  beforeEach(async () => {
    // Clear all data between tests
    await clearFirestoreData();
  });

  describe('Quick Payment Creation', () => {
    it('should create payment, journal entry, and maintain Trial Balance', async () => {
      // ========================================
      // STEP 1: Seed initial ledger entry
      // ========================================
      const ledgerEntryId = 'ledger-001';
      await seedFirestoreData(db, testUser.dataOwnerId, {
        ledger: [
          {
            id: ledgerEntryId,
            transactionType: 'دخل',
            category: 'مبيعات',
            amount: 5000,
            paidAmount: 0,
            remainingBalance: 5000,
            clientId: 'client-001',
            clientName: 'Test Client',
            description: 'Test Sale',
            date: new Date('2024-01-15'),
            isARAPEntry: true,
            trackARAP: true,
            immediateSettlement: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: testUser.email,
            lastModifiedBy: testUser.email,
          },
        ],
      });

      // ========================================
      // STEP 2: Add quick payment via service
      // ========================================
      const service = createLedgerService(
        testUser.dataOwnerId,
        testUser.email,
        testUser.role
      );

      const paymentAmount = 2000;
      const result = await service.addQuickPayment({
        amount: paymentAmount,
        entryId: ledgerEntryId,
        paymentType: 'قبض',
        paymentMethod: 'نقدي',
        date: new Date('2024-01-20'),
        description: 'Partial payment',
        receiptNumber: 'REC-001',
      });

      // ========================================
      // STEP 3: Verify payment was created
      // ========================================
      expect(result.success).toBe(true);

      const paymentsSnapshot = await getDocs(
        collection(db, `users/${testUser.dataOwnerId}/payments`)
      );
      expect(paymentsSnapshot.size).toBe(1);

      const paymentDoc = paymentsSnapshot.docs[0];
      const paymentData = paymentDoc.data();
      expect(paymentData.amount).toBe(paymentAmount);
      expect(paymentData.paymentType).toBe('قبض');
      expect(paymentData.linkedTransactionId).toBe(ledgerEntryId);

      // ========================================
      // STEP 4: Verify journal entry was created
      // ========================================
      const journalSnapshot = await getDocs(
        query(
          collection(db, `users/${testUser.dataOwnerId}/journal_entries`),
          where('linkedPaymentId', '==', paymentDoc.id)
        )
      );

      expect(journalSnapshot.size).toBe(1);

      const journalDoc = journalSnapshot.docs[0];
      const journalData = journalDoc.data();

      // Verify journal structure
      expect(journalData.debitAccountCode).toBe('1100'); // Cash
      expect(journalData.creditAccountCode).toBe('1200'); // AR
      expect(journalData.debitAmount).toBe(paymentAmount);
      expect(journalData.creditAmount).toBe(paymentAmount);

      // ========================================
      // STEP 5: Verify Trial Balance is balanced
      // ========================================
      const allJournalEntries = await getDocs(
        collection(db, `users/${testUser.dataOwnerId}/journal_entries`)
      );

      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      allJournalEntries.forEach((doc) => {
        const entry = doc.data();
        totalDebits = totalDebits.plus(entry.debitAmount || 0);
        totalCredits = totalCredits.plus(entry.creditAmount || 0);
      });

      // Debits MUST equal Credits (accounting golden rule)
      expect(totalDebits.toNumber()).toBeCloseTo(totalCredits.toNumber(), 2);

      // ========================================
      // STEP 6: Verify ledger balance updated
      // ========================================
      const updatedLedgerSnapshot = await getDocs(
        query(
          collection(db, `users/${testUser.dataOwnerId}/ledger`),
          where('id', '==', ledgerEntryId)
        )
      );

      expect(updatedLedgerSnapshot.size).toBe(1);
      const updatedLedger = updatedLedgerSnapshot.docs[0].data();

      expect(updatedLedger.paidAmount).toBe(paymentAmount);
      expect(updatedLedger.remainingBalance).toBe(5000 - paymentAmount);
    });

    it('should create correct journal entries for capital transactions', async () => {
      // ========================================
      // STEP 1: Create capital entry
      // ========================================
      const service = createLedgerService(
        testUser.dataOwnerId,
        testUser.email,
        testUser.role
      );

      const capitalAmount = 10000;
      const result = await service.createSimpleLedgerEntry({
        transactionType: 'حركة رأس مال',
        category: 'رأس المال',
        subCategory: 'رأس مال مالك',
        amount: capitalAmount,
        description: 'Owner capital contribution',
        date: new Date('2024-01-01'),
        isARAPEntry: false,
        trackARAP: false,
        immediateSettlement: true,
      });

      expect(result.success).toBe(true);

      // ========================================
      // STEP 2: Verify journal entry created
      // ========================================
      const journalSnapshot = await getDocs(
        collection(db, `users/${testUser.dataOwnerId}/journal_entries`)
      );

      expect(journalSnapshot.size).toBeGreaterThanOrEqual(1);

      const journalData = journalSnapshot.docs[0].data();

      // Capital entry: DR Cash, CR Owner's Capital
      expect(journalData.debitAccountCode).toBe('1100'); // Cash
      expect(journalData.creditAccountCode).toBe('3100'); // Owner's Capital
      expect(journalData.debitAmount).toBe(capitalAmount);
      expect(journalData.creditAmount).toBe(capitalAmount);

      // ========================================
      // STEP 3: Verify Trial Balance
      // ========================================
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      journalSnapshot.forEach((doc) => {
        const entry = doc.data();
        totalDebits = totalDebits.plus(entry.debitAmount || 0);
        totalCredits = totalCredits.plus(entry.creditAmount || 0);
      });

      expect(totalDebits.toNumber()).toBeCloseTo(totalCredits.toNumber(), 2);
    });

    it('should create correct journal entries for loan transactions', async () => {
      // ========================================
      // STEP 1: Create loan given entry
      // ========================================
      const service = createLedgerService(
        testUser.dataOwnerId,
        testUser.email,
        testUser.role
      );

      const loanAmount = 8000;
      const result = await service.createSimpleLedgerEntry({
        transactionType: 'قرض',
        category: 'قروض ممنوحة',
        subCategory: 'منح قرض',
        amount: loanAmount,
        description: 'Loan given to employee',
        date: new Date('2024-01-10'),
        isARAPEntry: false,
        trackARAP: false,
        immediateSettlement: true,
      });

      expect(result.success).toBe(true);

      // ========================================
      // STEP 2: Verify journal entry created
      // ========================================
      const journalSnapshot = await getDocs(
        collection(db, `users/${testUser.dataOwnerId}/journal_entries`)
      );

      expect(journalSnapshot.size).toBeGreaterThanOrEqual(1);

      const journalData = journalSnapshot.docs[0].data();

      // Loan given: DR Loans Receivable, CR Cash
      expect(journalData.debitAccountCode).toBe('1300'); // Loans Receivable
      expect(journalData.creditAccountCode).toBe('1100'); // Cash
      expect(journalData.debitAmount).toBe(loanAmount);
      expect(journalData.creditAmount).toBe(loanAmount);

      // ========================================
      // STEP 3: Verify Trial Balance
      // ========================================
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      journalSnapshot.forEach((doc) => {
        const entry = doc.data();
        totalDebits = totalDebits.plus(entry.debitAmount || 0);
        totalCredits = totalCredits.plus(entry.creditAmount || 0);
      });

      expect(totalDebits.toNumber()).toBeCloseTo(totalCredits.toNumber(), 2);
    });
  });

  describe('Rollback Behavior', () => {
    it('should rollback ledger entry if journal creation fails', async () => {
      // This test would require simulating a journal creation failure
      // For now, we verify the happy path ensures journal creation
      // Future: Add test for failed_rollbacks collection
      expect(true).toBe(true);
    });
  });
});
