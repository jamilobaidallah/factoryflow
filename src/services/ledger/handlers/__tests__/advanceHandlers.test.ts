/**
 * Advance Handlers Tests
 *
 * Tests for advance allocation batch operations - allocating customer/supplier
 * advances to invoices.
 */

import { handleAdvanceAllocationBatch } from "../advanceHandlers";
import type { HandlerContext } from "../../types";
import type { LedgerFormData } from "@/components/ledger/types/ledger";
import type { AdvanceAllocationResult } from "@/components/ledger/components/AdvanceAllocationDialog";

// Track calls to Firestore atomic operations
const mockArrayUnion = jest.fn((value) => ({ _arrayUnion: true, value }));
const mockIncrement = jest.fn((value) => ({ _increment: true, value }));

// Mock firebase/firestore
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, path, id) => ({ _path: `${path}/${id}`, id })),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  increment: (value: number) => mockIncrement(value),
}));

// Mock firebase config
jest.mock("@/firebase/config", () => ({
  firestore: { _mock: "firestore" },
}));

describe("Advance Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create base form data
  const createBaseFormData = (overrides: Partial<LedgerFormData> = {}): LedgerFormData => ({
    date: "2024-01-15",
    type: "دخل",
    category: "مبيعات",
    subCategory: "",
    amount: "5000",
    associatedParty: "عميل اختبار",
    description: "فاتورة مبيعات",
    includeInARAPTracking: true,
    immediateSettlement: false,
    ...overrides,
  });

  // Helper to create advance allocation
  const createAllocation = (overrides: Partial<AdvanceAllocationResult> = {}): AdvanceAllocationResult => ({
    advanceId: "advance-123",
    advanceTransactionId: "TXN-ADV-001",
    amount: 1000,
    originalAdvanceAmount: 3000,
    remainingAfterAllocation: 2000,
    ...overrides,
  });

  // Helper to create mock handler context
  const createMockContext = (formData: LedgerFormData): HandlerContext => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(),
    };

    return {
      batch: mockBatch as any,
      transactionId: "TXN-INVOICE-001",
      formData,
      entryType: "دخل",
      userId: "test-user-123",
      refs: {
        ledger: { id: "ledger" } as any,
        cheques: { id: "cheques" } as any,
        payments: { id: "payments" } as any,
        inventory: { id: "inventory" } as any,
        inventoryHistory: { id: "inventoryHistory" } as any,
        journalEntries: { id: "journalEntries" } as any,
        activityLogs: { id: "activityLogs" } as any,
      },
    };
  };

  describe("handleAdvanceAllocationBatch", () => {
    describe("Single Allocation", () => {
      it("should process a single valid allocation", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [createAllocation()];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        // Verify return values
        expect(result.totalPaidFromAdvances).toBe(1000);
        expect(result.paidFromAdvances).toHaveLength(1);
        expect(result.paidFromAdvances[0]).toMatchObject({
          advanceId: "advance-123",
          advanceTransactionId: "TXN-ADV-001",
          amount: 1000,
        });
        expect(result.paidFromAdvances[0].date).toBeInstanceOf(Date);
      });

      it("should update the advance entry with atomic operations", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [createAllocation()];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        // Should call batch.update once for the advance
        expect(ctx.batch.update).toHaveBeenCalledTimes(1);

        // Verify the update call
        const updateCall = (ctx.batch.update as jest.Mock).mock.calls[0];
        const updateData = updateCall[1];

        // Should use arrayUnion for advanceAllocations
        expect(mockArrayUnion).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceId: "invoice-doc-123",
            invoiceTransactionId: "TXN-INVOICE-001",
            amount: 1000,
          })
        );

        // Should use increment for totalPaid
        expect(mockIncrement).toHaveBeenCalledWith(1000);

        // Should use negative increment for remainingBalance
        expect(mockIncrement).toHaveBeenCalledWith(-1000);
      });

      it("should set paymentStatus to partial when remainingAfterAllocation > 0", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ remainingAfterAllocation: 500 }),
        ];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        const updateCall = (ctx.batch.update as jest.Mock).mock.calls[0];
        expect(updateCall[1].paymentStatus).toBe("partial");
      });

      it("should set paymentStatus to paid when remainingAfterAllocation = 0", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ remainingAfterAllocation: 0 }),
        ];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        const updateCall = (ctx.batch.update as jest.Mock).mock.calls[0];
        expect(updateCall[1].paymentStatus).toBe("paid");
      });

      it("should set paymentStatus to paid when remainingAfterAllocation < 0", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ remainingAfterAllocation: -100 }), // Edge case
        ];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        const updateCall = (ctx.batch.update as jest.Mock).mock.calls[0];
        expect(updateCall[1].paymentStatus).toBe("paid");
      });
    });

    describe("Multiple Allocations", () => {
      it("should process multiple allocations and sum totals", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({
            advanceId: "adv-1",
            amount: 1000,
            remainingAfterAllocation: 500,
          }),
          createAllocation({
            advanceId: "adv-2",
            amount: 2000,
            remainingAfterAllocation: 0,
          }),
          createAllocation({
            advanceId: "adv-3",
            amount: 500,
            remainingAfterAllocation: 1500,
          }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        // Total should be sum of all allocations
        expect(result.totalPaidFromAdvances).toBe(3500);
        expect(result.paidFromAdvances).toHaveLength(3);

        // Should update each advance
        expect(ctx.batch.update).toHaveBeenCalledTimes(3);
      });

      it("should use safeAdd for precise decimal arithmetic", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        // These values can cause floating point errors without safeAdd
        const allocations = [
          createAllocation({ amount: 0.1 }),
          createAllocation({ amount: 0.2 }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        // Should be exactly 0.3, not 0.30000000000000004
        expect(result.totalPaidFromAdvances).toBe(0.3);
      });

      it("should set different paymentStatus for each allocation", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({
            advanceId: "adv-1",
            amount: 1000,
            remainingAfterAllocation: 500, // partial
          }),
          createAllocation({
            advanceId: "adv-2",
            amount: 2000,
            remainingAfterAllocation: 0, // paid
          }),
        ];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        const updateCalls = (ctx.batch.update as jest.Mock).mock.calls;
        expect(updateCalls[0][1].paymentStatus).toBe("partial");
        expect(updateCalls[1][1].paymentStatus).toBe("paid");
      });
    });

    describe("Skipping Invalid Allocations", () => {
      it("should skip allocations with zero amount", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ amount: 0 }),
          createAllocation({ advanceId: "adv-valid", amount: 500 }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        // Only the valid allocation should be processed
        expect(result.totalPaidFromAdvances).toBe(500);
        expect(result.paidFromAdvances).toHaveLength(1);
        expect(ctx.batch.update).toHaveBeenCalledTimes(1);
      });

      it("should skip allocations with negative amount", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ amount: -100 }),
          createAllocation({ advanceId: "adv-valid", amount: 1000 }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        expect(result.totalPaidFromAdvances).toBe(1000);
        expect(result.paidFromAdvances).toHaveLength(1);
        expect(ctx.batch.update).toHaveBeenCalledTimes(1);
      });

      it("should return empty results when all allocations are invalid", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ amount: 0 }),
          createAllocation({ amount: -50 }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        expect(result.totalPaidFromAdvances).toBe(0);
        expect(result.paidFromAdvances).toHaveLength(0);
        expect(ctx.batch.update).not.toHaveBeenCalled();
      });

      it("should return empty results when allocations array is empty", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);

        const result = await handleAdvanceAllocationBatch(
          ctx,
          [],
          "invoice-doc-123"
        );

        expect(result.totalPaidFromAdvances).toBe(0);
        expect(result.paidFromAdvances).toHaveLength(0);
        expect(ctx.batch.update).not.toHaveBeenCalled();
      });
    });

    describe("Allocation Record Details", () => {
      it("should include invoice description in allocation record", async () => {
        const formData = createBaseFormData({
          description: "فاتورة رقم 12345",
        });
        const ctx = createMockContext(formData);
        const allocations = [createAllocation()];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        expect(mockArrayUnion).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "فاتورة رقم 12345",
          })
        );
      });

      it("should include correct invoice IDs in allocation record", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        ctx.transactionId = "TXN-CUSTOM-999";
        const allocations = [createAllocation()];

        await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "custom-invoice-id"
        );

        expect(mockArrayUnion).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceId: "custom-invoice-id",
            invoiceTransactionId: "TXN-CUSTOM-999",
          })
        );
      });

      it("should create payment record with correct details", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({
            advanceId: "adv-special",
            advanceTransactionId: "TXN-ADV-SPECIAL",
            amount: 2500,
          }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "invoice-doc-123"
        );

        expect(result.paidFromAdvances[0]).toMatchObject({
          advanceId: "adv-special",
          advanceTransactionId: "TXN-ADV-SPECIAL",
          amount: 2500,
        });
      });
    });

    describe("Document Reference", () => {
      it("should reference correct advance document path", async () => {
        const { doc } = require("firebase/firestore");
        const formData = createBaseFormData();
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({ advanceId: "adv-doc-id-123" }),
        ];

        await handleAdvanceAllocationBatch(ctx, allocations, "invoice-doc-123");

        // Verify doc was called with correct path
        expect(doc).toHaveBeenCalledWith(
          expect.anything(), // firestore
          "users/test-user-123/ledger",
          "adv-doc-id-123"
        );
      });
    });

    describe("Integration Scenarios", () => {
      it("should handle customer advance allocation to sales invoice", async () => {
        const formData = createBaseFormData({
          type: "دخل",
          category: "مبيعات",
          description: "فاتورة مبيعات للعميل",
          associatedParty: "شركة الأمل",
        });
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({
            advanceId: "customer-advance-001",
            advanceTransactionId: "TXN-CUST-ADV-001",
            amount: 3000,
            originalAdvanceAmount: 5000,
            remainingAfterAllocation: 2000,
          }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "sales-invoice-001"
        );

        expect(result.totalPaidFromAdvances).toBe(3000);
        expect(result.paidFromAdvances[0].advanceId).toBe("customer-advance-001");

        // Verify status is partial since remaining > 0
        const updateCall = (ctx.batch.update as jest.Mock).mock.calls[0];
        expect(updateCall[1].paymentStatus).toBe("partial");
      });

      it("should handle supplier advance allocation to purchase invoice", async () => {
        const formData = createBaseFormData({
          type: "مصروف",
          category: "مشتريات",
          description: "فاتورة شراء من المورد",
          associatedParty: "مورد الخامات",
        });
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({
            advanceId: "supplier-advance-001",
            advanceTransactionId: "TXN-SUPP-ADV-001",
            amount: 10000,
            originalAdvanceAmount: 10000,
            remainingAfterAllocation: 0, // Fully consumed
          }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "purchase-invoice-001"
        );

        expect(result.totalPaidFromAdvances).toBe(10000);

        // Verify status is paid since remaining = 0
        const updateCall = (ctx.batch.update as jest.Mock).mock.calls[0];
        expect(updateCall[1].paymentStatus).toBe("paid");
      });

      it("should handle multiple advances paying single invoice", async () => {
        const formData = createBaseFormData({
          amount: "15000",
          description: "فاتورة كبيرة مدفوعة من سلف متعددة",
        });
        const ctx = createMockContext(formData);
        const allocations = [
          createAllocation({
            advanceId: "adv-1",
            amount: 5000,
            remainingAfterAllocation: 0, // Fully used
          }),
          createAllocation({
            advanceId: "adv-2",
            amount: 5000,
            remainingAfterAllocation: 3000, // Partially used
          }),
          createAllocation({
            advanceId: "adv-3",
            amount: 5000,
            remainingAfterAllocation: 0, // Fully used
          }),
        ];

        const result = await handleAdvanceAllocationBatch(
          ctx,
          allocations,
          "large-invoice-001"
        );

        expect(result.totalPaidFromAdvances).toBe(15000);
        expect(result.paidFromAdvances).toHaveLength(3);

        // Verify each advance got updated with correct status
        const updateCalls = (ctx.batch.update as jest.Mock).mock.calls;
        expect(updateCalls[0][1].paymentStatus).toBe("paid"); // adv-1
        expect(updateCalls[1][1].paymentStatus).toBe("partial"); // adv-2
        expect(updateCalls[2][1].paymentStatus).toBe("paid"); // adv-3
      });
    });
  });
});
