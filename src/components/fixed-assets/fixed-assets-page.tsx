"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

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

  // Data and operations hooks
  const { assets, loading: dataLoading } = useFixedAssetsData();
  const { submitAsset, deleteAsset, runDepreciation } = useFixedAssetsOperations();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepreciationDialogOpen, setIsDepreciationDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الأصول الثابتة</h1>
          <p className="text-gray-600 mt-2">إدارة الأصول الثابتة وحساب الاستهلاك</p>
        </div>
        <div className="flex gap-2">
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
