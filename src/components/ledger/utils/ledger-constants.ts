/**
 * Ledger Entry Interface
 */
export interface LedgerEntry {
    id: string;
    transactionId: string;
    description: string;
    type: string; // "دخل" or "مصروف"
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
    {
        name: "رأس المال",
        type: "دخل",
        subcategories: [
            "رأس مال مالك",
            "سحوبات المالك",
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
