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
import { FixedAsset, FixedAssetFormData, DepreciationPeriod } from "../types/fixed-assets";
import { parseAmount, safeMultiply, safeSubtract, safeDivide, safeAdd, roundCurrency } from "@/lib/currency";
import { createJournalEntryForDepreciation } from "@/services/journalService";
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
  ) => Promise<boolean>;
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
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const batch = writeBatch(firestore);
      const periodLabel = `${period.year}-${String(period.month).padStart(2, '0')}`;

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
        return false;
      }

      // Get active assets
      const activeAssets = assets.filter(a => a.status === "active");

      if (activeAssets.length === 0) {
        toast({
          title: "لا توجد أصول",
          description: "لا توجد أصول ثابتة نشطة لتسجيل الاستهلاك",
          variant: "destructive",
        });
        return false;
      }

      let totalDepreciation = 0;
      const transactionId = generateTransactionId();

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
        date: new Date(),
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
      let journalCreated = true;

      if (totalDepreciation > 0) {
        try {
          const journalResult = await createJournalEntryForDepreciation(
            user.uid,
            `استهلاك أصول ثابتة - ${periodLabel}`,
            totalDepreciation,
            new Date(),
            transactionId
          );

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

      // Show appropriate toast based on journal entry result
      if (journalCreated) {
        toast({
          title: "تم تسجيل الاستهلاك بنجاح",
          description: `إجمالي الاستهلاك: ${roundCurrency(totalDepreciation).toFixed(2)} دينار`,
        });
      } else {
        toast({
          title: "تحذير",
          description: "تم تسجيل الاستهلاك لكن فشل إنشاء القيد المحاسبي. يرجى مراجعة السجلات أو التواصل مع الدعم.",
          variant: "destructive",
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

  return { submitAsset, deleteAsset, runDepreciation };
}
