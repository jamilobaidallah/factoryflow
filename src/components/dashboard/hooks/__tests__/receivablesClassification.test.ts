import {
  isOutstandingReceivable,
  isOutstandingPayable,
  getOutstandingAmount,
} from "../receivablesClassification";

/**
 * Regression tests for the advance misclassification bug.
 *
 * Advances reuse AR/AP tracking fields (paymentStatus/remainingBalance) and carry
 * income/expense type, so they used to land on the WRONG side of the dashboard alerts.
 * The obligation runs OPPOSITE to the stored type, so they must flip sides:
 *   - سلفة عميل (customer advance, income type) is a LIABILITY (we owe the customer)
 *     → must count as a PAYABLE, not a receivable.
 *   - سلفة مورد (supplier advance, expense type) is an ASSET (the supplier owes us)
 *     → must count as a RECEIVABLE, not a payable.
 */
describe("receivables/payables classification", () => {
  describe("trade AR/AP still counts (no regression)", () => {
    it("counts an unpaid credit sale as a receivable", () => {
      const entry = {
        type: "دخل",
        category: "إيرادات المبيعات",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 1000,
      };
      expect(isOutstandingReceivable(entry)).toBe(true);
      expect(isOutstandingPayable(entry)).toBe(false);
    });

    it("counts an unpaid purchase as a payable", () => {
      const entry = {
        type: "مصروف",
        category: "مشتريات",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 500,
      };
      expect(isOutstandingPayable(entry)).toBe(true);
      expect(isOutstandingReceivable(entry)).toBe(false);
    });

    it("counts a partial entry as outstanding", () => {
      const entry = {
        type: "دخل",
        category: "إيرادات المبيعات",
        paymentStatus: "partial",
        remainingBalance: 300,
      };
      expect(isOutstandingReceivable(entry)).toBe(true);
    });

    it("excludes fully paid entries", () => {
      const entry = {
        type: "دخل",
        category: "إيرادات المبيعات",
        paymentStatus: "paid",
        isARAPEntry: true,
      };
      expect(isOutstandingReceivable(entry)).toBe(false);
    });
  });

  describe("advances flip to the opposite side (the bug fix)", () => {
    it("counts a customer advance (سلفة عميل) as a PAYABLE, not a receivable", () => {
      // Customer prepaid us → we owe them goods → liability → payable.
      const customerAdvance = {
        type: "دخل",
        category: "سلفة عميل",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 2000,
      };
      expect(isOutstandingPayable(customerAdvance)).toBe(true);
      expect(isOutstandingReceivable(customerAdvance)).toBe(false);
    });

    it("counts a supplier advance (سلفة مورد) as a RECEIVABLE, not a payable", () => {
      // We prepaid the supplier → they owe us goods → asset → receivable.
      const supplierAdvance = {
        type: "مصروف",
        category: "سلفة مورد",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 4060,
      };
      expect(isOutstandingReceivable(supplierAdvance)).toBe(true);
      expect(isOutstandingPayable(supplierAdvance)).toBe(false);
    });

    it("flips partially-consumed advances too", () => {
      const partialCustomerAdvance = {
        type: "دخل",
        category: "سلفة عميل",
        paymentStatus: "partial",
        remainingBalance: 22,
      };
      expect(isOutstandingPayable(partialCustomerAdvance)).toBe(true);
      expect(isOutstandingReceivable(partialCustomerAdvance)).toBe(false);
    });

    it("does not count a fully-consumed advance on either side", () => {
      const paidAdvance = {
        type: "مصروف",
        category: "سلفة مورد",
        paymentStatus: "paid",
        isARAPEntry: true,
      };
      expect(isOutstandingReceivable(paidAdvance)).toBe(false);
      expect(isOutstandingPayable(paidAdvance)).toBe(false);
    });
  });

  describe("loans count on the correct side (initial entries only)", () => {
    it("counts an outstanding loan given (قروض ممنوحة) as a RECEIVABLE", () => {
      // We lent money → they owe us → asset → receivable.
      const loanGiven = {
        type: "قرض",
        category: "قروض ممنوحة",
        subCategory: "منح قرض",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 5000,
      };
      expect(isOutstandingReceivable(loanGiven)).toBe(true);
      expect(isOutstandingPayable(loanGiven)).toBe(false);
    });

    it("counts an outstanding loan received (قروض مستلمة) as a PAYABLE", () => {
      // We borrowed money → we owe them → liability → payable.
      const loanReceived = {
        type: "قرض",
        category: "قروض مستلمة",
        subCategory: "استلام قرض",
        paymentStatus: "partial",
        isARAPEntry: true,
        remainingBalance: 1200,
      };
      expect(isOutstandingPayable(loanReceived)).toBe(true);
      expect(isOutstandingReceivable(loanReceived)).toBe(false);
    });

    it("does NOT count a loan collection (تحصيل قرض) — it's a netting entry", () => {
      const loanCollection = {
        type: "قرض",
        category: "قروض ممنوحة",
        subCategory: "تحصيل قرض",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 1000,
      };
      expect(isOutstandingReceivable(loanCollection)).toBe(false);
      expect(isOutstandingPayable(loanCollection)).toBe(false);
    });

    it("does NOT count a loan repayment (سداد قرض) — it's a netting entry", () => {
      const loanRepayment = {
        type: "قرض",
        category: "قروض مستلمة",
        subCategory: "سداد قرض",
        paymentStatus: "unpaid",
        isARAPEntry: true,
        amount: 800,
      };
      expect(isOutstandingPayable(loanRepayment)).toBe(false);
      expect(isOutstandingReceivable(loanRepayment)).toBe(false);
    });

    it("does NOT count a fully-repaid initial loan", () => {
      const repaidLoan = {
        type: "قرض",
        category: "قروض ممنوحة",
        subCategory: "منح قرض",
        paymentStatus: "paid",
        isARAPEntry: true,
      };
      expect(isOutstandingReceivable(repaidLoan)).toBe(false);
      expect(isOutstandingPayable(repaidLoan)).toBe(false);
    });
  });

  describe("getOutstandingAmount", () => {
    it("prefers remainingBalance for partial payments", () => {
      expect(
        getOutstandingAmount({ paymentStatus: "partial", remainingBalance: 22, amount: 222 })
      ).toBe(22);
    });

    it("falls back to amount for unpaid entries without remainingBalance", () => {
      expect(getOutstandingAmount({ paymentStatus: "unpaid", amount: 600 })).toBe(600);
    });

    it("returns 0 when nothing is outstanding", () => {
      expect(getOutstandingAmount({ paymentStatus: "paid", remainingBalance: 0 })).toBe(0);
    });
  });
});
