/**
 * Ledger Entry Interface
 */
export interface LedgerEntry {
    id: string;
    transactionId: string;
    description: string;
    type: string; // "دخل" (income), "مصروف" (expense), or "حركة رأس مال" (equity)
    amount: number;
    category: string;
    subCategory: string;
    associatedParty: string;
    ownerName?: string;
    date: Date;
    reference: string;
    notes: string;
    createdAt: Date;
    // AR/AP Tracking Fields
    totalPaid?: number;
    remainingBalance?: number;
    paymentStatus?: "paid" | "unpaid" | "partial";
    isARAPEntry?: boolean;
    // Settlement Discount Fields
    totalDiscount?: number;           // Sum of all discounts given (خصم تسوية)
    // Bad Debt Write-off Fields
    writeoffAmount?: number;          // Amount written off as bad debt
    writeoffReason?: string;          // Reason for writeoff (required)
    writeoffDate?: Date;              // When written off
    writeoffBy?: string;              // User who authorized (audit)
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
            "مصاريف إدارية",
            "اتصالات وإنترنت",
            "مصاريف مكتبية",
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
];
