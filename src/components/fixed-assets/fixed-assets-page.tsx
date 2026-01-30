"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingDown, History, AlertTriangle, XCircle } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

// Types and hooks
import {
  FixedAsset,
  FixedAssetFormData,
  DepreciationPeriod,
  DepreciationResult,
  initialFormData,
  initialDepreciationPeriod,
} from "./types/fixed-assets";
import { useFixedAssetsData } from "./hooks/useFixedAssetsData";
import { useFixedAssetsOperations } from "./hooks/useFixedAssetsOperations";
import { useDepreciationHistory } from "./hooks/useDepreciationHistory";

// Components
import { FixedAssetsStatsCards } from "./components/FixedAssetsStatsCards";
import { FixedAssetsTable } from "./components/FixedAssetsTable";
import { FixedAssetFormDialog } from "./components/FixedAssetFormDialog";
import { DepreciationDialog } from "./components/DepreciationDialog";
import { DepreciationHistoryTable } from "./components/DepreciationHistoryTable";

export default function FixedAssetsPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { assets, loading: dataLoading } = useFixedAssetsData();
  const { submitAsset, deleteAsset, runDepreciation } = useFixedAssetsOperations();
  const { runs, loading: historyLoading, getProcessedPeriods } = useDepreciationHistory();

  // UI state
  const [activeTab, setActiveTab] = useState("assets");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepreciationDialogOpen, setIsDepreciationDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(false);

  // Partial failure state - shows persistent alert when journal entry fails
  const [partialFailure, setPartialFailure] = useState<DepreciationResult | null>(null);

  // Form state
  const [formData, setFormData] = useState<FixedAssetFormData>(initialFormData);
  const [depreciationPeriod, setDepreciationPeriod] = useState<DepreciationPeriod>(initialDepreciationPeriod);

  // Get processed periods for dialog
  const processedPeriods = getProcessedPeriods();

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
        const result = await runDepreciation(depreciationPeriod, assets);

        if (result.success) {
          setIsDepreciationDialogOpen(false);
          // Clear any previous partial failure when a new run succeeds
          setPartialFailure(null);
        } else if (result.partialFailure) {
          // Show persistent alert for partial failure
          setPartialFailure(result);
          setIsDepreciationDialogOpen(false);
        }
        // For complete failures (no records saved), keep dialog open

        setLoading(false);
      },
      "warning"
    );
  };

  // Calculate pending months (simple check - months without depreciation)
  const activeAssetsWithoutDepreciation = assets.filter(
    (a) => a.status === "active" && !a.lastDepreciationDate
  );
  const hasPendingDepreciation = activeAssetsWithoutDepreciation.length > 0 && assets.length > 0;

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

      {/* CRITICAL: Partial failure alert - non-dismissible */}
      {partialFailure && partialFailure.partialFailure && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-red-800">
                تحذير: فشل القيد المحاسبي - يتطلب إجراء يدوي
              </h3>
              <p className="text-sm text-red-700 mt-1">
                تم تسجيل الاستهلاك للفترة <strong>{partialFailure.periodLabel}</strong> بمبلغ{" "}
                <strong>{partialFailure.totalDepreciation?.toFixed(2)} دينار</strong>، لكن فشل إنشاء القيد المحاسبي.
              </p>
              <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded font-mono text-sm text-red-900 whitespace-pre-line">
                {partialFailure.recoveryInstructions}
              </div>
              <p className="text-xs text-red-600 mt-2">
                هذا التنبيه لن يختفي حتى يتم إنشاء القيد اليدوي. بعد إنشاء القيد، قم بتحديث الصفحة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending depreciation warning banner */}
      {hasPendingDepreciation && !dataLoading && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              يوجد {activeAssetsWithoutDepreciation.length} أصل لم يتم تسجيل استهلاك له بعد
            </p>
            <p className="text-xs text-amber-600 mt-1">
              يُنصح بتسجيل الاستهلاك الشهري للحفاظ على دقة البيانات المحاسبية
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setIsDepreciationDialogOpen(true)}
          >
            تسجيل الاستهلاك
          </Button>
        </div>
      )}

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="assets" className="gap-2">
            <Plus className="h-4 w-4" />
            الأصول ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            سجل الاستهلاك ({runs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-4">
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
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>سجل الاستهلاك الشهري ({runs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <TableSkeleton rows={10} />
              ) : (
                <DepreciationHistoryTable runs={runs} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
        processedPeriods={processedPeriods}
      />

      {confirmationDialog}
    </div>
  );
}
