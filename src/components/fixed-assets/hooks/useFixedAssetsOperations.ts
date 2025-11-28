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
  deleteAsset: (assetId: string) => Promise<boolean>;
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
      const purchaseCost = parseFloat(formData.purchaseCost);
      const salvageValue = parseFloat(formData.salvageValue);
      const usefulLifeYears = parseFloat(formData.usefulLifeYears);
      const usefulLifeMonths = usefulLifeYears * 12;

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
      const monthlyDepreciation = (purchaseCost - salvageValue) / usefulLifeMonths;
      const bookValue = purchaseCost; // Initial book value

      const assetsRef = collection(firestore, `users/${user.uid}/fixed_assets`);

      if (editingAsset) {
        const assetRef = doc(firestore, `users/${user.uid}/fixed_assets`, editingAsset.id);
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
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الأصل الثابت",
        });
      } else {
        const assetNumber = generateAssetNumber();
        await addDoc(assetsRef, {
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

  const deleteAsset = async (assetId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const assetRef = doc(firestore, `users/${user.uid}/fixed_assets`, assetId);
      await deleteDoc(assetRef);
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
      const runsRef = collection(firestore, `users/${user.uid}/depreciation_runs`);
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
        if (asset.accumulatedDepreciation >= (asset.purchaseCost - asset.salvageValue)) {
          continue; // Skip fully depreciated assets
        }

        const depreciationAmount = Math.min(
          asset.monthlyDepreciation,
          (asset.purchaseCost - asset.salvageValue) - asset.accumulatedDepreciation
        );

        const newAccumulatedDepreciation = asset.accumulatedDepreciation + depreciationAmount;
        const newBookValue = asset.purchaseCost - newAccumulatedDepreciation;

        // Create depreciation record
        const recordsRef = collection(firestore, `users/${user.uid}/depreciation_records`);
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
        const assetRef = doc(firestore, `users/${user.uid}/fixed_assets`, asset.id);
        batch.update(assetRef, {
          accumulatedDepreciation: newAccumulatedDepreciation,
          bookValue: newBookValue,
          lastDepreciationDate: new Date(),
        });

        totalDepreciation += depreciationAmount;
      }

      // Create ledger entry for total depreciation
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
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

      toast({
        title: "تم تسجيل الاستهلاك بنجاح",
        description: `إجمالي الاستهلاك: ${totalDepreciation.toFixed(2)} دينار`,
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

  return { submitAsset, deleteAsset, runDepreciation };
}
