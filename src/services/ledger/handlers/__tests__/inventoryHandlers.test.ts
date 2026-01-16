/**
 * Inventory Handlers Tests
 *
 * Tests for inventory batch operations including COGS calculation,
 * movement records, and inventory item creation.
 */

import {
  addCOGSRecord,
  createNewInventoryItemInBatch,
  addMovementRecordToBatch,
  rollbackInventoryChanges,
  handleInventoryUpdate,
} from "../inventoryHandlers";
import type { HandlerContext } from "../../types";
import type { InventoryFormData, LedgerFormData, InventoryItemData } from "@/components/ledger/types/ledger";
import { WriteBatch, CollectionReference } from "firebase/firestore";

// Track mock state
let mockTransactionData: Record<string, any> = {};
let mockItemExists = true;
let mockCurrentQuantity = 100;
let mockCurrentUnitPrice = 10;

// Mock firebase/firestore
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((ref, ...args) => {
    // Generate a mock ID
    const id = args.length > 0 ? args[args.length - 1] : `mock-doc-${Math.random().toString(36).substr(2, 9)}`;
    return { id, _path: args.join("/") };
  }),
  getDocs: jest.fn(() =>
    Promise.resolve({
      empty: !mockItemExists,
      docs: mockItemExists
        ? [
            {
              id: "existing-item-id",
              data: () => ({
                quantity: mockCurrentQuantity,
                unitPrice: mockCurrentUnitPrice,
              }),
            },
          ]
        : [],
    })
  ),
  query: jest.fn((ref, ...conditions) => ({ _query: true, ref, conditions })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  runTransaction: jest.fn(async (db, callback) => {
    const mockTransaction = {
      get: jest.fn((docRef) =>
        Promise.resolve({
          exists: () => mockItemExists,
          data: () => ({
            quantity: mockCurrentQuantity,
            unitPrice: mockCurrentUnitPrice,
          }),
        })
      ),
      update: jest.fn((docRef, data) => {
        mockTransactionData = { ...mockTransactionData, ...data };
      }),
    };
    return callback(mockTransaction);
  }),
}));

// Mock firebase config
jest.mock("@/firebase/config", () => ({
  firestore: { _mock: "firestore" },
}));

