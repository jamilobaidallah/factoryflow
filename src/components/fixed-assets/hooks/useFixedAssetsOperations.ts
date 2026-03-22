"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  writeBatch,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import {
  FixedAsset,
  FixedAssetFormData,
  DepreciationPeriod,
  DepreciationResult,
  DepreciationRun,
  DEPRECIATION_RECOVERY_INSTRUCTIONS,
  isBeforePurchaseDate,
} from "../types/fixed-assets";
import { parseAmount, safeMultiply, safeSubtract, safeDivide, safeAdd, roundCurrency } from "@/lib/currency";
import { createJournalPostingEngine } from "@/services/journal";
import { logActivity } from "@/services/activityLogService";

// Helper function to generate unique asset number
const generateAssetNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ASSET-${year}-${random}`;
};

// Helper function to generate transaction ID
const generateTransactionId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `TXN-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
};

interface UseFixedAssetsOperationsReturn {
  submitAsset: (
    formData: FixedAssetFormData,
    editingAsset: FixedAsset | null
  ) => Promise<boolean>;
  deleteAsset: (assetId: string, asset?: FixedAsset) => Promise<boolean>;
  runDepreciation: (
    period: DepreciationPeriod,
    assets: FixedAsset[],
    selectedAsset?: FixedAsset
  ) => Promise<DepreciationResult>;
  deleteDepreciationRun: (run: DepreciationRun) => Promise<{ success: boolean; error?: string }>;
}

