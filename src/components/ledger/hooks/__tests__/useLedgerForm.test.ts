/**
 * Unit Tests for useLedgerForm Hook
 */

import { renderHook, act } from '@testing-library/react';
import { useLedgerForm } from '../useLedgerForm';
import { LedgerEntry } from '../../utils/ledger-constants';

describe('useLedgerForm', () => {
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  describe('Initial State', () => {
    it('should initialize with default form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.formData).toEqual({
        description: "",
        amount: "",
        category: "",
        subCategory: "",
        date: getTodayDate(),
        associatedParty: "",
        ownerName: "",
        reference: "",
        notes: "",
        trackARAP: false,
        immediateSettlement: false,
      });
    });

    it('should initialize all boolean flags as false', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.hasIncomingCheck).toBe(false);
      expect(result.current.hasInventoryUpdate).toBe(false);
      expect(result.current.hasFixedAsset).toBe(false);
      expect(result.current.hasInitialPayment).toBe(false);
    });

    it('should initialize check form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.checkFormData).toEqual({
        chequeNumber: "",
        chequeAmount: "",
        bankName: "",
        dueDate: getTodayDate(),
      });
    });

    it('should initialize inventory form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.inventoryFormData).toEqual({
        itemName: "",
        quantity: "",
        unit: "",
        thickness: "",
        width: "",
        length: "",
        shippingCost: "",
        otherCosts: "",
      });
    });

    it('should initialize fixed asset form data with default depreciation method', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.fixedAssetFormData).toEqual({
        assetName: "",
        usefulLifeYears: "",
        salvageValue: "",
        depreciationMethod: "straight-line",
      });
    });

    it('should initialize payment form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.paymentFormData).toEqual({
        amount: "",
        notes: "",
      });
    });

    it('should initialize cheque related form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.chequeRelatedFormData).toEqual({
        chequeNumber: "",
        amount: "",
        bankName: "",
        dueDate: getTodayDate(),
        status: "قيد الانتظار",
        chequeType: "عادي",
        chequeImage: null,
      });
    });

    it('should initialize inventory related form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      expect(result.current.inventoryRelatedFormData).toEqual({
        itemName: "",
        quantity: "",
        unit: "",
        thickness: "",
        width: "",
        length: "",
        notes: "",
      });
    });
  });

  describe('Form Data Updates', () => {
    it('should update form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setFormData({
          ...result.current.formData,
          description: "Test Description",
          amount: "1000",
        });
      });

      expect(result.current.formData.description).toBe("Test Description");
      expect(result.current.formData.amount).toBe("1000");
    });

    it('should update boolean flags', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setHasIncomingCheck(true);
        result.current.setHasInventoryUpdate(true);
        result.current.setHasFixedAsset(true);
        result.current.setHasInitialPayment(true);
      });

      expect(result.current.hasIncomingCheck).toBe(true);
      expect(result.current.hasInventoryUpdate).toBe(true);
      expect(result.current.hasFixedAsset).toBe(true);
      expect(result.current.hasInitialPayment).toBe(true);
    });

    it('should update check form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setCheckFormData({
          chequeNumber: "CHQ-001",
          chequeAmount: "500",
          bankName: "بنك الأردن",
          dueDate: "2025-02-01",
          accountingType: "cashed",
          endorsedToName: "",
        });
      });

      expect(result.current.checkFormData.chequeNumber).toBe("CHQ-001");
      expect(result.current.checkFormData.chequeAmount).toBe("500");
    });

    it('should update inventory form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setInventoryFormData({
          ...result.current.inventoryFormData,
          itemName: "حديد",
          quantity: "100",
          unit: "كجم",
        });
      });

      expect(result.current.inventoryFormData.itemName).toBe("حديد");
      expect(result.current.inventoryFormData.quantity).toBe("100");
      expect(result.current.inventoryFormData.unit).toBe("كجم");
    });

    it('should update fixed asset form data', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setFixedAssetFormData({
          assetName: "آلة تصنيع",
          usefulLifeYears: "5",
          salvageValue: "1000",
          depreciationMethod: "declining",
        });
      });

      expect(result.current.fixedAssetFormData.assetName).toBe("آلة تصنيع");
      expect(result.current.fixedAssetFormData.usefulLifeYears).toBe("5");
      expect(result.current.fixedAssetFormData.salvageValue).toBe("1000");
      expect(result.current.fixedAssetFormData.depreciationMethod).toBe("declining");
    });

    it('should update initial payment amount', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setInitialPaymentAmount("250");
      });

      expect(result.current.initialPaymentAmount).toBe("250");
    });
  });

  describe('resetAllForms', () => {
    it('should reset all form data to initial state', () => {
      const { result } = renderHook(() => useLedgerForm());

      // Set some data
      act(() => {
        result.current.setFormData({
          ...result.current.formData,
          description: "Test",
          amount: "1000",
        });
        result.current.setHasIncomingCheck(true);
        result.current.setInitialPaymentAmount("500");
      });

      // Reset
      act(() => {
        result.current.resetAllForms();
      });

      expect(result.current.formData.description).toBe("");
      expect(result.current.formData.amount).toBe("");
      expect(result.current.hasIncomingCheck).toBe(false);
      expect(result.current.initialPaymentAmount).toBe("");
    });

    it('should reset all boolean flags', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setHasIncomingCheck(true);
        result.current.setHasInventoryUpdate(true);
        result.current.setHasFixedAsset(true);
        result.current.setHasInitialPayment(true);
      });

      act(() => {
        result.current.resetAllForms();
      });

      expect(result.current.hasIncomingCheck).toBe(false);
      expect(result.current.hasInventoryUpdate).toBe(false);
      expect(result.current.hasFixedAsset).toBe(false);
      expect(result.current.hasInitialPayment).toBe(false);
    });

    it('should reset all related forms', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setCheckFormData({
          chequeNumber: "CHQ-001",
          chequeAmount: "500",
          bankName: "بنك الأردن",
          dueDate: "2025-02-01",
          accountingType: "cashed",
          endorsedToName: "",
        });
        result.current.setInventoryFormData({
          ...result.current.inventoryFormData,
          itemName: "حديد",
          quantity: "100",
        });
        result.current.setPaymentFormData({
          amount: "300",
          notes: "دفعة أولى",
        });
      });

      act(() => {
        result.current.resetAllForms();
      });

      expect(result.current.checkFormData.chequeNumber).toBe("");
      expect(result.current.inventoryFormData.itemName).toBe("");
      expect(result.current.paymentFormData.amount).toBe("");
    });
  });

  describe('loadEntryForEdit', () => {
    const mockEntry: LedgerEntry = {
      id: "entry-1",
      transactionId: "TXN-001",
      description: "مبيعات منتجات",
      type: "دخل",
      amount: 1000,
      category: "مبيعات",
      subCategory: "منتجات",
      date: new Date("2025-01-15"),
      createdAt: new Date("2025-01-15"),
      associatedParty: "عميل أ",
      reference: "REF-001",
      notes: "ملاحظات اختبار",
      isARAPEntry: true,
    };

    it('should load entry data into form', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.loadEntryForEdit(mockEntry);
      });

      expect(result.current.formData.description).toBe("مبيعات منتجات");
      expect(result.current.formData.amount).toBe("1000");
      expect(result.current.formData.category).toBe("مبيعات");
      expect(result.current.formData.subCategory).toBe("منتجات");
      expect(result.current.formData.associatedParty).toBe("عميل أ");
      expect(result.current.formData.reference).toBe("REF-001");
      expect(result.current.formData.notes).toBe("ملاحظات اختبار");
    });

    it('should set trackARAP based on isARAPEntry', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.loadEntryForEdit(mockEntry);
      });

      expect(result.current.formData.trackARAP).toBe(true);
    });

    it('should format date correctly', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.loadEntryForEdit(mockEntry);
      });

      expect(result.current.formData.date).toBe("2025-01-15");
    });

    it('should handle missing optional fields', () => {
      const entryWithoutOptionals: LedgerEntry = {
        id: "entry-2",
        transactionId: "TXN-002",
        description: "Test",
        type: "دخل",
        amount: 500,
        category: "مبيعات",
        subCategory: "خدمات",
        associatedParty: "",
        reference: "",
        notes: "",
        date: new Date("2025-01-16"),
        createdAt: new Date("2025-01-16"),
      };

      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.loadEntryForEdit(entryWithoutOptionals);
      });

      expect(result.current.formData.associatedParty).toBe("");
      expect(result.current.formData.reference).toBe("");
      expect(result.current.formData.notes).toBe("");
      expect(result.current.formData.trackARAP).toBe(false);
    });

    it('should set immediateSettlement to false when loading for edit', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.loadEntryForEdit(mockEntry);
      });

      expect(result.current.formData.immediateSettlement).toBe(false);
    });

    it('should handle date as Date object', () => {
      const { result } = renderHook(() => useLedgerForm());

      const entryWithDateObject = {
        ...mockEntry,
        date: new Date("2025-03-01"),
      };

      act(() => {
        result.current.loadEntryForEdit(entryWithDateObject);
      });

      expect(result.current.formData.date).toBe("2025-03-01");
    });

    it('should handle date as string', () => {
      const { result } = renderHook(() => useLedgerForm());

      const entryWithStringDate = {
        ...mockEntry,
        date: "2025-03-01" as any,
      };

      act(() => {
        result.current.loadEntryForEdit(entryWithStringDate);
      });

      // Should handle string dates
      expect(result.current.formData.date).toBe("2025-03-01");
    });
  });

  describe('Individual Form Resets', () => {
    it('should reset payment form', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setPaymentFormData({
          amount: "300",
          notes: "دفعة أولى",
        });
      });

      expect(result.current.paymentFormData.amount).toBe("300");

      act(() => {
        result.current.resetPaymentForm();
      });

      expect(result.current.paymentFormData.amount).toBe("");
      expect(result.current.paymentFormData.notes).toBe("");
    });

    it('should reset cheque form', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setChequeRelatedFormData({
          chequeNumber: "CHQ-001",
          amount: "500",
          bankName: "بنك الأردن",
          dueDate: "2025-02-01",
          status: "تم الصرف",
          chequeType: "مجير",
          accountingType: "cashed",
          endorsedToId: "",
          endorsedToName: "",
          chequeImage: null,
        });
      });

      expect(result.current.chequeRelatedFormData.chequeNumber).toBe("CHQ-001");
      expect(result.current.chequeRelatedFormData.status).toBe("تم الصرف");

      act(() => {
        result.current.resetChequeForm();
      });

      expect(result.current.chequeRelatedFormData.chequeNumber).toBe("");
      expect(result.current.chequeRelatedFormData.status).toBe("قيد الانتظار");
      expect(result.current.chequeRelatedFormData.chequeType).toBe("عادي");
    });

    it('should reset inventory form', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setInventoryRelatedFormData({
          itemName: "حديد",
          quantity: "100",
          unit: "كجم",
          thickness: "10",
          width: "5",
          length: "3",
          notes: "مخزون جديد",
        });
      });

      expect(result.current.inventoryRelatedFormData.itemName).toBe("حديد");
      expect(result.current.inventoryRelatedFormData.notes).toBe("مخزون جديد");

      act(() => {
        result.current.resetInventoryForm();
      });

      expect(result.current.inventoryRelatedFormData.itemName).toBe("");
      expect(result.current.inventoryRelatedFormData.quantity).toBe("");
      expect(result.current.inventoryRelatedFormData.notes).toBe("");
    });
  });

  describe('Complex Scenarios', () => {
    it('should maintain independent state for multiple forms', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setFormData({ ...result.current.formData, description: "Main Form" });
        result.current.setCheckFormData({ ...result.current.checkFormData, chequeNumber: "CHQ-001" });
        result.current.setPaymentFormData({ ...result.current.paymentFormData, amount: "100" });
      });

      expect(result.current.formData.description).toBe("Main Form");
      expect(result.current.checkFormData.chequeNumber).toBe("CHQ-001");
      expect(result.current.paymentFormData.amount).toBe("100");

      // Resetting payment shouldn't affect other forms
      act(() => {
        result.current.resetPaymentForm();
      });

      expect(result.current.formData.description).toBe("Main Form");
      expect(result.current.checkFormData.chequeNumber).toBe("CHQ-001");
      expect(result.current.paymentFormData.amount).toBe("");
    });

    it('should handle complete workflow: load, edit, reset', () => {
      const { result } = renderHook(() => useLedgerForm());

      const mockEntry: LedgerEntry = {
        id: "entry-1",
        transactionId: "TXN-001",
        description: "Original",
        type: "دخل",
        amount: 1000,
        category: "مبيعات",
        subCategory: "منتجات",
        associatedParty: "عميل أ",
        reference: "REF-001",
        notes: "",
        date: new Date("2025-01-15"),
        createdAt: new Date("2025-01-15"),
      };

      // Load entry
      act(() => {
        result.current.loadEntryForEdit(mockEntry);
      });
      expect(result.current.formData.description).toBe("Original");

      // Edit
      act(() => {
        result.current.setFormData({
          ...result.current.formData,
          description: "Modified",
        });
      });
      expect(result.current.formData.description).toBe("Modified");

      // Reset
      act(() => {
        result.current.resetAllForms();
      });
      expect(result.current.formData.description).toBe("");
    });

    it('should handle all AR/AP related fields', () => {
      const { result } = renderHook(() => useLedgerForm());

      act(() => {
        result.current.setFormData({
          ...result.current.formData,
          trackARAP: true,
          immediateSettlement: false,
        });
        result.current.setHasInitialPayment(true);
        result.current.setInitialPaymentAmount("250");
      });

      expect(result.current.formData.trackARAP).toBe(true);
      expect(result.current.formData.immediateSettlement).toBe(false);
      expect(result.current.hasInitialPayment).toBe(true);
      expect(result.current.initialPaymentAmount).toBe("250");

      act(() => {
        result.current.resetAllForms();
      });

      expect(result.current.formData.trackARAP).toBe(false);
      expect(result.current.hasInitialPayment).toBe(false);
      expect(result.current.initialPaymentAmount).toBe("");
    });
  });
});