describe("Inventory Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionData = {};
    mockItemExists = true;
    mockCurrentQuantity = 100;
    mockCurrentUnitPrice = 10;
  });

  // Helper to create base form data
  const createBaseFormData = (overrides: Partial<LedgerFormData> = {}): LedgerFormData => ({
    date: "2024-01-15",
    category: "مشتريات",
    subCategory: "",
    amount: "5000",
    associatedParty: "مورد المواد",
    description: "شراء مواد خام",
    ownerName: "",
    trackARAP: false,
    immediateSettlement: false,
    ...overrides,
  });

  // Helper to create inventory form data
  const createInventoryFormData = (overrides: Partial<InventoryFormData> = {}): InventoryFormData => ({
    itemId: "",
    itemName: "حديد مجلفن",
    quantity: "50",
    unit: "كيلو",
    thickness: "0.5",
    width: "100",
    length: "200",
    shippingCost: "200",
    otherCosts: "100",
    ...overrides,
  });

  // Helper to create mock batch
  const createMockBatch = () =>
    ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(),
    }) as unknown as WriteBatch;

  // Helper to create mock collection reference
  const createMockCollectionRef = () =>
    ({
      id: "mock-collection",
      _collection: true,
    }) as unknown as CollectionReference;

  // Helper to create mock handler context
  const createMockContext = (
    formData: LedgerFormData,
    entryType: string = "مصروف"
  ): HandlerContext => {
    const mockBatch = createMockBatch();

    return {
      batch: mockBatch,
      transactionId: "TXN-INV-001",
      formData,
      entryType,
      userId: "test-user-123",
      refs: {
        ledger: createMockCollectionRef(),
        cheques: createMockCollectionRef(),
        payments: createMockCollectionRef(),
        inventory: createMockCollectionRef(),
        inventoryMovements: createMockCollectionRef(),
        fixedAssets: createMockCollectionRef(),
      },
    };
  };

  describe("addCOGSRecord", () => {
    it("should create a COGS ledger entry", () => {
      const batch = createMockBatch();
      const ledgerRef = createMockCollectionRef();
      const date = new Date("2024-01-15");

      const result = addCOGSRecord(
        batch,
        ledgerRef,
        "TXN-123",
        "حديد مجلفن",
        10, // quantity
        50, // unit cost
        date
      );

      // Verify COGS amount calculation
      expect(result.amount).toBe(500); // 10 * 50
      expect(result.description).toBe("تكلفة البضاعة المباعة - حديد مجلفن");

      // Verify batch.set was called
      expect(batch.set).toHaveBeenCalledTimes(1);
      const setCall = (batch.set as jest.Mock).mock.calls[0];

      expect(setCall[1]).toMatchObject({
        transactionId: "COGS-TXN-123",
        description: "تكلفة البضاعة المباعة - حديد مجلفن",
        type: "مصروف",
        amount: 500,
        category: "تكلفة البضاعة المباعة (COGS)",
        subCategory: "مبيعات",
        linkedTransactionId: "TXN-123",
        autoGenerated: true,
      });
    });

    it("should handle decimal quantities and prices", () => {
      const batch = createMockBatch();
      const ledgerRef = createMockCollectionRef();

      const result = addCOGSRecord(
        batch,
        ledgerRef,
        "TXN-DEC",
        "زجاج",
        2.5, // quantity
        12.5, // unit cost
        new Date()
      );

      // 2.5 * 12.5 = 31.25
      expect(result.amount).toBe(31.25);
    });

    it("should include calculation notes", () => {
      const batch = createMockBatch();
      const ledgerRef = createMockCollectionRef();

      addCOGSRecord(batch, ledgerRef, "TXN-NOTE", "ألمنيوم", 5, 20, new Date());

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1].notes).toContain("5 × 20");
    });

    it("should handle zero quantity", () => {
      const batch = createMockBatch();
      const ledgerRef = createMockCollectionRef();

      const result = addCOGSRecord(batch, ledgerRef, "TXN-ZERO", "صنف", 0, 100, new Date());

      expect(result.amount).toBe(0);
    });
  });

  describe("createNewInventoryItemInBatch", () => {
    it("should create a new inventory item with all fields", () => {
      const batch = createMockBatch();
      const inventoryRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData();
      const formData = createBaseFormData({ amount: "5000" });

      const itemId = createNewInventoryItemInBatch(
        batch,
        inventoryRef,
        inventoryFormData,
        formData,
        50 // quantity
      );

      expect(itemId).toBeDefined();
      expect(batch.set).toHaveBeenCalledTimes(1);

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1]).toMatchObject({
        itemName: "حديد مجلفن",
        quantity: 50,
        unit: "كيلو",
        thickness: 0.5,
        width: 100,
        length: 200,
      });
    });

    it("should calculate landed cost unit price correctly", () => {
      const batch = createMockBatch();
      const inventoryRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData({
        quantity: "100",
        shippingCost: "500",
        otherCosts: "200",
      });
      const formData = createBaseFormData({ amount: "10000" }); // 10000 + 500 + 200 = 10700

      createNewInventoryItemInBatch(batch, inventoryRef, inventoryFormData, formData, 100);

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      // Unit price = (10000 + 500 + 200) / 100 = 107
      expect(setCall[1].unitPrice).toBe(107);
      expect(setCall[1].lastPurchasePrice).toBe(107);
      expect(setCall[1].lastPurchaseAmount).toBe(10700);
    });

    it("should handle missing optional fields", () => {
      const batch = createMockBatch();
      const inventoryRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData({
        thickness: "",
        width: "",
        length: "",
        shippingCost: "",
        otherCosts: "",
      });
      const formData = createBaseFormData({ amount: "1000" });

      createNewInventoryItemInBatch(batch, inventoryRef, inventoryFormData, formData, 10);

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1].thickness).toBeNull();
      expect(setCall[1].width).toBeNull();
      expect(setCall[1].length).toBeNull();
    });

    it("should use default category when not provided", () => {
      const batch = createMockBatch();
      const inventoryRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData();
      const formData = createBaseFormData({ category: "" });

      createNewInventoryItemInBatch(batch, inventoryRef, inventoryFormData, formData, 10);

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1].category).toBe("غير مصنف");
    });

    it("should include creation notes with description", () => {
      const batch = createMockBatch();
      const inventoryRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData();
      const formData = createBaseFormData({ description: "شراء من المورد أحمد" });

      createNewInventoryItemInBatch(batch, inventoryRef, inventoryFormData, formData, 10);

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1].notes).toContain("شراء من المورد أحمد");
    });
  });

  describe("addMovementRecordToBatch", () => {
    it("should create a movement record for inventory entry", () => {
      const batch = createMockBatch();
      const movementsRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData();

      addMovementRecordToBatch(
        batch,
        movementsRef,
        "item-123",
        inventoryFormData,
        "دخول", // Entry
        50,
        "TXN-MOV-001",
        "شراء مواد خام"
      );

      expect(batch.set).toHaveBeenCalledTimes(1);

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1]).toMatchObject({
        itemId: "item-123",
        itemName: "حديد مجلفن",
        type: "دخول",
        quantity: 50,
        unit: "كيلو",
        thickness: 0.5,
        width: 100,
        length: 200,
        linkedTransactionId: "TXN-MOV-001",
      });
      expect(setCall[1].notes).toContain("شراء مواد خام");
    });

    it("should create a movement record for inventory exit", () => {
      const batch = createMockBatch();
      const movementsRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData();

      addMovementRecordToBatch(
        batch,
        movementsRef,
        "item-456",
        inventoryFormData,
        "خروج", // Exit
        20,
        "TXN-SALE-001",
        "بيع للعميل"
      );

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1].type).toBe("خروج");
      expect(setCall[1].quantity).toBe(20);
    });

    it("should handle null dimensions", () => {
      const batch = createMockBatch();
      const movementsRef = createMockCollectionRef();
      const inventoryFormData = createInventoryFormData({
        thickness: "",
        width: "",
        length: "",
      });

      addMovementRecordToBatch(
        batch,
        movementsRef,
        "item-789",
        inventoryFormData,
        "دخول",
        10,
        "TXN-001",
        "Test"
      );

      const setCall = (batch.set as jest.Mock).mock.calls[0];
      expect(setCall[1].thickness).toBeNull();
      expect(setCall[1].width).toBeNull();
      expect(setCall[1].length).toBeNull();
    });
  });

  describe("rollbackInventoryChanges", () => {
    it("should rollback positive quantity changes", async () => {
      const { runTransaction, doc } = require("firebase/firestore");
      mockCurrentQuantity = 150; // After addition of 50

      await rollbackInventoryChanges("test-user", [
        { itemId: "item-123", quantityDelta: 50 }, // Added 50
      ]);

      // Should call runTransaction
      expect(runTransaction).toHaveBeenCalled();
    });

    it("should rollback negative quantity changes", async () => {
      const { runTransaction } = require("firebase/firestore");
      mockCurrentQuantity = 80; // After subtraction of 20

      await rollbackInventoryChanges("test-user", [
        { itemId: "item-456", quantityDelta: -20 }, // Removed 20
      ]);

      expect(runTransaction).toHaveBeenCalled();
    });

    it("should handle multiple items", async () => {
      const { runTransaction } = require("firebase/firestore");

      await rollbackInventoryChanges("test-user", [
        { itemId: "item-1", quantityDelta: 50 },
        { itemId: "item-2", quantityDelta: -30 },
        { itemId: "item-3", quantityDelta: 100 },
      ]);

      // Should call runTransaction for each item
      expect(runTransaction).toHaveBeenCalledTimes(3);
    });

    it("should not throw on rollback failure", async () => {
      const { runTransaction } = require("firebase/firestore");
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Make runTransaction fail
      runTransaction.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      await expect(
        rollbackInventoryChanges("test-user", [{ itemId: "item-fail", quantityDelta: 50 }])
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to rollback"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle empty changes array", async () => {
      const { runTransaction } = require("firebase/firestore");

      await rollbackInventoryChanges("test-user", []);

      expect(runTransaction).not.toHaveBeenCalled();
    });
  });

  describe("handleInventoryUpdate", () => {
    describe("Movement Direction Logic", () => {
      it("should set movement type to 'دخول' for expense (purchase)", async () => {
        const formData = createBaseFormData({ subCategory: "" });
        const ctx = createMockContext(formData, "مصروف");
        const inventoryFormData = createInventoryFormData();

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
        // Movement record should be created with type 'دخول'
        const movementCall = (ctx.batch.set as jest.Mock).mock.calls.find(
          (call) => call[1]?.type === "دخول"
        );
        expect(movementCall).toBeDefined();
      });

      it("should set movement type to 'خروج' for income (sale)", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData, "دخل");
        const inventoryFormData = createInventoryFormData({ quantity: "10" });

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
      });

      it("should set movement type to 'خروج' for non-cash expense (wastage)", async () => {
        const formData = createBaseFormData({
          subCategory: "هدر وتالف",
        });
        const ctx = createMockContext(formData, "مصروف");
        const inventoryFormData = createInventoryFormData({ quantity: "5" });

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
      });

      it("should set movement type to 'خروج' for free samples", async () => {
        const formData = createBaseFormData({
          subCategory: "عينات مجانية",
        });
        const ctx = createMockContext(formData, "مصروف");
        const inventoryFormData = createInventoryFormData({ quantity: "2" });

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
      });
    });

    describe("Item Not Found Scenarios", () => {
      beforeEach(() => {
        mockItemExists = false;
      });

      it("should create new item when purchasing non-existent item", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData, "مصروف");
        const inventoryFormData = createInventoryFormData();

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
        // Should call batch.set to create new item
        expect(ctx.batch.set).toHaveBeenCalled();
      });

      it("should fail when trying to sell non-existent item", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData, "دخل"); // Sale
        const inventoryFormData = createInventoryFormData();

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(false);
        expect(result.error).toContain("غير موجود في المخزون");
        expect(result.error).toContain(inventoryFormData.itemName);
      });
    });

    describe("Insufficient Quantity", () => {
      beforeEach(() => {
        mockItemExists = true;
        mockCurrentQuantity = 10; // Only 10 in stock
      });

      it("should fail when selling more than available", async () => {
        const { runTransaction } = require("firebase/firestore");

        // Override runTransaction to throw InsufficientQuantityError
        runTransaction.mockImplementationOnce(async () => {
          const { InsufficientQuantityError } = require("@/lib/errors");
          throw new InsufficientQuantityError(10, 50, "حديد مجلفن");
        });

        const formData = createBaseFormData();
        const ctx = createMockContext(formData, "دخل");
        const inventoryFormData = createInventoryFormData({ quantity: "50" }); // Want 50, only 10 available

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(false);
        expect(result.error).toContain("غير كافية");
      });
    });

    describe("COGS Creation", () => {
      it("should not create COGS for purchase transactions", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData, "مصروف");
        const inventoryFormData = createInventoryFormData();

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
        expect(result.cogsCreated).toBeFalsy();
      });
    });

    describe("Result Values", () => {
      it("should return inventory change details", async () => {
        const formData = createBaseFormData();
        const ctx = createMockContext(formData, "مصروف");
        const inventoryFormData = createInventoryFormData({ quantity: "25" });

        const result = await handleInventoryUpdate(ctx, inventoryFormData);

        expect(result.success).toBe(true);
        expect(result.inventoryChange).toBeDefined();
        expect(result.inventoryChange?.quantityDelta).toBe(25); // Entry adds quantity
      });
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete purchase flow", async () => {
      mockItemExists = false; // New item
      const formData = createBaseFormData({
        amount: "10000",
        description: "شراء حديد من المورد",
      });
      const ctx = createMockContext(formData, "مصروف");
      const inventoryFormData = createInventoryFormData({
        itemName: "حديد صلب",
        quantity: "100",
        shippingCost: "500",
        otherCosts: "200",
      });

      const result = await handleInventoryUpdate(ctx, inventoryFormData);

      expect(result.success).toBe(true);
      expect(result.cogsCreated).toBeFalsy();

      // Should create inventory item + movement
      expect(ctx.batch.set).toHaveBeenCalledTimes(2);
    });

    it("should handle existing item purchase with weighted average", async () => {
      mockItemExists = true;
      mockCurrentQuantity = 100;
      mockCurrentUnitPrice = 90; // Current avg price

      const formData = createBaseFormData({
        amount: "5500", // New purchase at 110/unit
      });
      const ctx = createMockContext(formData, "مصروف");
      const inventoryFormData = createInventoryFormData({
        itemName: "حديد موجود",
        quantity: "50",
        shippingCost: "0",
        otherCosts: "0",
      });

      const result = await handleInventoryUpdate(ctx, inventoryFormData);

      expect(result.success).toBe(true);
      // Movement should be recorded
      expect(ctx.batch.set).toHaveBeenCalled();
    });
  });
});