export function useFixedAssetsOperations(): UseFixedAssetsOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const submitAsset = async (
    formData: FixedAssetFormData,
    editingAsset: FixedAsset | null
  ): Promise<boolean> => {
    if (!user) {return false;}

    try {
      const purchaseCost = parseAmount(formData.purchaseCost);
      const salvageValue = parseAmount(formData.salvageValue);
      const usefulLifeYears = parseAmount(formData.usefulLifeYears);
      const usefulLifeMonths = safeMultiply(usefulLifeYears, 12);

      // Validation
      if (purchaseCost <= salvageValue) {
        toast({
          title: "خطأ في البيانات",
          description: "تكلفة الشراء يجب أن تكون أكبر من قيمة الخردة",
          variant: "destructive",
        });
        return false;
      }

      // Calculate monthly depreciation (Straight-Line Method)
      const monthlyDepreciation = safeDivide(safeSubtract(purchaseCost, salvageValue), usefulLifeMonths);
      const bookValue = purchaseCost; // Initial book value

      const assetsRef = collection(firestore, `users/${user.dataOwnerId}/fixed_assets`);

      if (editingAsset) {
        const assetRef = doc(firestore, `users/${user.dataOwnerId}/fixed_assets`, editingAsset.id);
        await updateDoc(assetRef, {
          assetName: formData.assetName,
          category: formData.category,
          purchaseDate: new Date(formData.purchaseDate),
          purchaseCost: purchaseCost,
          salvageValue: salvageValue,
          usefulLifeMonths: usefulLifeMonths,
          monthlyDepreciation: monthlyDepreciation,
          location: formData.location,
          serialNumber: formData.serialNumber,
          supplier: formData.supplier,
          notes: formData.notes,
        });

        // Log activity for update
        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'fixed_assets',
          targetId: editingAsset.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `تعديل أصل ثابت: ${formData.assetName}`,
          metadata: {
            purchaseAmount: purchaseCost,
            depreciationRate: monthlyDepreciation,
            assetName: formData.assetName,
            category: formData.category,
          },
        });

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الأصل الثابت",
        });
      } else {
        const assetNumber = generateAssetNumber();
        const docRef = await addDoc(assetsRef, {
          assetNumber: assetNumber,
          assetName: formData.assetName,
          category: formData.category,
          purchaseDate: new Date(formData.purchaseDate),
          purchaseCost: purchaseCost,
          salvageValue: salvageValue,
          usefulLifeMonths: usefulLifeMonths,
          monthlyDepreciation: monthlyDepreciation,
          status: "active",
          accumulatedDepreciation: 0,
          bookValue: bookValue,
          location: formData.location,
          serialNumber: formData.serialNumber,
          supplier: formData.supplier,
          notes: formData.notes,
          createdAt: new Date(),
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'fixed_assets',
          targetId: docRef.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إضافة أصل ثابت: ${formData.assetName} - ${purchaseCost} دينار`,
          metadata: {
            purchaseAmount: purchaseCost,
            depreciationRate: monthlyDepreciation,
            assetName: formData.assetName,
            category: formData.category,
          },
        });

        toast({
          title: "تمت الإضافة بنجاح",
          description: `تم إضافة الأصل الثابت - ${assetNumber}`,
        });
      }

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteAsset = async (assetId: string, asset?: FixedAsset): Promise<boolean> => {
    if (!user) {return false;}

    try {
      const assetRef = doc(firestore, `users/${user.dataOwnerId}/fixed_assets`, assetId);
      await deleteDoc(assetRef);

      // Log activity for delete
      logActivity(user.dataOwnerId, {
        action: 'delete',
        module: 'fixed_assets',
        targetId: assetId,
        userId: user.uid,
        userEmail: user.email || '',
        description: `حذف أصل ثابت: ${asset?.assetName || ''}`,
        metadata: {
          purchaseAmount: asset?.purchaseCost,
          assetName: asset?.assetName,
          category: asset?.category,
        },
      });

      toast({
        title: "تم الحذف",
        description: "تم حذف الأصل الثابت بنجاح",
      });
      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Run depreciation for a period.
   * @param period        The month/year to depreciate.
   * @param assets        All assets (will be filtered to active, non-fully-depreciated).
   * @param selectedAsset Optional — when provided, only this single asset is processed
   *                      (per-asset mode: uses depreciation_records for dedup, skips global run record).
   */
  const runDepreciation = async (
    period: DepreciationPeriod,
    assets: FixedAsset[],
    selectedAsset?: FixedAsset
  ): Promise<DepreciationResult> => {
    const periodLabel = `${period.year}-${String(period.month).padStart(2, "0")}`;

    if (!user) {
      return {
        success: false,
        totalDepreciation: 0,
        partialFailure: false,
        error: "المستخدم غير مسجل الدخول",
        periodLabel,
      };
    }

    try {
      const batch = writeBatch(firestore);
      const runsRef = collection(firestore, `users/${user.dataOwnerId}/depreciation_runs`);
      const recordsRef = collection(firestore, `users/${user.dataOwnerId}/depreciation_records`);

      if (selectedAsset) {
        // ── PER-ASSET MODE ──────────────────────────────────────────────────────
        // Dedup: check depreciation_records for this specific asset + period
        const existingRecordSnap = await getDocs(
          query(
            recordsRef,
            where("assetId", "==", selectedAsset.id),
            where("periodLabel", "==", periodLabel),
            limit(1)
          )
        );
        if (!existingRecordSnap.empty) {
          toast({
            title: "تحذير",
            description: `تم تسجيل استهلاك "${selectedAsset.assetName}" لهذه الفترة مسبقاً`,
            variant: "destructive",
          });
          return {
            success: false,
            totalDepreciation: 0,
            partialFailure: false,
            error: "تم تسجيل الاستهلاك لهذا الأصل في هذه الفترة مسبقاً",
            periodLabel,
          };
        }
      } else {
        // ── GLOBAL MODE ─────────────────────────────────────────────────────────
        // Dedup: check depreciation_runs for this period
        const runSnapshot = await getDocs(
          query(runsRef, where("period", "==", periodLabel))
        );
        if (!runSnapshot.empty) {
          toast({
            title: "تحذير",
            description: "تم تسجيل الاستهلاك لهذه الفترة مسبقاً",
            variant: "destructive",
          });
          return {
            success: false,
            totalDepreciation: 0,
            partialFailure: false,
            error: "تم تسجيل الاستهلاك لهذه الفترة مسبقاً",
            periodLabel,
          };
        }
      }

      // Build active asset list
      let activeAssets = assets.filter(a => a.status === "active");
      if (selectedAsset) {
        activeAssets = activeAssets.filter(a => a.id === selectedAsset.id);
      }

      if (activeAssets.length === 0) {
        toast({
          title: "لا توجد أصول",
          description: "لا توجد أصول ثابتة نشطة لتسجيل الاستهلاك",
          variant: "destructive",
        });
        return {
          success: false,
          totalDepreciation: 0,
          partialFailure: false,
          error: "لا توجد أصول ثابتة نشطة",
          periodLabel,
        };
      }

      // Global mode only: pre-fetch already-processed asset IDs for this period
      // to avoid double-depreciation when per-asset runs happened before a global run.
      const alreadyProcessedAssetIds = new Set<string>();
      if (!selectedAsset) {
        const existingRecordsForPeriod = await getDocs(
          query(recordsRef, where("periodLabel", "==", periodLabel))
        );
        existingRecordsForPeriod.forEach(d => alreadyProcessedAssetIds.add(d.data().assetId));
      }

      let totalDepreciation = 0;
      const transactionId = generateTransactionId();

      // Last day of the depreciation period (for correct accounting period)
      const periodEndDate = new Date(period.year, period.month, 0);

      // Process each asset
      for (const asset of activeAssets) {
        // Bug 2 fix: skip if period is before this asset's purchase date
        if (isBeforePurchaseDate(asset, period)) continue;

        // Skip if already processed via a per-asset run (global mode only)
        if (!selectedAsset && alreadyProcessedAssetIds.has(asset.id)) continue;

        // Skip fully depreciated assets
        const depreciableTotal = safeSubtract(asset.purchaseCost, asset.salvageValue);
        if (asset.accumulatedDepreciation >= depreciableTotal) continue;

        const remainingDepreciable = safeSubtract(depreciableTotal, asset.accumulatedDepreciation);
        const depreciationAmount = Math.min(asset.monthlyDepreciation, remainingDepreciable);

        const newAccumulatedDepreciation = safeAdd(asset.accumulatedDepreciation, depreciationAmount);
        const newBookValue = safeSubtract(asset.purchaseCost, newAccumulatedDepreciation);

        // Create depreciation record
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
        const assetRef = doc(firestore, `users/${user.dataOwnerId}/fixed_assets`, asset.id);
        batch.update(assetRef, {
          accumulatedDepreciation: newAccumulatedDepreciation,
          bookValue: newBookValue,
          lastDepreciationDate: new Date(),
        });

        totalDepreciation = safeAdd(totalDepreciation, depreciationAmount);
      }

      // Guard: nothing to depreciate after filtering
      if (totalDepreciation === 0) {
        toast({
          title: "لا يوجد استهلاك",
          description: selectedAsset
            ? "هذا الأصل مستهلك بالكامل أو لم يُشترَ بعد في هذا التاريخ"
            : "لا توجد أصول مؤهلة للاستهلاك في هذه الفترة",
          variant: "destructive",
        });
        return {
          success: false,
          totalDepreciation: 0,
          partialFailure: false,
          error: "لا يوجد استهلاك للتسجيل",
          periodLabel,
        };
      }

      // Create ledger entry
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const ledgerDocRef = doc(ledgerRef);
      const assetsLabel = selectedAsset
        ? selectedAsset.assetName
        : `${activeAssets.length} أصول ثابتة`;
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
        notes: `استهلاك شهري لـ ${assetsLabel}`,
        autoGenerated: true,
        createdAt: new Date(),
      });

      // Create depreciation_run only for global runs (not per-asset)
      if (!selectedAsset) {
        const runDocRef = doc(runsRef);
        batch.set(runDocRef, {
          period: periodLabel,
          runDate: new Date(),
          assetsCount: activeAssets.length,
          totalDepreciation: totalDepreciation,
          ledgerEntryId: transactionId,
          createdAt: new Date(),
        });
      }

      await batch.commit();

      // Log activity
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'fixed_assets',
        targetId: periodLabel,
        userId: user.uid,
        userEmail: user.email || '',
        description: `تسجيل إهلاك: ${periodLabel}${selectedAsset ? ` - ${selectedAsset.assetName}` : ''}`,
        metadata: {
          amount: totalDepreciation,
          period: periodLabel,
          assetsCount: activeAssets.length,
        },
      });

      // Create journal entry (DR 5400 Depreciation Expense / CR 1510 Accumulated Depreciation)
      let journalCreated = true;
      try {
        const engine = createJournalPostingEngine(user.dataOwnerId);
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
          journalCreated = false;
          console.error("Depreciation journal entry failed:", transactionId, journalResult.error);
        }
      } catch (err) {
        journalCreated = false;
        console.error("Failed to create depreciation journal entry:", transactionId, err);
      }

      if (journalCreated) {
        toast({
          title: "تم تسجيل الاستهلاك بنجاح",
          description: `إجمالي الاستهلاك: ${roundCurrency(totalDepreciation).toFixed(2)} دينار`,
        });
        return {
          success: true,
          totalDepreciation: roundCurrency(totalDepreciation),
          partialFailure: false,
          periodLabel,
        };
      } else {
        toast({
          title: "تحذير: فشل القيد المحاسبي",
          description: "تم تسجيل الاستهلاك لكن فشل إنشاء القيد المحاسبي",
          variant: "destructive",
        });
        return {
          success: false,
          totalDepreciation: roundCurrency(totalDepreciation),
          partialFailure: true,
          recoveryInstructions: DEPRECIATION_RECOVERY_INSTRUCTIONS,
          error: "فشل في إنشاء القيد المحاسبي",
          periodLabel,
        };
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return {
        success: false,
        totalDepreciation: 0,
        partialFailure: false,
        error: appError.message,
        periodLabel,
      };
    }
  };

  /**
   * Delete a depreciation run and all associated data:
   * depreciation_records, fixed_asset value revert, depreciation_run record,
   * ledger entry, and journal entries.
   */
  const deleteDepreciationRun = async (
    run: DepreciationRun
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "المستخدم غير مسجل الدخول" };

    try {
      const batch = writeBatch(firestore);

      const depRecordsRef = collection(firestore, `users/${user.dataOwnerId}/depreciation_records`);
      const depRunsRef    = collection(firestore, `users/${user.dataOwnerId}/depreciation_runs`);
      const ledgerColRef  = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const journalRef    = collection(firestore, `users/${user.dataOwnerId}/journal_entries`);

      // 1. Find all depreciation_records for this run
      const recSnap = await getDocs(
        query(depRecordsRef, where("ledgerEntryId", "==", run.ledgerEntryId))
      );

      // 2. Delete records + accumulate reversal amount per assetId
      const assetReversals = new Map<string, number>();
      recSnap.forEach((d) => {
        batch.delete(d.ref);
        const rec = d.data();
        assetReversals.set(
          rec.assetId as string,
          safeAdd(assetReversals.get(rec.assetId as string) ?? 0, rec.depreciationAmount as number)
        );
      });

      // 3. Revert each affected asset's accumulated depreciation and book value
      for (const [assetId, amountToRevert] of Array.from(assetReversals)) {
        const assetRef  = doc(firestore, `users/${user.dataOwnerId}/fixed_assets`, assetId);
        const assetSnap = await getDoc(assetRef);
        if (assetSnap.exists()) {
          const a = assetSnap.data();
          const newAccum = Math.max(0, safeSubtract((a.accumulatedDepreciation as number) ?? 0, amountToRevert));
          batch.update(assetRef, {
            accumulatedDepreciation: newAccum,
            bookValue: safeSubtract((a.purchaseCost as number) ?? 0, newAccum),
          });
        }
      }

      // 4. Delete the depreciation_run record
      batch.delete(doc(depRunsRef, run.id));

      // 5. Delete the linked ledger entry (may already be absent — handled gracefully)
      const ledgerSnap = await getDocs(
        query(ledgerColRef, where("transactionId", "==", run.ledgerEntryId), limit(1))
      );
      ledgerSnap.forEach((d) => batch.delete(d.ref));

      // 6. Delete linked journal entries (depreciation run creates 1-2 journals)
      const journalSnap = await getDocs(
        query(journalRef, where("linkedTransactionId", "==", run.ledgerEntryId), limit(10))
      );
      journalSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit();

      toast({
        title: "تم الحذف",
        description: "تم حذف سجل الاستهلاك وعكس القيم على الأصول",
      });
      return { success: true };
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return { success: false, error: appError.message };
    }
  };

  return { submitAsset, deleteAsset, runDepreciation, deleteDepreciationRun };
}
