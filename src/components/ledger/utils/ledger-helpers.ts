/**
 * Helper function to get category type
 * Returns: "دخل" (income), "مصروف" (expense), or "حركة رأس مال" (equity)
 */
export function getCategoryType(categoryName: string, _subCategory?: string): string {
    // Find category and return its type
    const categories = [
        { name: "إيرادات المبيعات", type: "دخل" },
        { name: "رأس المال", type: "حركة رأس مال" },  // Equity - not P&L
        { name: "إيرادات أخرى", type: "دخل" },
        { name: "تكلفة البضاعة المباعة (COGS)", type: "مصروف" },
        { name: "مصاريف تشغيلية", type: "مصروف" },
        { name: "أصول ثابتة", type: "مصروف" },
        { name: "التزامات مالية", type: "مصروف" },
        { name: "مصاريف أخرى", type: "مصروف" },
    ];

    const category = categories.find(cat => cat.name === categoryName);
    return category?.type || "دخل";
}

/**
 * Helper function to check if a transaction type is equity
 * Handles both new type and backward compatibility with old data
 *
 * Equity transactions (capital contributions, owner drawings) affect cash
 * balance but NOT profit/loss calculations. They are:
 * - NOT counted in P&L (Income Statement)
 * - Counted in Cash Flow (Financing Activities)
 * - NOT tracked as AR/AP (no payment status)
 *
 * @param type - Transaction type ("دخل", "مصروف", "حركة رأس مال")
 * @param category - Transaction category name
 * @returns true if this is an equity transaction
 */
export function isEquityTransaction(type?: string, category?: string): boolean {
    return type === "حركة رأس مال" ||
           category === "رأس المال" ||
           category === "Owner Equity";
}

/**
 * Helper function to check if a subcategory represents capital contribution (cash IN)
 * @param subCategory - The equity subcategory
 * @returns true if this is a capital contribution (increases equity)
 */
export function isCapitalContribution(subCategory?: string): boolean {
    return subCategory === "رأس مال مالك";
}

/**
 * Helper function to check if a subcategory represents owner drawing (cash OUT)
 * @param subCategory - The equity subcategory
 * @returns true if this is an owner drawing (decreases equity)
 */
export function isOwnerDrawing(subCategory?: string): boolean {
    return subCategory === "سحوبات المالك";
}

/**
 * Helper function to generate unique transaction ID
 * Format: TXN-YYYYMMDD-HHMMSS-RRR
 */
export function generateTransactionId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

    return `TXN-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}
