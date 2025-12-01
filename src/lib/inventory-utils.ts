import { safeAdd, safeMultiply, safeDivide, sumAmounts } from "./currency";

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

    const oldValue = safeMultiply(currentQuantity, currentUnitPrice);
    const newValue = safeMultiply(purchaseQuantity, purchaseUnitPrice);
    const totalQuantity = safeAdd(currentQuantity, purchaseQuantity);

    if (totalQuantity === 0) {
        return 0;
    }

    return safeDivide(safeAdd(oldValue, newValue), totalQuantity);
}

/**
 * Calculates the Cost of Goods Sold (COGS).
 * Formula: Quantity Sold * Unit Cost
 */
export function calculateCOGS(
    quantitySold: number,
    unitCost: number
): number {
    return safeMultiply(quantitySold, unitCost);
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

    const totalCost = sumAmounts([purchaseAmount, shippingCost, otherCosts]);
    return safeDivide(totalCost, quantity);
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

    const totalCost = safeAdd(materialCost, productionExpenses);
    return safeDivide(totalCost, outputQuantity);
}
