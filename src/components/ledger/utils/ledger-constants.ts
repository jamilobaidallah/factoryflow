/**
 * Advance Allocation Record - tracks how an advance was used to pay invoices
 */
export interface AdvanceAllocation {
    invoiceId: string;           // ID of the invoice this advance paid
    invoiceTransactionId: string; // Transaction ID for reference
    amount: number;              // Amount allocated from this advance
    date: Date;                  // Date of allocation
    description?: string;        // Invoice description for reference
}

/**
 * Advance Payment Record - tracks which advances paid an invoice
 */
export interface AdvancePaymentRecord {
    advanceId: string;           // ID of the advance entry
    advanceTransactionId: string; // Transaction ID for reference
    amount: number;              // Amount paid from this advance
    date: Date;                  // Date of allocation
}

/**
 * Ledger Entry Interface
 */
export interface LedgerEntry {
    id: string;
    transactionId: string;
    description: string;
    type: string; // "دخل" (income), "مصروف" (expense), "حركة رأس مال" (equity), or "قرض" (loan)
    amount: number;
    category: string;
    subCategory: string;
    associatedParty: string;
    ownerName?: string;
    date: Date;
    createdAt: Date;
    // AR/AP Tracking Fields
    totalPaid?: number;
    remainingBalance?: number;
    paymentStatus?: "paid" | "unpaid" | "partial";
    isARAPEntry?: boolean;
    immediateSettlement?: boolean;  // Whether entry was fully paid at creation (cash transaction)
    // Settlement Discount Fields
    totalDiscount?: number;           // Sum of all discounts given (خصم تسوية)
    // Bad Debt Write-off Fields
    writeoffAmount?: number;          // Amount written off as bad debt
    writeoffReason?: string;          // Reason for writeoff (required)
    writeoffDate?: Date;              // When written off
    writeoffBy?: string;              // User who authorized (audit)
    // Advance Allocation Fields (for سلفة عميل / سلفة مورد entries)
    advanceAllocations?: AdvanceAllocation[];  // Which invoices used this advance
    totalUsedFromAdvance?: number;             // Total amount consumed from this advance
    // Advance Payment Fields (for invoice entries paid by advances)
    paidFromAdvances?: AdvancePaymentRecord[]; // Which advances paid this invoice
    totalPaidFromAdvances?: number;            // Total amount paid from advances
}

/**
 * Category with subcategories
 */
interface Category {
    name: string;
    type: string;
    subcategories: string[];
}

/**
 * Ledger Categories with subcategories and their types
 */
export const CATEGORIES: Category[] = [
    // Income Categories
    {
        name: "إيرادات المبيعات",
        type: "دخل",
        subcategories: [
            "مبيعات منتجات",
            "خدمات",
            "استشارات",
            "عمولات",
        ]
    },
    // Equity Category (NOT P&L - affects cash balance but not profit/loss)
    {
        name: "رأس المال",
        type: "حركة رأس مال",
        subcategories: [
            "رأس مال مالك",    // Positive: increases equity, cash IN
            "سحوبات المالك",   // Negative: decreases equity, cash OUT
        ]
    },
    {
        name: "إيرادات أخرى",
        type: "دخل",
        subcategories: [
            "فوائد بنكية",
            "بيع أصول",
            "إيرادات متنوعة",
            "فوائد قروض محصلة",  // Interest income on loans given
        ]
    },
    // Expense Categories
    {
        name: "تكلفة البضاعة المباعة (COGS)",
        type: "مصروف",
        subcategories: [
            "مواد خام",
            "شحن",
            "شراء بضاعة جاهزة",
        ]
    },
    {
        name: "مصاريف تشغيلية",
        type: "مصروف",
        subcategories: [
            "رواتب وأجور",
            "إيجارات",
            "كهرباء وماء",
            "صيانة",
            "وقود ومواصلات",
            "رحلة عمل",
            "نقل بضاعة",
            "تسويق وإعلان",
            "عينات مجانية",       // Free samples for marketing
            "هدر وتالف",          // Wastage and spoilage
            "مصاريف إدارية",
            "اتصالات وإنترنت",
            "مصاريف مكتبية",
            "مستهلكات",        // Consumables (cleaning supplies, disposables, etc.)
            "أدوات ومعدات صغيرة",  // Small tools & equipment (below capitalization threshold)
        ]
    },
    {
        name: "أصول ثابتة",
        type: "مصروف",
        subcategories: [
            "معدات وآلات",
            "أثاث ومفروشات",
            "سيارات ومركبات",
            "مباني وعقارات",
            "أجهزة كمبيوتر",
        ]
    },
    {
        name: "التزامات مالية",
        type: "مصروف",
        subcategories: [
            "سداد قروض",
            "فوائد قروض",
            "ضرائب ورسوم",
        ]
    },
    {
        name: "مصاريف أخرى",
        type: "مصروف",
        subcategories: [
            "مصاريف قانونية",
            "تأمينات",
            "مصاريف متنوعة",
        ]
    },
    // Loan Categories (NOT P&L - Balance Sheet items)
    {
        name: "قروض مستلمة",  // Loans Received - Liability (money we borrowed)
        type: "قرض",
        subcategories: [
            "استلام قرض",     // Loan Receipt - creates liability, cash IN
            "سداد قرض",       // Loan Repayment - reduces liability, cash OUT
        ]
    },
    {
        name: "قروض ممنوحة",  // Loans Given - Asset (money we lent)
        type: "قرض",
        subcategories: [
            "منح قرض",       // Loan Given - creates asset, cash OUT
            "تحصيل قرض",     // Loan Collection - reduces asset, cash IN
        ]
    },
    // Advance Categories (NOT P&L - Balance Sheet items for prepayments)
    {
        name: "سلفة عميل",  // Customer Advance - Liability (we owe customer goods/services)
        type: "دخل",        // We RECEIVE cash from customer - shows in debit (they paid us)
        subcategories: [
            "دفعة مقدمة من عميل",     // Advance payment received - cash IN, liability created
        ]
    },
    {
        name: "سلفة مورد",  // Supplier Advance - Asset (supplier owes us goods/services)
        type: "مصروف",      // We PAY cash to supplier - shows in credit (we paid them)
        subcategories: [
            "دفعة مقدمة لمورد",       // Advance payment made - cash OUT, asset created
        ]
    },
];

/**
 * Non-cash expense subcategories
 * These expenses don't involve cash transactions (wastage, free samples, etc.)
 * Used to auto-select the non-cash expense payment option
 */
export const NON_CASH_SUBCATEGORIES = ["هدر وتالف", "عينات مجانية"] as const;
