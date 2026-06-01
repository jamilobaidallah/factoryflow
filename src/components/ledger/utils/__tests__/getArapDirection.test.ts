import { getArapDirection } from "../ledger-helpers";

/**
 * getArapDirection is the single source of truth for AR/AP direction, shared by the
 * dashboard receivables/payables cards and the ledger AR/AP filter. It must keep
 * advances and loans on the correct (economic) side, independent of their stored type.
 */
describe("getArapDirection", () => {
  describe("trade invoices follow income/expense type", () => {
    it("income → receivable", () => {
      expect(getArapDirection("دخل", "إيرادات المبيعات", "مبيعات منتجات")).toBe("receivable");
      expect(getArapDirection("إيراد", "إيرادات أخرى")).toBe("receivable");
    });

    it("expense → payable", () => {
      expect(getArapDirection("مصروف", "مصاريف تشغيلية", "تسويق وإعلان")).toBe("payable");
    });

    it("returns null for non-directional types (returns, equity)", () => {
      expect(getArapDirection("مردود", "مردودات المبيعات")).toBeNull();
      expect(getArapDirection("حركة رأس مال", "رأس المال")).toBeNull();
    });
  });

  describe("advances flip relative to their stored type", () => {
    it("supplier advance (expense type) → receivable", () => {
      // We prepaid the supplier → they owe us → asset.
      expect(getArapDirection("مصروف", "سلفة مورد", "دفعة مقدمة لمورد")).toBe("receivable");
    });

    it("customer advance (income type) → payable", () => {
      // The customer prepaid us → we owe them → liability.
      expect(getArapDirection("دخل", "سلفة عميل", "دفعة مقدمة من عميل")).toBe("payable");
    });
  });

  describe("loans count only on the initial entry", () => {
    it("initial loan given → receivable", () => {
      expect(getArapDirection("قرض", "قروض ممنوحة", "منح قرض")).toBe("receivable");
    });

    it("initial loan received → payable", () => {
      expect(getArapDirection("قرض", "قروض مستلمة", "استلام قرض")).toBe("payable");
    });

    it("loan collection/repayment (netting entries) → null", () => {
      expect(getArapDirection("قرض", "قروض ممنوحة", "تحصيل قرض")).toBeNull();
      expect(getArapDirection("قرض", "قروض مستلمة", "سداد قرض")).toBeNull();
    });
  });
});
