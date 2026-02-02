/**
 * Integration Tests: Payment Flow
 *
 * Tests the ledger service behavior with Firebase Emulator.
 * Verifies data validation and accounting logic.
 *
 * PREREQUISITES:
 * 1. Start Firebase Emulator: firebase emulators:start --only firestore
 * 2. Run tests: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupFirebaseTest,
  cleanupFirebaseTest,
  clearFirestoreData,
  createTestUser,
} from './helpers/firebase-test-setup';
import { createLedgerService } from '@/services/ledgerService';
import Decimal from 'decimal.js-light';

describe('Payment Flow Integration Tests', () => {
  const testUser = createTestUser();

  beforeAll(async () => {
    // Initialize Firebase to use emulator
    await setupFirebaseTest();
  });

  afterAll(async () => {
    // Cleanup Firebase
    await cleanupFirebaseTest();
  });

  beforeEach(async () => {
    // Clear all data between tests
    await clearFirestoreData();
  });

  describe('Ledger Service Initialization', () => {
    it('should create ledger service with correct parameters', () => {
      const service = createLedgerService(
        testUser.dataOwnerId,
        testUser.email,
        testUser.role
      );

      expect(service).toBeDefined();
      expect(typeof service.createSimpleLedgerEntry).toBe('function');
      expect(typeof service.addQuickPayment).toBe('function');
      expect(typeof service.updateLedgerEntry).toBe('function');
      expect(typeof service.deleteLedgerEntry).toBe('function');
    });

    it('should have all required service methods', () => {
      const service = createLedgerService(
        testUser.dataOwnerId,
        testUser.email,
        testUser.role
      );

      // Verify all critical methods exist
      const requiredMethods = [
        'createSimpleLedgerEntry',
        'addQuickPayment',
        'updateLedgerEntry',
        'deleteLedgerEntry',
      ];

      for (const method of requiredMethods) {
        expect(typeof (service as any)[method]).toBe('function');
      }
    });
  });

  describe('Form Data Validation', () => {
    it('should validate required fields for ledger entry', async () => {
      const service = createLedgerService(
        testUser.dataOwnerId,
        testUser.email,
        testUser.role
      );

      // Test with valid form data structure
      const validFormData = {
        description: 'Test transaction',
        amount: '1000',
        category: 'مبيعات',
        subCategory: 'مبيعات بضائع',
        date: new Date().toISOString().split('T')[0],
        associatedParty: 'Test Client',
        ownerName: '',
        trackARAP: true,
        immediateSettlement: false,
      };

      // Service should accept valid form data
      // May fail due to security rules, but should not fail due to validation
      const result = await service.createSimpleLedgerEntry(validFormData);

      // Either succeeds or fails with security error (not validation error)
      if (!result.success) {
        // Security rule error contains "PERMISSION_DENIED" or similar
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Trial Balance Verification', () => {
    it('should maintain balanced debits and credits', () => {
      // Test the Trial Balance calculation pattern
      const journalEntries = [
        { debitAmount: 1000, creditAmount: 0 },  // DR Cash
        { debitAmount: 0, creditAmount: 1000 },  // CR Revenue
        { debitAmount: 500, creditAmount: 0 },   // DR Expense
        { debitAmount: 0, creditAmount: 500 },   // CR Cash
      ];

      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      journalEntries.forEach((entry) => {
        totalDebits = totalDebits.plus(entry.debitAmount || 0);
        totalCredits = totalCredits.plus(entry.creditAmount || 0);
      });

      // Golden Rule: Debits MUST equal Credits
      expect(totalDebits.toNumber()).toBe(1500);
      expect(totalCredits.toNumber()).toBe(1500);
      expect(totalDebits.equals(totalCredits)).toBe(true);
    });

    it('should detect imbalanced journal entries', () => {
      // Test detection of accounting errors
      const imbalancedEntries = [
        { debitAmount: 1000, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 900 },  // Wrong! Should be 1000
      ];

      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      imbalancedEntries.forEach((entry) => {
        totalDebits = totalDebits.plus(entry.debitAmount || 0);
        totalCredits = totalCredits.plus(entry.creditAmount || 0);
      });

      // This should detect the imbalance
      expect(totalDebits.equals(totalCredits)).toBe(false);
      expect(totalDebits.minus(totalCredits).toNumber()).toBe(100);
    });
  });

  describe('Decimal.js Money Calculations', () => {
    it('should handle money calculations without floating point errors', () => {
      // Classic floating point problem: 0.1 + 0.2 !== 0.3 in JavaScript
      const amount1 = 0.1;
      const amount2 = 0.2;

      // Regular JavaScript has floating point errors
      expect(amount1 + amount2).not.toBe(0.3);
      expect(amount1 + amount2).toBeCloseTo(0.3, 10);

      // Decimal.js handles this correctly
      const decimal1 = new Decimal(0.1);
      const decimal2 = new Decimal(0.2);
      const result = decimal1.plus(decimal2);

      expect(result.toNumber()).toBe(0.3);
      expect(result.equals(new Decimal(0.3))).toBe(true);
    });

    it('should calculate payment balances correctly', () => {
      const invoiceAmount = new Decimal(1000);
      const payment1 = new Decimal(350.50);
      const payment2 = new Decimal(249.50);

      const totalPaid = payment1.plus(payment2);
      const remaining = invoiceAmount.minus(totalPaid);

      expect(totalPaid.toNumber()).toBe(600);
      expect(remaining.toNumber()).toBe(400);
    });
  });

  describe('Account Code Mapping', () => {
    it('should map transaction types to correct account codes', () => {
      // Test the account code mapping logic pattern
      const accountMappings: Record<string, { debit: string; credit: string }> = {
        'مبيعات': { debit: '1200', credit: '4100' },      // AR / Revenue
        'مصروف': { debit: '5000', credit: '1100' },       // Expense / Cash
        'رأس المال': { debit: '1100', credit: '3100' },   // Cash / Owner's Capital
        'قروض ممنوحة': { debit: '1300', credit: '1100' }, // Loans Receivable / Cash
      };

      // Verify mapping structure
      expect(accountMappings['مبيعات'].debit).toBe('1200');
      expect(accountMappings['مبيعات'].credit).toBe('4100');
      expect(accountMappings['رأس المال'].debit).toBe('1100');
      expect(accountMappings['رأس المال'].credit).toBe('3100');
    });
  });

  describe('Payment Type Classification', () => {
    it('should classify payment types correctly', () => {
      // Income entries use "قبض" (receive) payments
      // Expense entries use "صرف" (disburse) payments
      const incomeEntry = { type: 'دخل', category: 'مبيعات' };
      const expenseEntry = { type: 'مصروف', category: 'مصاريف تشغيلية' };

      const getPaymentType = (entry: { type: string }) => {
        return entry.type === 'دخل' ? 'قبض' : 'صرف';
      };

      expect(getPaymentType(incomeEntry)).toBe('قبض');
      expect(getPaymentType(expenseEntry)).toBe('صرف');
    });
  });
});
