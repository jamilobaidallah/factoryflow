
/**
 * Calculates the new weighted average unit price after a purchase.
 * Formula: (Old Value + New Value) / Total Quantity
 */
export function calculateWeightedAverageCost(
    currentQuantity: number,
    currentUnitPrice: number,
    purchaseQuantity: number,
    purchaseUnitPrice: number
): number {
    if (purchaseQuantity <= 0 && currentQuantity <= 0) {
        return 0;
    }

    const oldValue = currentQuantity * currentUnitPrice;
    const newValue = purchaseQuantity * purchaseUnitPrice;
    const totalQuantity = currentQuantity + purchaseQuantity;

    if (totalQuantity === 0) {
        return 0;
    }

    const weightedAvg = (oldValue + newValue) / totalQuantity;
    return parseFloat(weightedAvg.toFixed(2));
}

/**
 * Calculates the Cost of Goods Sold (COGS).
 * Formula: Quantity Sold * Unit Cost
 */
export function calculateCOGS(
    quantitySold: number,
    unitCost: number
): number {
    const cogs = quantitySold * unitCost;
    return parseFloat(cogs.toFixed(2));
}

/**
 * Calculates the unit price based on landed cost (Purchase + Shipping + Other).
 */
export function calculateLandedCostUnitPrice(
    purchaseAmount: number,
    shippingCost: number,
    otherCosts: number,
    quantity: number
): number {
    if (quantity <= 0) {
        return 0;
    }

    const totalCost = purchaseAmount + shippingCost + otherCosts;
    const unitPrice = totalCost / quantity;
    return parseFloat(unitPrice.toFixed(2));
}

/**
 * Calculates production output unit cost.
 * Formula: (Total Material Cost + Production Expenses) / Output Quantity
 */
export function calculateProductionUnitCost(
    materialCost: number,
    productionExpenses: number,
    outputQuantity: number
): number {
    if (outputQuantity <= 0) {
        return 0;
    }

    const totalCost = materialCost + productionExpenses;
    const unitCost = totalCost / outputQuantity;
    return parseFloat(unitCost.toFixed(2));
}
