"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

// Types and hooks
import { ProductionOrder, ProductionFormData, initialFormData } from "./types/production";
import { useProductionData } from "./hooks/useProductionData";
import { useProductionOperations } from "./hooks/useProductionOperations";

// Components
import { ProductionStatsCards } from "./components/ProductionStatsCards";
import { ProductionOrdersTable } from "./components/ProductionOrdersTable";
import { ProductionFormDialog } from "./components/ProductionFormDialog";
import { ProductionViewDialog } from "./components/ProductionViewDialog";

export default function ProductionPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { orders, inventoryItems, loading: dataLoading } = useProductionData();
  const { submitOrder, completeOrder, cancelOrder, deleteOrder } = useProductionOperations();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductionFormData>(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
    setIsEditMode(false);
    setEditingOrderId(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (order: ProductionOrder) => {
    setFormData({
      inputItemId: order.inputItemId,
      inputQuantity: order.inputQuantity.toString(),
      outputItemName: order.outputItemName,
      outputQuantity: order.outputQuantity.toString(),
      outputThickness: order.outputThickness?.toString() || "",
      outputWidth: order.outputWidth?.toString() || "",
      outputLength: order.outputLength?.toString() || "",
      productionExpenses: order.productionExpenses.toString(),
      date: order.date instanceof Date
        ? order.date.toISOString().split("T")[0]
        : new Date(order.date).toISOString().split("T")[0],
      notes: order.notes,
    });
    setIsEditMode(true);
    setEditingOrderId(order.id);
    setIsDialogOpen(true);
  };

  const viewOrder = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await submitOrder(
      formData,
      inventoryItems,
      orders,
      isEditMode,
      editingOrderId
    );

    if (success) {
      resetForm();
      setIsDialogOpen(false);
    }
    setLoading(false);
  };

  const handleCompleteOrder = (order: ProductionOrder) => {
    confirm(
      "إكمال أمر الإنتاج",
      "هل أنت متأكد من إكمال أمر الإنتاج؟ سيتم تحديث المخزون تلقائياً.",
      async () => {
        setLoading(true);
        await completeOrder(order);
        setLoading(false);
      },
      "warning"
    );
  };

  const handleCancelOrder = (orderId: string) => {
    confirm(
      "إلغاء أمر الإنتاج",
      "هل أنت متأكد من إلغاء أمر الإنتاج؟",
      async () => {
        await cancelOrder(orderId);
      },
      "warning"
    );
  };

  const handleDeleteOrder = (order: ProductionOrder) => {
    const message = order.status === "مكتمل"
      ? "هل أنت متأكد من حذف أمر الإنتاج؟ سيتم عكس التغييرات على المخزون تلقائياً."
      : "هل أنت متأكد من حذف أمر الإنتاج؟";

    confirm(
      "حذف أمر الإنتاج",
      message,
      async () => {
        setLoading(true);
        await deleteOrder(order);
        setLoading(false);
      },
      "destructive"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة الإنتاج</h1>
          <p className="text-gray-600 mt-2">تحويل المواد الخام إلى منتجات جاهزة</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إنشاء أمر إنتاج
        </Button>
      </div>

      {dataLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <ProductionStatsCards orders={orders} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>أوامر الإنتاج ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <TableSkeleton rows={10} />
          ) : (
            <ProductionOrdersTable
              orders={orders}
              loading={loading}
              onView={viewOrder}
              onEdit={openEditDialog}
              onComplete={handleCompleteOrder}
              onCancel={handleCancelOrder}
              onDelete={handleDeleteOrder}
            />
          )}
        </CardContent>
      </Card>

      <ProductionFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        isEditMode={isEditMode}
        loading={loading}
        formData={formData}
        setFormData={setFormData}
        inventoryItems={inventoryItems}
        onSubmit={handleSubmit}
      />

      <ProductionViewDialog
        isOpen={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        order={selectedOrder}
      />

      {confirmationDialog}
    </div>
  );
}
