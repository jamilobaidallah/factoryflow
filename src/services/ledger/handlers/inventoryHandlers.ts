/**
 * Inventory Handlers
 * Batch operations for inventory updates, COGS calculation, and movements
 */

import { firestore } from "@/firebase/config";
import {
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  WriteBatch,
  CollectionReference,
} from "firebase/firestore";
import type { InventoryFormData, LedgerFormData, InventoryItemData } from "@/components/ledger/types/ledger";
import { calculateWeightedAverageCost, calculateLandedCostUnitPrice } from "@/lib/inventory-utils";
import {
  parseAmount,
  safeAdd,
  safeSubtract,
  safeMultiply,
  sumAmounts,
  roundCurrency,
} from "@/lib/currency";
import {
  InventoryItemNotFoundError,
  InsufficientQuantityError,
  isInventoryItemNotFoundError,
  isInsufficientQuantityError,
} from "@/lib/errors";
import type { HandlerContext, InventoryUpdateResult, COGSResult, CollectionRefs } from "../types";
import { NON_CASH_SUBCATEGORIES } from "@/components/ledger/utils/ledger-constants";

// Path helper
const getUserCollectionPath = (userId: string, collectionName: string) =>
  `users/${userId}/${collectionName}`;

/**
 * Handle inventory update with transaction safety
 * Uses runTransaction for read-modify-write operations to prevent race conditions
 * @param itemIndex - index of this item within a multi-item ledger entry (used for unique COGS transactionId)
 */
export async function handleInventoryUpdate(
  ctx: HandlerContext,
  inventoryFormData: InventoryFormData,
  itemIndex: number = 0
): Promise<InventoryUpdateResult> {
  const { batch, transactionId, formData, entryType, userId, refs } = ctx;

  // Determine movement direction:
  // - Expense (مصروف) for purchasing → inventory IN (دخول)
  // - Income (إيراد/دخل) for selling → inventory OUT (خروج)
  // - Non-cash expenses (wastage, samples) → inventory OUT (خروج) even though they're expenses
  const isReturn = formData.category === "مردودات المبيعات";
  const isNonCashExpense = (NON_CASH_SUBCATEGORIES as readonly string[]).includes(formData.subCategory);
  const movementType = (isReturn || (entryType === "مصروف" && !isNonCashExpense)) ? "دخول" : "خروج";
  let cogsCreated = false;
  let cogsAmount = 0;
  let cogsDescription = "";
  let inventoryChange: { itemId: string; quantityDelta: number } | undefined;
  let returnCostAmount = 0;
  const quantityChange = parseAmount(inventoryFormData.quantity);

  // Find if item exists
  const itemQuery = query(refs.inventory, where("itemName", "==", inventoryFormData.itemName));
  const itemSnapshot = await getDocs(itemQuery);

  let itemId = "";

  if (!itemSnapshot.empty) {
    // Item exists - use runTransaction for isolated read-modify-write
    const existingItem = itemSnapshot.docs[0];
    itemId = existingItem.id;
    const itemDocRef = doc(firestore, getUserCollectionPath(userId, "inventory"), itemId);

    try {
      const transactionResult = await runTransaction(firestore, async (transaction) => {
        const itemDoc = await transaction.get(itemDocRef);
        if (!itemDoc.exists()) {
          throw new InventoryItemNotFoundError(inventoryFormData.itemName);
        }

        const existingItemData = itemDoc.data() as InventoryItemData;
        const currentQuantity = existingItemData.quantity || 0;
        const currentUnitPrice = existingItemData.unitPrice || 0;

        const newQuantity =
          movementType === "دخول"
            ? safeAdd(currentQuantity, quantityChange)
            : safeSubtract(currentQuantity, quantityChange);

        if (newQuantity < 0) {
          throw new InsufficientQuantityError(currentQuantity, quantityChange, inventoryFormData.itemName);
        }

        if (isReturn) {
          // Return goods at current weighted average cost
          // No landed-cost recalculation (selling price ≠ cost price)
          // No lastPurchasePrice update (this is a return, not a purchase)
          // Weighted avg stays unchanged: (qty×price + returnQty×price) / (qty+returnQty) = price
          transaction.update(itemDocRef, { quantity: newQuantity });
          returnCostAmount = safeMultiply(quantityChange, currentUnitPrice);
        } else if (movementType === "دخول" && (inventoryFormData.itemAmount || formData.amount)) {
          const shippingCost = inventoryFormData.shippingCost ? parseAmount(inventoryFormData.shippingCost) : 0;
          const otherCosts = inventoryFormData.otherCosts ? parseAmount(inventoryFormData.otherCosts) : 0;
          // Use per-item amount if provided (multi-item purchase), otherwise fall back to total (single-item)
          const purchaseAmount = inventoryFormData.itemAmount
            ? parseAmount(inventoryFormData.itemAmount)
            : parseAmount(formData.amount);

          const purchaseUnitPrice = calculateLandedCostUnitPrice(
            purchaseAmount,
            shippingCost,
            otherCosts,
            quantityChange
          );

          const weightedAvgPrice = calculateWeightedAverageCost(
            currentQuantity,
            currentUnitPrice,
            quantityChange,
            purchaseUnitPrice
          );

          const totalLandedCost = sumAmounts([purchaseAmount, shippingCost, otherCosts]);

          transaction.update(itemDocRef, {
            quantity: newQuantity,
            unitPrice: weightedAvgPrice,
            lastPurchasePrice: purchaseUnitPrice,
            lastPurchaseDate: new Date(),
            lastPurchaseAmount: totalLandedCost,
          });
        } else {
          transaction.update(itemDocRef, { quantity: newQuantity });
        }

        const quantityDelta = movementType === "دخول" ? quantityChange : -quantityChange;
        return { currentUnitPrice, quantityDelta };
      });

      inventoryChange = { itemId, quantityDelta: transactionResult.quantityDelta };

      // Auto-record COGS when selling
      if (!isReturn && (entryType === "دخل" || entryType === "إيراد") && movementType === "خروج") {
        const cogs = addCOGSRecord(
          batch,
          refs.ledger,
          transactionId,
          inventoryFormData.itemName,
          quantityChange,
          transactionResult.currentUnitPrice,
          new Date(formData.date),
          itemIndex
        );
        cogsCreated = true;
        cogsAmount = cogs.amount;
        cogsDescription = cogs.description;
      }

      // Auto-record COGS reversal when goods are returned to inventory
      // (Journal DR 1300 / CR 5000 is handled by the 4-line SALES_RETURN journal —
      //  this ledger entry is for ledger-based P&L reports only)
      if (isReturn && returnCostAmount > 0) {
        addCOGSReversalRecord(
          batch,
          refs.ledger,
          transactionId,
          inventoryFormData.itemName,
          quantityChange,
          transactionResult.currentUnitPrice,
          new Date(formData.date),
          itemIndex
        );
      }
    } catch (error) {
      if (isInventoryItemNotFoundError(error)) {
        return {
          success: false,
          error: `الصنف "${error.itemName}" لم يعد موجوداً في المخزون`,
        };
      }
      if (isInsufficientQuantityError(error)) {
        return {
          success: false,
          error: `الكمية المتوفرة في المخزون (${error.availableQuantity}) غير كافية لإجراء عملية خروج بكمية ${error.requestedQuantity}`,
        };
      }
      throw error;
    }
  } else {
    // Item doesn't exist
    if (movementType === "خروج") {
      return {
        success: false,
        error: `الصنف "${inventoryFormData.itemName}" غير موجود في المخزون. لا يمكن إجراء عملية خروج`,
      };
    }

    itemId = createNewInventoryItemInBatch(batch, refs.inventory, inventoryFormData, formData, quantityChange);
  }

  // Add movement record
  addMovementRecordToBatch(
    batch,
    refs.inventoryMovements,
    itemId,
    inventoryFormData,
    movementType,
    quantityChange,
    transactionId,
    formData.description
  );

  return {
    success: true,
    cogsCreated,
    cogsAmount,
    cogsDescription,
    inventoryChange,
    ...(isReturn && { returnCostAmount }),
  };
}

