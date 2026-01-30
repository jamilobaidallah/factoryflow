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
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import {
  FixedAsset,
  FixedAssetFormData,
  DepreciationPeriod,
  DepreciationResult,
  DEPRECIATION_RECOVERY_INSTRUCTIONS,
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
    assets: FixedAsset[]
  ) => Promise<DepreciationResult>;
}

export function useFixedAssetsOperations(): UseFixedAssetsOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const submitAsset = async (
    formData: FixedAssetFormData,
    editingAsset: FixedAsset | null
  ): Promise<boolean> => {
    if (!user) return false;

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
    if (!user) return false;

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

  const runDepreciation = async (
    period: DepreciationPeriod,
    assets: FixedAsset[]
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

      // Check if depreciation already run for this period
      const runsRef = collection(firestore, `users/${user.dataOwnerId}/depreciation_runs`);
      const runQuery = query(runsRef, where("period", "==", periodLabel));
      const runSnapshot = await getDocs(runQuery);

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

      // Get active assets
      const activeAssets = assets.filter(a => a.status === "active");

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

      let totalDepreciation = 0;
      const transactionId = generateTransactionId();

      // Calculate the last day of the depreciation period
      // This ensures the expense is recorded in the correct accounting period
      const periodEndDate = new Date(period.year, period.month, 0); // Day 0 of next month = last day of this month

      // Process each asset
      for (const asset of activeAssets) {
        // Check if asset is fully depreciated
        const depreciableTotal = safeSubtract(asset.purchaseCost, asset.salvageValue);
        if (asset.accumulatedDepreciation >= depreciableTotal) {
          continue; // Skip fully depreciated assets
        }

        const remainingDepreciable = safeSubtract(depreciableTotal, asset.accumulatedDepreciation);
        const depreciationAmount = Math.min(
          asset.monthlyDepreciation,
          remainingDepreciable
        );

        const newAccumulatedDepreciation = safeAdd(asset.accumulatedDepreciation, depreciationAmount);
        const newBookValue = safeSubtract(asset.purchaseCost, newAccumulatedDepreciation);

        // Create depreciation record
        const recordsRef = collection(firestore, `users/${user.dataOwnerId}/depreciation_records`);
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

      // Create ledger entry for total depreciation
      // Use period end date so the expense appears in the correct accounting period
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
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

      // Log activity for depreciation
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'fixed_assets',
        targetId: periodLabel,
        userId: user.uid,
        userEmail: user.email || '',
        description: `تسجيل إهلاك: ${periodLabel}`,
        metadata: {
          amount: totalDepreciation,
          period: periodLabel,
          assetsCount: activeAssets.length,
        },
      });

      // Create journal entry for depreciation (DR Depreciation Expense, CR Accumulated Depreciation)
      // Use period end date so the journal appears in the correct accounting period
      let journalCreated = true;

      if (totalDepreciation > 0) {
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
            console.error(
              "Depreciation journal entry failed:",
              transactionId,
              journalResult.error
            );
          }
        } catch (err) {
          journalCreated = false;
          console.error("Failed to create depreciation journal entry:", transactionId, err);
        }
      }

      // Return result based on journal entry outcome
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
        // PARTIAL FAILURE: Records saved but journal failed
        // Return partialFailure=true so UI can show persistent recovery alert
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

  return { submitAsset, deleteAsset, runDepreciation };
}
