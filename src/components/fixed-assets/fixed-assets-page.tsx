"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, Wrench, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { migrateFixedAssetJournalEntries, cleanupOrphanedJournalEntries } from "@/services/journalService";

// Types and hooks
import {
  FixedAsset,
  FixedAssetFormData,
  DepreciationPeriod,
  initialFormData,
  initialDepreciationPeriod,
} from "./types/fixed-assets";
import { useFixedAssetsData } from "./hooks/useFixedAssetsData";
import { useFixedAssetsOperations } from "./hooks/useFixedAssetsOperations";

// Components
import { FixedAssetsStatsCards } from "./components/FixedAssetsStatsCards";
import { FixedAssetsTable } from "./components/FixedAssetsTable";
import { FixedAssetFormDialog } from "./components/FixedAssetFormDialog";
import { DepreciationDialog } from "./components/DepreciationDialog";

export default function FixedAssetsPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { user } = useUser();
  const { toast } = useToast();

  // Data and operations hooks
  const { assets, loading: dataLoading } = useFixedAssetsData();
  const { submitAsset, deleteAsset, runDepreciation } = useFixedAssetsOperations();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepreciationDialogOpen, setIsDepreciationDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FixedAssetFormData>(initialFormData);
  const [depreciationPeriod, setDepreciationPeriod] = useState<DepreciationPeriod>(initialDepreciationPeriod);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingAsset(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormData({
      assetName: asset.assetName || "",
      category: asset.category || "",
      purchaseDate: asset.purchaseDate
        ? new Date(asset.purchaseDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      purchaseCost: (asset.purchaseCost || 0).toString(),
      salvageValue: (asset.salvageValue || 0).toString(),
      usefulLifeYears: ((asset.usefulLifeMonths || 0) / 12).toString(),
      paymentMethod: "cash", // Default for existing assets (not editable anyway)
      location: asset.location || "",
      serialNumber: asset.serialNumber || "",
      supplier: asset.supplier || "",
      notes: asset.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await submitAsset(formData, editingAsset);

    if (success) {
      resetForm();
      setIsDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDelete = (assetId: string) => {
    confirm(
      "حذف الأصل الثابت",
      "هل أنت متأكد من حذف هذا الأصل الثابت؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteAsset(assetId);
      },
      "destructive"
    );
  };

  const handleRunDepreciation = () => {
    confirm(
      "تسجيل الاستهلاك",
      `هل أنت متأكد من تسجيل استهلاك شهر ${depreciationPeriod.month}/${depreciationPeriod.year}؟`,
      async () => {
        setLoading(true);
        const success = await runDepreciation(depreciationPeriod, assets);
        if (success) {
          setIsDepreciationDialogOpen(false);
        }
        setLoading(false);
      },
      "warning"
    );
  };

  const handleCleanupOrphanedEntries = () => {
    if (!user) return;

    confirm(
      "تنظيف القيود اليتيمة",
      "سيتم البحث عن قيود محاسبية مرتبطة بمعاملات محذوفة وحذفها. هل تريد المتابعة؟",
      async () => {
        setCleaningUp(true);
        try {
          // First do a dry run to see what will be deleted
          const dryRunResult = await cleanupOrphanedJournalEntries(user.dataOwnerId, true);

          if (dryRunResult.success && dryRunResult.data) {
            const { orphanedByTransaction, orphanedByPayment } = dryRunResult.data;
            const totalOrphaned = orphanedByTransaction.length + orphanedByPayment.length;

            if (totalOrphaned === 0) {
              toast({
                title: "لا توجد قيود يتيمة",
                description: "جميع القيود المحاسبية مرتبطة بمعاملات صحيحة.",
              });
              setCleaningUp(false);
              return;
            }

            // Now actually delete them
            const deleteResult = await cleanupOrphanedJournalEntries(user.dataOwnerId, false);

            if (deleteResult.success && deleteResult.data) {
              toast({
                title: "تم التنظيف بنجاح",
                description: `تم حذف ${deleteResult.data.deleted.length} قيد يتيم (${orphanedByTransaction.length} من معاملات محذوفة، ${orphanedByPayment.length} من مدفوعات محذوفة).`,
              });
            } else {
              toast({
                title: "خطأ",
                description: deleteResult.error || "فشل حذف القيود اليتيمة",
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "خطأ",
              description: dryRunResult.error || "فشل البحث عن القيود اليتيمة",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Cleanup failed:", error);
          toast({
            title: "خطأ",
            description: "حدث خطأ أثناء التنظيف",
            variant: "destructive",
          });
        } finally {
          setCleaningUp(false);
        }
      },
      "warning"
    );
  };

  const handleMigrateJournalEntries = () => {
    if (!user) return;

    confirm(
      "تصحيح القيود المحاسبية",
      "سيتم إنشاء قيود تصحيحية للأصول الثابتة التي تم تسجيلها كمصروفات بدلاً من أصول. هل تريد المتابعة؟",
      async () => {
        setMigrating(true);
        try {
          const result = await migrateFixedAssetJournalEntries(user.dataOwnerId);

          if (result.success && result.data) {
            const { corrected, skipped, errors } = result.data;

            if (corrected.length > 0) {
              toast({
                title: "تم التصحيح بنجاح",
                description: `تم تصحيح ${corrected.length} قيد محاسبي. تم تخطي ${skipped.length} قيد (صحيح بالفعل).`,
              });
            } else if (skipped.length > 0) {
              toast({
                title: "لا حاجة للتصحيح",
                description: `جميع القيود صحيحة (${skipped.length} قيد).`,
              });
            } else {
              toast({
                title: "لا توجد قيود للتصحيح",
                description: "لم يتم العثور على أصول ثابتة مرتبطة بقيود محاسبية.",
              });
            }

            if (errors.length > 0) {
              console.error("Migration errors:", errors);
            }
          } else {
            toast({
              title: "خطأ",
              description: result.error || "فشل تصحيح القيود المحاسبية",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Migration failed:", error);
          toast({
            title: "خطأ",
            description: "حدث خطأ أثناء تصحيح القيود",
            variant: "destructive",
          });
        } finally {
          setMigrating(false);
        }
      },
      "warning"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الأصول الثابتة</h1>
          <p className="text-gray-600 mt-2">إدارة الأصول الثابتة وحساب الاستهلاك</p>
        </div>
        <PermissionGate action="create" module="fixed-assets">
          <div className="flex gap-2">
            <Button
              className="gap-2"
              variant="outline"
              size="sm"
              onClick={handleCleanupOrphanedEntries}
              disabled={cleaningUp}
            >
              <Trash2 className="w-4 h-4" />
              {cleaningUp ? "جاري التنظيف..." : "تنظيف القيود اليتيمة"}
            </Button>
            <Button
              className="gap-2"
              variant="outline"
              size="sm"
              onClick={handleMigrateJournalEntries}
              disabled={migrating}
            >
              <Wrench className="w-4 h-4" />
              {migrating ? "جاري التصحيح..." : "تصحيح القيود"}
            </Button>
            <Button
              className="gap-2"
              variant="outline"
              onClick={() => setIsDepreciationDialogOpen(true)}
            >
              <TrendingDown className="w-4 h-4" />
              تسجيل استهلاك شهري
            </Button>
            <Button className="gap-2" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              إضافة أصل ثابت
            </Button>
          </div>
        </PermissionGate>
      </div>

      {dataLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <FixedAssetsStatsCards assets={assets} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>سجل الأصول الثابتة ({assets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <TableSkeleton rows={10} />
          ) : (
            <FixedAssetsTable
              assets={assets}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      <FixedAssetFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingAsset={editingAsset}
        loading={loading}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
      />

      <DepreciationDialog
        isOpen={isDepreciationDialogOpen}
        onClose={() => setIsDepreciationDialogOpen(false)}
        loading={loading}
        period={depreciationPeriod}
        setPeriod={setDepreciationPeriod}
        assets={assets}
        onRunDepreciation={handleRunDepreciation}
      />

      {confirmationDialog}
    </div>
  );
}
