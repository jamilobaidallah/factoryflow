/**
 * Helper function to get category type
 * Special handling: Owner withdrawals should be treated as expense
 */
export function getCategoryType(categoryName: string, subCategory?: string): string {
    // Special handling: Owner withdrawals should be treated as expense
    if (subCategory === "سحوبات المالك") {
        return "مصروف";
    }

    // Find category and return its type
    const categories = [
        { name: "إيرادات المبيعات", type: "دخل" },
        { name: "رأس المال", type: "دخل" },
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
