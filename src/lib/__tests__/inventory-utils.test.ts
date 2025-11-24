
import {
    calculateWeightedAverageCost,
    calculateCOGS,
    calculateLandedCostUnitPrice,
    calculateProductionUnitCost
} from '../inventory-utils';

describe('Inventory Utilities', () => {
    describe('calculateWeightedAverageCost', () => {
        it('should calculate weighted average correctly', () => {
            // Old: 100 units @ 10 = 1000
            // New: 50 units @ 12 = 600
            // Total: 150 units, Value 1600
            // Avg: 1600 / 150 = 10.666... -> 10.67

            const result = calculateWeightedAverageCost(100, 10, 50, 12);
            expect(result).toBe(10.67);
        });

        it('should handle zero initial quantity', () => {
            // Old: 0 units @ 0
            // New: 100 units @ 10
            // Avg: 10
            const result = calculateWeightedAverageCost(0, 0, 100, 10);
            expect(result).toBe(10);
        });

        it('should handle zero total quantity', () => {
            const result = calculateWeightedAverageCost(0, 0, 0, 0);
            expect(result).toBe(0);
        });
    });

    describe('calculateCOGS', () => {
        it('should calculate COGS correctly', () => {
            // 50 units * 10.67 = 533.5
            const result = calculateCOGS(50, 10.67);
            expect(result).toBe(533.5);
        });
    });

    describe('calculateLandedCostUnitPrice', () => {
        it('should include shipping and other costs', () => {
            // Purchase: 1000
            // Shipping: 50
            // Other: 50
            // Total: 1100
            // Qty: 100
            // Unit: 11
            const result = calculateLandedCostUnitPrice(1000, 50, 50, 100);
            expect(result).toBe(11);
        });

        it('should handle zero quantity', () => {
            const result = calculateLandedCostUnitPrice(1000, 0, 0, 0);
            expect(result).toBe(0);
        });
    });

    describe('calculateProductionUnitCost', () => {
        it('should calculate production cost correctly', () => {
            // Material: 1000
            // Expenses: 200
            // Output: 10
            // Unit: 120
            const result = calculateProductionUnitCost(1000, 200, 10);
            expect(result).toBe(120);
        });
    });
});