/**
 * Create a COGS (Cost of Goods Sold) ledger entry in the batch
 * @param itemIndex - index within multi-item transaction; ensures unique transactionId per item
 */
export function addCOGSRecord(
  batch: WriteBatch,
  ledgerRef: CollectionReference,
  transactionId: string,
  itemName: string,
  quantity: number,
  unitCost: number,
  date: Date,
  itemIndex: number = 0
): COGSResult {
  const cogsAmount = safeMultiply(quantity, unitCost);
  const cogsDescription = `تكلفة البضاعة المباعة - ${itemName}`;

  const cogsDocRef = doc(ledgerRef);
  batch.set(cogsDocRef, {
    transactionId: `COGS-${transactionId}-${itemIndex}`,  // unique per item
    description: cogsDescription,
    type: "مصروف",
    amount: cogsAmount,
    category: "تكلفة البضاعة المباعة (COGS)",
    subCategory: "مبيعات",
    date,
    linkedTransactionId: transactionId,  // backlink to parent sale
    autoGenerated: true,
    notes: `حساب تلقائي: ${quantity} × ${roundCurrency(unitCost).toFixed(2)} = ${roundCurrency(cogsAmount).toFixed(2)} دينار`,
    createdAt: new Date(),
  });

  return { amount: cogsAmount, description: cogsDescription };
}

/**
 * Create a COGS reversal ledger entry when returned goods come back to inventory.
 * Mirrors addCOGSRecord() but marks isCOGSReversal: true so expense calculations
 * subtract it rather than add it.
 *
 * NOTE: The double-entry side (DR 1300 / CR 5000) is already handled by the
 * 4-line SALES_RETURN journal in LedgerService. This entry is for ledger-based
 * P&L reports only.
 */
