/**
 * Cheque Handlers Tests
 *
 * Comprehensive tests for incoming and outgoing cheque batch operations.
 */

import { handleIncomingCheckBatch, handleOutgoingCheckBatch } from "../chequeHandlers";
import type { HandlerContext } from "../../types";
import type { CheckFormData, OutgoingCheckFormData, LedgerFormData } from "@/components/ledger/types/ledger";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import { addPaymentJournalEntryToBatch } from "@/services/journalService";

// Mock firebase/firestore
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ id: `mock-doc-${Math.random().toString(36).substr(2, 9)}` })),
}));

// Mock journalService to avoid Firebase initialization and verify calls
jest.mock("@/services/journalService", () => ({
  addPaymentJournalEntryToBatch: jest.fn(),
}));

const mockAddPaymentJournalEntryToBatch = addPaymentJournalEntryToBatch as jest.Mock;

describe("Cheque Handlers", () => {
  // Helper to create base form data
  const createBaseFormData = (overrides: Partial<LedgerFormData> = {}): LedgerFormData => ({
    date: "2024-01-15",
    category: "مبيعات",
    subCategory: "",
    amount: "1000",
    associatedParty: "عميل اختبار",
    description: "معاملة اختبار",
    ownerName: "",
    trackARAP: false,
    immediateSettlement: false,
    ...overrides,
  });

  // Helper to create incoming cheque form data
  const createCheckFormData = (overrides: Partial<CheckFormData> = {}): CheckFormData => ({
    chequeNumber: "CHQ-001",
    chequeAmount: "500",
    bankName: "البنك الأهلي",
    dueDate: "2024-02-15",
    accountingType: "cashed",
    endorsedToName: "",
    ...overrides,
  });

  // Helper to create outgoing cheque form data
  const createOutgoingCheckFormData = (overrides: Partial<OutgoingCheckFormData> = {}): OutgoingCheckFormData => ({
    chequeNumber: "CHQ-OUT-001",
    chequeAmount: "750",
    bankName: "بنك الراجحي",
    dueDate: "2024-02-20",
    accountingType: "cashed",
    endorsedFromName: "",
    ...overrides,
  });

  // Helper to create mock handler context
  const createMockContext = (
    formData: LedgerFormData,
    entryType: string = "دخل"
  ): HandlerContext => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(),
    };

    return {
      batch: mockBatch as any,
      transactionId: "TXN-TEST-123",
      formData,
      entryType,
      userId: "test-user-123",
      refs: {
        ledger: { id: "ledger" } as any,
        cheques: { id: "cheques" } as any,
        payments: { id: "payments" } as any,
        inventory: { id: "inventory" } as any,
        inventoryMovements: { id: "inventory_movements" } as any,
        fixedAssets: { id: "fixed_assets" } as any,
      },
    };
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleIncomingCheckBatch", () => {
    describe("Cashed Cheques (accountingType: cashed)", () => {
      it("should create cheque and payment for income entry", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ accountingType: "cashed" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        // Should call batch.set twice: once for cheque, once for payment
        expect(ctx.batch.set).toHaveBeenCalledTimes(2);

        // Check cheque creation
        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1]).toMatchObject({
          chequeNumber: "CHQ-001",
          clientName: "عميل اختبار",
          amount: 500,
          type: CHEQUE_TYPES.INCOMING,
          status: CHEQUE_STATUS_AR.CASHED,
          linkedTransactionId: "TXN-TEST-123",
          bankName: "البنك الأهلي",
          accountingType: "cashed",
          chequeType: "عادي",
        });

        // Check payment creation - should be RECEIPT for income
        const paymentCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(paymentCall[1]).toMatchObject({
          clientName: "عميل اختبار",
          amount: 500,
          type: PAYMENT_TYPES.RECEIPT,
          method: "cheque",
          linkedTransactionId: "TXN-TEST-123",
        });

        // Verify journal entry was created for double-entry accounting
        expect(mockAddPaymentJournalEntryToBatch).toHaveBeenCalledTimes(1);
        expect(mockAddPaymentJournalEntryToBatch).toHaveBeenCalledWith(
          ctx.batch,
          "test-user-123",
          expect.objectContaining({
            amount: 500,
            paymentType: PAYMENT_TYPES.RECEIPT,
            linkedTransactionId: "TXN-TEST-123",
          })
        );
      });

      it("should create cheque and disbursement payment for expense entry", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ accountingType: "cashed" });
        const ctx = createMockContext(formData, "مصروف");

        handleIncomingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).toHaveBeenCalledTimes(2);

        // Check payment type - should be DISBURSEMENT for expense
        const paymentCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(paymentCall[1].type).toBe(PAYMENT_TYPES.DISBURSEMENT);
      });

      it("should create cheque but skip payment when immediateSettlement is true", () => {
        const formData = createBaseFormData({ immediateSettlement: true });
        const checkData = createCheckFormData({ accountingType: "cashed" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        // Should only call batch.set once for cheque (no payment)
        expect(ctx.batch.set).toHaveBeenCalledTimes(1);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].status).toBe(CHEQUE_STATUS_AR.CASHED);
      });
    });

    describe("Postponed Cheques (accountingType: postponed)", () => {
      it("should create cheque with PENDING status, no payment, and no journal entry", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ accountingType: "postponed" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        // Should only create cheque (no payment for postponed)
        expect(ctx.batch.set).toHaveBeenCalledTimes(1);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1]).toMatchObject({
          status: CHEQUE_STATUS_AR.PENDING,
          accountingType: "postponed",
        });

        // No journal entry for postponed cheques (no cash movement yet)
        expect(mockAddPaymentJournalEntryToBatch).not.toHaveBeenCalled();
      });
    });

    describe("Endorsed Cheques (accountingType: endorsed)", () => {
      it("should create cheque with ENDORSED status and two payments", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({
          accountingType: "endorsed",
          endorsedToName: "المستفيد الجديد",
        });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        // Should call batch.set three times: cheque + 2 payments
        expect(ctx.batch.set).toHaveBeenCalledTimes(3);

        // Check cheque creation
        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1]).toMatchObject({
          status: CHEQUE_STATUS_AR.ENDORSED,
          chequeType: "مجير",
          endorsedTo: "المستفيد الجديد",
          accountingType: "endorsed",
        });
        expect(chequeCall[1].endorsedDate).toBeDefined();

        // Check receipt payment (from original client)
        const receiptCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(receiptCall[1]).toMatchObject({
          clientName: "عميل اختبار",
          type: PAYMENT_TYPES.RECEIPT,
          isEndorsement: true,
          noCashMovement: true,
        });

        // Check disbursement payment (to endorsed party)
        const disbursementCall = (ctx.batch.set as jest.Mock).mock.calls[2];
        expect(disbursementCall[1]).toMatchObject({
          clientName: "المستفيد الجديد",
          type: PAYMENT_TYPES.DISBURSEMENT,
          isEndorsement: true,
          noCashMovement: true,
        });
      });

      it("should still create endorsed cheque without endorsedToName", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({
          accountingType: "endorsed",
          endorsedToName: "", // Empty
        });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        // Should still create cheque and payments
        expect(ctx.batch.set).toHaveBeenCalledTimes(3);

        // Cheque should not have endorsedTo/endorsedDate since endorsedToName is empty
        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].endorsedTo).toBeUndefined();
      });
    });

    describe("Validation - Invalid Cheques", () => {
      it("should skip cheque with missing cheque number", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ chequeNumber: "" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("invalid incoming cheque")
        );

        consoleWarnSpy.mockRestore();
      });

      it("should skip cheque with whitespace-only cheque number", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ chequeNumber: "   " });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });

      it("should skip cheque with zero amount", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ chequeAmount: "0" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });

      it("should skip cheque with negative amount", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ chequeAmount: "-100" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });

      it("should skip cheque with NaN amount", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ chequeAmount: "invalid" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });
    });

    describe("Edge Cases", () => {
      it("should use 'غير محدد' when associatedParty is empty", () => {
        const formData = createBaseFormData({ associatedParty: "" });
        const checkData = createCheckFormData();
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].clientName).toBe("غير محدد");
      });

      it("should handle decimal amounts correctly", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ chequeAmount: "1234.56" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].amount).toBe(1234.56);
      });

      it("should include category and subCategory in payment", () => {
        const formData = createBaseFormData({
          category: "مبيعات",
          subCategory: "منتجات جاهزة",
        });
        const checkData = createCheckFormData();
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        const paymentCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(paymentCall[1].category).toBe("مبيعات");
        expect(paymentCall[1].subCategory).toBe("منتجات جاهزة");
      });

      it("should set correct dates", () => {
        const formData = createBaseFormData({ date: "2024-03-20" });
        const checkData = createCheckFormData({ dueDate: "2024-04-20" });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].issueDate).toBeInstanceOf(Date);
        expect(chequeCall[1].dueDate).toBeInstanceOf(Date);
        expect(chequeCall[1].createdAt).toBeInstanceOf(Date);
      });

      it("should default accountingType to cashed if not specified", () => {
        const formData = createBaseFormData();
        const checkData = createCheckFormData({ accountingType: undefined as any });
        const ctx = createMockContext(formData, "دخل");

        handleIncomingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].status).toBe(CHEQUE_STATUS_AR.CASHED);
      });
    });
  });

  describe("handleOutgoingCheckBatch", () => {
    describe("Cashed Cheques (accountingType: cashed)", () => {
      it("should create cheque and disbursement payment", () => {
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ accountingType: "cashed" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        // Should call batch.set twice: cheque + payment
        expect(ctx.batch.set).toHaveBeenCalledTimes(2);

        // Check cheque creation
        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1]).toMatchObject({
          chequeNumber: "CHQ-OUT-001",
          clientName: "عميل اختبار",
          amount: 750,
          type: CHEQUE_TYPES.OUTGOING,
          status: CHEQUE_STATUS_AR.CASHED,
          linkedTransactionId: "TXN-TEST-123",
          bankName: "بنك الراجحي",
          accountingType: "cashed",
          chequeType: "عادي",
        });

        // Check payment - should always be DISBURSEMENT for outgoing
        const paymentCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(paymentCall[1]).toMatchObject({
          clientName: "عميل اختبار",
          amount: 750,
          type: PAYMENT_TYPES.DISBURSEMENT,
          method: "cheque",
          linkedTransactionId: "TXN-TEST-123",
        });

        // Verify journal entry was created for double-entry accounting
        expect(mockAddPaymentJournalEntryToBatch).toHaveBeenCalledTimes(1);
        expect(mockAddPaymentJournalEntryToBatch).toHaveBeenCalledWith(
          ctx.batch,
          "test-user-123",
          expect.objectContaining({
            amount: 750,
            paymentType: PAYMENT_TYPES.DISBURSEMENT,
            linkedTransactionId: "TXN-TEST-123",
          })
        );
      });

      it("should create cheque but skip payment and journal entry when immediateSettlement is true", () => {
        const formData = createBaseFormData({ immediateSettlement: true });
        const checkData = createOutgoingCheckFormData({ accountingType: "cashed" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        // Should only create cheque (no payment, no journal entry)
        expect(ctx.batch.set).toHaveBeenCalledTimes(1);
        expect(mockAddPaymentJournalEntryToBatch).not.toHaveBeenCalled();
      });
    });

    describe("Postponed Cheques (accountingType: postponed)", () => {
      it("should create cheque with PENDING status, no payment, and no journal entry", () => {
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ accountingType: "postponed" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        // Should only create cheque (no payment for postponed)
        expect(ctx.batch.set).toHaveBeenCalledTimes(1);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1]).toMatchObject({
          status: CHEQUE_STATUS_AR.PENDING,
          accountingType: "postponed",
        });

        // No journal entry for postponed cheques (no cash movement yet)
        expect(mockAddPaymentJournalEntryToBatch).not.toHaveBeenCalled();
      });
    });

    describe("Endorsed Cheques (accountingType: endorsed)", () => {
      it("should create cheque with endorsement info and payment", () => {
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({
          accountingType: "endorsed",
          endorsedFromName: "المصدر الأصلي",
        });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        // Should create cheque + payment
        expect(ctx.batch.set).toHaveBeenCalledTimes(2);

        // Check cheque creation with endorsement info
        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1]).toMatchObject({
          chequeType: "مظهر",
          isEndorsedCheque: true,
          endorsedFromName: "المصدر الأصلي",
          accountingType: "endorsed",
        });
        expect(chequeCall[1].notes).toContain("المصدر الأصلي");

        // Check payment with endorsement flag
        const paymentCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(paymentCall[1]).toMatchObject({
          type: PAYMENT_TYPES.DISBURSEMENT,
          isEndorsement: true,
        });
        expect(paymentCall[1].notes).toContain("المصدر الأصلي");
      });

      it("should use CASHED status for endorsed cheques", () => {
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ accountingType: "endorsed" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        // Endorsed outgoing cheques default to CASHED status
        expect(chequeCall[1].status).toBe(CHEQUE_STATUS_AR.CASHED);
      });
    });

    describe("Validation - Invalid Cheques", () => {
      it("should skip cheque with missing cheque number", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ chequeNumber: "" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("invalid outgoing cheque")
        );

        consoleWarnSpy.mockRestore();
      });

      it("should skip cheque with zero amount", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ chequeAmount: "0" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });

      it("should skip cheque with negative amount", () => {
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ chequeAmount: "-500" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        expect(ctx.batch.set).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });
    });

    describe("Edge Cases", () => {
      it("should use 'غير محدد' when associatedParty is empty", () => {
        const formData = createBaseFormData({ associatedParty: "" });
        const checkData = createOutgoingCheckFormData();
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].clientName).toBe("غير محدد");
      });

      it("should handle very large amounts", () => {
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ chequeAmount: "999999999.99" });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].amount).toBe(999999999.99);
      });

      it("should include category and subCategory in payment", () => {
        const formData = createBaseFormData({
          category: "مصاريف تشغيلية",
          subCategory: "رواتب",
        });
        const checkData = createOutgoingCheckFormData();
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        const paymentCall = (ctx.batch.set as jest.Mock).mock.calls[1];
        expect(paymentCall[1].category).toBe("مصاريف تشغيلية");
        expect(paymentCall[1].subCategory).toBe("رواتب");
      });

      it("should include description in notes", () => {
        const formData = createBaseFormData({ description: "دفعة للمورد" });
        const checkData = createOutgoingCheckFormData();
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].notes).toContain("دفعة للمورد");
      });

      it("should default accountingType to cashed if not specified", () => {
        const formData = createBaseFormData();
        const checkData = createOutgoingCheckFormData({ accountingType: undefined as any });
        const ctx = createMockContext(formData, "مصروف");

        handleOutgoingCheckBatch(ctx, checkData);

        const chequeCall = (ctx.batch.set as jest.Mock).mock.calls[0];
        expect(chequeCall[1].status).toBe(CHEQUE_STATUS_AR.CASHED);
      });
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete income transaction with cashed incoming cheque", () => {
      const formData = createBaseFormData({
        category: "مبيعات",
        description: "بيع بضاعة نقداً",
        associatedParty: "شركة النور",
      });
      const checkData = createCheckFormData({
        chequeNumber: "CHQ-SALE-001",
        chequeAmount: "15000",
        bankName: "البنك السعودي",
        accountingType: "cashed",
      });
      const ctx = createMockContext(formData, "دخل");

      handleIncomingCheckBatch(ctx, checkData);

      // Verify complete transaction
      expect(ctx.batch.set).toHaveBeenCalledTimes(2);

      const cheque = (ctx.batch.set as jest.Mock).mock.calls[0][1];
      const payment = (ctx.batch.set as jest.Mock).mock.calls[1][1];

      expect(cheque.amount).toBe(15000);
      expect(cheque.type).toBe(CHEQUE_TYPES.INCOMING);
      expect(payment.amount).toBe(15000);
      expect(payment.type).toBe(PAYMENT_TYPES.RECEIPT);
    });

    it("should handle complete expense transaction with outgoing cheque", () => {
      const formData = createBaseFormData({
        category: "مشتريات",
        description: "شراء مواد خام",
        associatedParty: "مورد المواد",
      });
      const checkData = createOutgoingCheckFormData({
        chequeNumber: "CHQ-PUR-001",
        chequeAmount: "25000",
        accountingType: "cashed",
      });
      const ctx = createMockContext(formData, "مصروف");

      handleOutgoingCheckBatch(ctx, checkData);

      const cheque = (ctx.batch.set as jest.Mock).mock.calls[0][1];
      const payment = (ctx.batch.set as jest.Mock).mock.calls[1][1];

      expect(cheque.amount).toBe(25000);
      expect(cheque.type).toBe(CHEQUE_TYPES.OUTGOING);
      expect(payment.type).toBe(PAYMENT_TYPES.DISBURSEMENT);
    });

    it("should handle post-dated incoming cheque (no immediate cash impact)", () => {
      const formData = createBaseFormData({
        trackARAP: true,
      });
      const checkData = createCheckFormData({
        chequeNumber: "CHQ-PDC-001",
        chequeAmount: "10000",
        dueDate: "2024-06-15", // Future date
        accountingType: "postponed",
      });
      const ctx = createMockContext(formData, "دخل");

      handleIncomingCheckBatch(ctx, checkData);

      // Only cheque created, no payment
      expect(ctx.batch.set).toHaveBeenCalledTimes(1);

      const cheque = (ctx.batch.set as jest.Mock).mock.calls[0][1];
      expect(cheque.status).toBe(CHEQUE_STATUS_AR.PENDING);
    });

    it("should handle cheque endorsement flow", () => {
      const formData = createBaseFormData({
        associatedParty: "العميل الأصلي",
      });
      const checkData = createCheckFormData({
        chequeNumber: "CHQ-END-001",
        chequeAmount: "5000",
        accountingType: "endorsed",
        endorsedToName: "المستفيد الثالث",
      });
      const ctx = createMockContext(formData, "دخل");

      handleIncomingCheckBatch(ctx, checkData);

      // Cheque + 2 payments (receipt from original, disbursement to endorsed party)
      expect(ctx.batch.set).toHaveBeenCalledTimes(3);

      const receipt = (ctx.batch.set as jest.Mock).mock.calls[1][1];
      const disbursement = (ctx.batch.set as jest.Mock).mock.calls[2][1];

      expect(receipt.clientName).toBe("العميل الأصلي");
      expect(receipt.noCashMovement).toBe(true);
      expect(disbursement.clientName).toBe("المستفيد الثالث");
      expect(disbursement.noCashMovement).toBe(true);
    });
  });
});
