/**
 * Auto Depreciation Service
 *
 * Handles automatic detection and processing of pending depreciation periods.
 *
 * CRITICAL: Depreciation must be processed sequentially (oldest to newest)
 * because each month's calculation depends on the previous month's ending values.
 * If any month fails, processing must STOP immediately to maintain data integrity.
 */

import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import {
  FixedAsset,
  DepreciationPeriod,
  PendingPeriod,
  AutoDepreciationResult,
} from "@/components/fixed-assets/types/fixed-assets";
import {
  safeSubtract,
  safeAdd,
  safeDivide,
  roundCurrency,
} from "@/lib/currency";
import { createJournalPostingEngine } from "@/services/journal";
import { logActivity } from "@/services/activityLogService";

// Helper function to generate transaction ID
function generateTransactionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `TXN-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

/**
 * Get all periods that need depreciation processing.
 *
 * Logic:
 * 1. Find the earliest purchase date among active assets
 * 2. Generate all months from that date to (current month - 1)
 * 3. Query depreciation_runs for already processed periods
 * 4. Return the difference (pending = all expected - already processed)
 */
export async function getPendingDepreciationPeriods(
  dataOwnerId: string,
  assets: FixedAsset[]
): Promise<PendingPeriod[]> {
  const activeAssets = assets.filter((a) => a.status === "active");

  if (activeAssets.length === 0) {
    return [];
  }

  // Find earliest purchase date
  let earliestDate: Date | null = null;
  for (const asset of activeAssets) {
    const purchaseDate = new Date(asset.purchaseDate);
    if (!earliestDate || purchaseDate < earliestDate) {
      earliestDate = purchaseDate;
    }
  }

  if (!earliestDate) {
    return [];
  }

  // Generate all expected periods from earliest purchase to last complete month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // We only process up to the previous month (not current month)
  let endYear = currentYear;
  let endMonth = currentMonth - 1;
  if (endMonth === 0) {
    endMonth = 12;
    endYear = currentYear - 1;
  }

  const startYear = earliestDate.getFullYear();
  const startMonth = earliestDate.getMonth() + 1; // 1-indexed

  const allExpectedPeriods: PendingPeriod[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    allExpectedPeriods.push({
      year,
      month,
      periodLabel: `${year}-${String(month).padStart(2, "0")}`,
    });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  if (allExpectedPeriods.length === 0) {
    return [];
  }

  // Query for already processed periods
  const runsRef = collection(firestore, `users/${dataOwnerId}/depreciation_runs`);
  const runsSnapshot = await getDocs(runsRef);
  const processedPeriods = new Set<string>();
  runsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.period) {
      processedPeriods.add(data.period);
    }
  });

  // Return pending periods (not yet processed)
  const pendingPeriods = allExpectedPeriods.filter(
    (p) => !processedPeriods.has(p.periodLabel)
  );

  // CRITICAL: Sort chronologically (oldest first) for sequential processing
  pendingPeriods.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return pendingPeriods;
}

/**
 * Run depreciation for a single period.
 *
 * This is extracted from useFixedAssetsOperations to be reusable.
 * Returns success/failure with error message.
 */
export async function runDepreciationForPeriod(
  dataOwnerId: string,
  period: DepreciationPeriod,
  assets: FixedAsset[],
  userId: string,
  userEmail: string
): Promise<{ success: boolean; totalDepreciation: number; error?: string }> {
  try {
    const batch = writeBatch(firestore);
    const periodLabel = `${period.year}-${String(period.month).padStart(2, "0")}`;

    // Check if depreciation already run for this period
    const runsRef = collection(firestore, `users/${dataOwnerId}/depreciation_runs`);
    const runQuery = query(runsRef, where("period", "==", periodLabel));
    const runSnapshot = await getDocs(runQuery);

    if (!runSnapshot.empty) {
      return {
        success: false,
        totalDepreciation: 0,
        error: `الفترة ${periodLabel} تم معالجتها مسبقاً`,
      };
    }

    // Get active assets
    const activeAssets = assets.filter((a) => a.status === "active");

    if (activeAssets.length === 0) {
      return {
        success: false,
        totalDepreciation: 0,
        error: "لا توجد أصول ثابتة نشطة",
      };
    }

    let totalDepreciation = 0;
    const transactionId = generateTransactionId();

    // Calculate the last day of the depreciation period
    const periodEndDate = new Date(period.year, period.month, 0);

    // Process each asset
    for (const asset of activeAssets) {
      // Check if asset is fully depreciated
      const depreciableTotal = safeSubtract(asset.purchaseCost, asset.salvageValue);
      if (asset.accumulatedDepreciation >= depreciableTotal) {
        continue; // Skip fully depreciated assets
      }

      const remainingDepreciable = safeSubtract(
        depreciableTotal,
        asset.accumulatedDepreciation
      );
      const depreciationAmount = Math.min(
        asset.monthlyDepreciation,
        remainingDepreciable
      );

      const newAccumulatedDepreciation = safeAdd(
        asset.accumulatedDepreciation,
        depreciationAmount
      );
      const newBookValue = safeSubtract(asset.purchaseCost, newAccumulatedDepreciation);

      // Create depreciation record
      const recordsRef = collection(
        firestore,
        `users/${dataOwnerId}/depreciation_records`
      );
      const recordDocRef = doc(recordsRef);
      batch.set(recordDocRef, {
        assetId: asset.id,
        assetName: asset.assetName,
        month: period.month,
        year: period.year,
        periodLabel: periodLabel,
        depreciationAmount: depreciationAmount,
        accumulatedDepreciationBefore: asset.accumulatedDepreciation,
        accumulatedDepreciationAfter: newAccumulatedDepreciation,
        bookValueBefore: asset.bookValue,
        bookValueAfter: newBookValue,
        ledgerEntryId: transactionId,
        recordedDate: new Date(),
        createdAt: new Date(),
      });

      // Update asset
      const assetRef = doc(firestore, `users/${dataOwnerId}/fixed_assets`, asset.id);
      batch.update(assetRef, {
        accumulatedDepreciation: newAccumulatedDepreciation,
        bookValue: newBookValue,
        lastDepreciationDate: new Date(),
      });

      totalDepreciation = safeAdd(totalDepreciation, depreciationAmount);
    }

    if (totalDepreciation === 0) {
      return {
        success: true,
        totalDepreciation: 0,
        error: undefined,
      };
    }

    // Create ledger entry for total depreciation
    const ledgerRef = collection(firestore, `users/${dataOwnerId}/ledger`);
    const ledgerDocRef = doc(ledgerRef);
    batch.set(ledgerDocRef, {
      transactionId: transactionId,
      description: `استهلاك أصول ثابتة - ${periodLabel}`,
      type: "مصروف",
      amount: totalDepreciation,
      category: "مصاريف تشغيلية",
      subCategory: "استهلاك أصول ثابتة",
      associatedParty: "",
      date: periodEndDate,
      reference: periodLabel,
      notes: `استهلاك شهري لعدد ${activeAssets.length} أصول ثابتة`,
      autoGenerated: true,
      createdAt: new Date(),
    });

    // Record depreciation run
    const runDocRef = doc(runsRef);
    batch.set(runDocRef, {
      period: periodLabel,
      runDate: new Date(),
      assetsCount: activeAssets.length,
      totalDepreciation: totalDepreciation,
      ledgerEntryId: transactionId,
      createdAt: new Date(),
    });

    await batch.commit();

    // Log activity
    logActivity(dataOwnerId, {
      action: "update",
      module: "fixed_assets",
      targetId: periodLabel,
      userId: userId,
      userEmail: userEmail,
      description: `تسجيل إهلاك: ${periodLabel}`,
      metadata: {
        amount: totalDepreciation,
        period: periodLabel,
        assetsCount: activeAssets.length,
        auto: true,
      },
    });

    // Create journal entry for depreciation
    if (totalDepreciation > 0) {
      try {
        const engine = createJournalPostingEngine(dataOwnerId);
        const journalResult = await engine.post({
          templateId: "DEPRECIATION",
          amount: totalDepreciation,
          date: periodEndDate,
          description: `استهلاك أصول ثابتة - ${periodLabel}`,
          source: {
            type: "depreciation",
            documentId: transactionId,
            transactionId,
          },
        });

        if (!journalResult.success) {
          // CRITICAL: Journal failed after batch committed
          // This is a data inconsistency - the depreciation records exist but the
          // double-entry journal does not. Log comprehensive details for manual recovery.
          console.error(
            "CRITICAL: Depreciation journal entry failed after batch commit",
            JSON.stringify({
              transactionId,
              periodLabel,
              dataOwnerId,
              totalDepreciation,
              timestamp: new Date().toISOString(),
              error: journalResult.error,
              recovery: "Manual journal entry required: DR 5400 (Depreciation Expense), CR 1510 (Accumulated Depreciation)",
            })
          );
          return {
            success: false,
            totalDepreciation,
            error: `تم تسجيل الاستهلاك لكن فشل إنشاء القيد المحاسبي للفترة ${periodLabel}`,
          };
        }
      } catch (err) {
        // CRITICAL: Journal creation threw an exception after batch commit
        console.error(
          "CRITICAL: Failed to create depreciation journal entry",
          JSON.stringify({
            transactionId,
            periodLabel,
            dataOwnerId,
            totalDepreciation,
            timestamp: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
            recovery: "Manual journal entry required: DR 5400 (Depreciation Expense), CR 1510 (Accumulated Depreciation)",
          })
        );
        return {
          success: false,
          totalDepreciation,
          error: `فشل إنشاء القيد المحاسبي للفترة ${periodLabel}`,
        };
      }
    }

    return {
      success: true,
      totalDepreciation: roundCurrency(totalDepreciation),
      error: undefined,
    };
  } catch (error) {
    console.error("runDepreciationForPeriod error:", error);
    return {
      success: false,
      totalDepreciation: 0,
      error: error instanceof Error ? error.message : "خطأ غير متوقع",
    };
  }
}

/**
 * Run depreciation for all pending periods.
 *
 * CRITICAL: Processes periods sequentially in chronological order.
 * If ANY period fails, processing STOPS immediately to maintain accounting integrity.
 *
 * Why sequential?
 * - Each month's depreciation depends on the previous month's ending book value
 * - If Jan fails, Feb's starting values would be wrong
 * - Audit trail requires unbroken chain of records
 */
export async function runAllPendingDepreciation(
  dataOwnerId: string,
  assets: FixedAsset[],
  userId: string,
  userEmail: string
): Promise<AutoDepreciationResult> {
  const pendingPeriods = await getPendingDepreciationPeriods(dataOwnerId, assets);

  if (pendingPeriods.length === 0) {
    return {
      success: true,
      processedPeriods: [],
      totalDepreciation: 0,
      errors: [],
    };
  }

  const processedPeriods: string[] = [];
  let totalDepreciation = 0;

  // CRITICAL: Sequential processing, oldest first
  // Already sorted in getPendingDepreciationPeriods
  for (const period of pendingPeriods) {
    const result = await runDepreciationForPeriod(
      dataOwnerId,
      { year: period.year, month: period.month },
      assets,
      userId,
      userEmail
    );

    if (!result.success) {
      // FAIL-FAST: Stop immediately on any failure
      return {
        success: false,
        processedPeriods,
        totalDepreciation,
        errors: [result.error || `فشل في معالجة ${period.periodLabel}`],
        failedAt: period.periodLabel,
      };
    }

    processedPeriods.push(period.periodLabel);
    totalDepreciation = safeAdd(totalDepreciation, result.totalDepreciation);
  }

  return {
    success: true,
    processedPeriods,
    totalDepreciation: roundCurrency(totalDepreciation),
    errors: [],
  };
}

/**
 * Get summary of depreciation status for display.
 */
export async function getDepreciationStatus(
  dataOwnerId: string,
  assets: FixedAsset[]
): Promise<{
  pendingCount: number;
  pendingPeriods: PendingPeriod[];
  oldestPending: string | null;
  estimatedTotal: number;
}> {
  const pendingPeriods = await getPendingDepreciationPeriods(dataOwnerId, assets);

  const activeAssets = assets.filter((a) => a.status === "active");
  // Use safe math to avoid floating point errors
  const monthlyTotal = activeAssets.reduce(
    (sum, a) => safeAdd(sum, a.monthlyDepreciation),
    0
  );
  const estimatedTotal = monthlyTotal * pendingPeriods.length;

  return {
    pendingCount: pendingPeriods.length,
    pendingPeriods,
    oldestPending: pendingPeriods.length > 0 ? pendingPeriods[0].periodLabel : null,
    estimatedTotal: roundCurrency(estimatedTotal),
  };
}
