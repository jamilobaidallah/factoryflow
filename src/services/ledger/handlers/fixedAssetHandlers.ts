/**
 * Fixed Asset Handlers
 * Batch operations for fixed asset creation with depreciation calculation
 */

import { doc } from "firebase/firestore";
import type { FixedAssetFormData } from "@/components/ledger/types/ledger";
import { parseAmount, safeSubtract, safeMultiply, safeDivide } from "@/lib/currency";
import type { HandlerContext } from "../types";

/**
 * Handle fixed asset creation in batch
 * Calculates depreciation based on method (straight-line or declining balance)
 */
export function handleFixedAssetBatch(
  ctx: HandlerContext,
  fixedAssetFormData: FixedAssetFormData
): void {
  const { batch, transactionId, formData, refs } = ctx;
  const assetDocRef = doc(refs.fixedAssets);

  const purchaseCost = parseAmount(formData.amount);
  const usefulLifeYears = parseAmount(fixedAssetFormData.usefulLifeYears);
  const usefulLifeMonths = safeMultiply(usefulLifeYears, 12);
  const salvageValue = fixedAssetFormData.salvageValue
    ? parseAmount(fixedAssetFormData.salvageValue)
    : 0;

  const depreciableAmount = safeSubtract(purchaseCost, salvageValue);
  const monthlyDepreciation =
    fixedAssetFormData.depreciationMethod === "declining"
      ? safeDivide(safeMultiply(purchaseCost, 0.2), 12)
      : safeDivide(depreciableAmount, usefulLifeMonths);
  const bookValue = purchaseCost;

  // Generate asset number in format FA-YYYY-XXXX
  const now = new Date();
  const year = now.getFullYear();
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const assetNumber = `FA-${year}-${random}`;

  batch.set(assetDocRef, {
    assetNumber: assetNumber,
    assetName: fixedAssetFormData.assetName,
    category: "أخرى",
    purchaseDate: new Date(formData.date),
    purchaseCost: purchaseCost,
    salvageValue: salvageValue,
    usefulLifeMonths: usefulLifeMonths,
    monthlyDepreciation: monthlyDepreciation,
    depreciationMethod: fixedAssetFormData.depreciationMethod,
    accumulatedDepreciation: 0,
    bookValue: bookValue,
    linkedTransactionId: transactionId,
    status: "active",
    notes: `مرتبط بالمعاملة: ${formData.description}`,
    createdAt: new Date(),
  });
}