export function addCOGSReversalRecord(
  batch: WriteBatch,
  ledgerRef: CollectionReference,
  transactionId: string,
  itemName: string,
  quantity: number,
  unitCost: number,
  date: Date,
  itemIndex: number = 0
): void {
  const reversalAmount = safeMultiply(quantity, unitCost);
  const cogsReversalDocRef = doc(ledgerRef);
  batch.set(cogsReversalDocRef, {
    transactionId: `COGS-RTN-${transactionId}-${itemIndex}`,  // unique per item
    description: `رد تكلفة البضاعة المعادة - ${itemName}`,
    type: "مصروف",
    amount: reversalAmount,
    category: "تكلفة البضاعة المباعة (COGS)",
    subCategory: "مردودات",
    date,
    linkedTransactionId: transactionId,
    autoGenerated: true,
    isCOGSReversal: true,
    notes: `عكس تلقائي: ${quantity} × ${roundCurrency(unitCost).toFixed(2)} = ${roundCurrency(reversalAmount).toFixed(2)} دينار`,
    createdAt: new Date(),
  });
}

/**
 * Create a new inventory item in the batch
 */
export function createNewInventoryItemInBatch(
  batch: WriteBatch,
  inventoryRef: CollectionReference,
  inventoryFormData: InventoryFormData,
  formData: LedgerFormData,
  quantityChange: number
): string {
  const shippingCost = inventoryFormData.shippingCost ? parseAmount(inventoryFormData.shippingCost) : 0;
  const otherCosts = inventoryFormData.otherCosts ? parseAmount(inventoryFormData.otherCosts) : 0;
  // Use per-item amount if provided (multi-item purchase), otherwise fall back to total
  const purchaseAmount = inventoryFormData.itemAmount
    ? parseAmount(inventoryFormData.itemAmount)
    : (formData.amount ? parseAmount(formData.amount) : 0);
  const totalLandedCost = sumAmounts([purchaseAmount, shippingCost, otherCosts]);

  const calculatedUnitPrice = calculateLandedCostUnitPrice(
    purchaseAmount,
    shippingCost,
    otherCosts,
    quantityChange
  );

  const newItemRef = doc(inventoryRef);
  batch.set(newItemRef, {
    itemName: inventoryFormData.itemName,
    category: formData.category || "غير مصنف",
    quantity: quantityChange,
    unit: inventoryFormData.unit,
    unitPrice: calculatedUnitPrice,
    thickness: inventoryFormData.thickness ? parseAmount(inventoryFormData.thickness) : null,
    width: inventoryFormData.width ? parseAmount(inventoryFormData.width) : null,
    length: inventoryFormData.length ? parseAmount(inventoryFormData.length) : null,
    minStock: 0,
    location: "",
    notes: `تم الإنشاء تلقائياً من المعاملة: ${formData.description}`,
    createdAt: new Date(),
    lastPurchasePrice: calculatedUnitPrice,
    lastPurchaseDate: new Date(),
    lastPurchaseAmount: totalLandedCost,
  });

  return newItemRef.id;
}

/**
 * Add an inventory movement record to the batch
 */
export function addMovementRecordToBatch(
  batch: WriteBatch,
  inventoryMovementsRef: CollectionReference,
  itemId: string,
  inventoryFormData: InventoryFormData,
  movementType: string,
  quantityChange: number,
  transactionId: string,
  description: string
): void {
  const movementDocRef = doc(inventoryMovementsRef);
  batch.set(movementDocRef, {
    itemId,
    itemName: inventoryFormData.itemName,
    type: movementType,
    quantity: quantityChange,
    unit: inventoryFormData.unit,
    thickness: inventoryFormData.thickness ? parseAmount(inventoryFormData.thickness) : null,
    width: inventoryFormData.width ? parseAmount(inventoryFormData.width) : null,
    length: inventoryFormData.length ? parseAmount(inventoryFormData.length) : null,
    linkedTransactionId: transactionId,
    notes: `مرتبط بالمعاملة: ${description}`,
    createdAt: new Date(),
  });
}

/**
 * Rollback inventory changes if batch commit fails
 * Best-effort: logs errors but doesn't throw
 */
export async function rollbackInventoryChanges(
  userId: string,
  changes: Array<{ itemId: string; quantityDelta: number }>
): Promise<void> {
  const rollbackTasks = changes.map(async ({ itemId, quantityDelta }) => {
    try {
      const itemDocRef = doc(firestore, getUserCollectionPath(userId, "inventory"), itemId);

      await runTransaction(firestore, async (transaction) => {
        const itemDoc = await transaction.get(itemDocRef);
        if (itemDoc.exists()) {
          const currentQuantity = (itemDoc.data() as InventoryItemData).quantity || 0;
          const rolledBackQuantity = Math.max(0, currentQuantity - quantityDelta);
          transaction.update(itemDocRef, { quantity: rolledBackQuantity });
        }
      });

      // Inventory rollback succeeded
    } catch (rollbackError) {
      console.error(`Failed to rollback inventory for item ${itemId}:`, rollbackError);
    }
  });

  await Promise.all(rollbackTasks);
}
