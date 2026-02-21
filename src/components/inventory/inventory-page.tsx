"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { exportInventoryToExcelProfessional } from "@/lib/export-inventory-excel";
import { logActivity } from "@/services/activityLogService";
import { safeAdd, safeSubtract, roundCurrency, parseAmount } from "@/lib/currency";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

// Local imports
import { useInventoryData } from "./hooks/useInventoryData";
import { InventoryStatsCards } from "./components/InventoryStatsCards";
import { InventoryItemsTable } from "./components/InventoryItemsTable";
import { MovementHistoryTable } from "./components/MovementHistoryTable";
import { AddEditItemDialog } from "./components/AddEditItemDialog";
import { MovementDialog } from "./components/MovementDialog";
import {
  InventoryItem,
  InventoryFormData,
  MovementFormData,
  INITIAL_FORM_DATA,
  INITIAL_MOVEMENT_DATA,
} from "./types/inventory.types";

export default function InventoryPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { isOwner } = usePermissions();

  // Data from custom hook
  const {
    items,
    movements,
    dataLoading,
    movementsLoading,
    totalCount,
    currentPage,
    setCurrentPage,
    totalPages,
  } = useInventoryData();

  // UI state
  const [activeTab, setActiveTab] = useState("items");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<InventoryFormData>(INITIAL_FORM_DATA);
  const [movementData, setMovementData] = useState<MovementFormData>(INITIAL_MOVEMENT_DATA);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { return; }

    setLoading(true);
    try {
      if (editingItem) {
        const itemRef = doc(firestore, `users/${user.dataOwnerId}/inventory`, editingItem.id);
        await updateDoc(itemRef, {
          itemName: formData.itemName,
          category: formData.category,
          subCategory: formData.subCategory,
          quantity: roundCurrency(parseAmount(formData.quantity)),
          unit: formData.unit,
          unitPrice: roundCurrency(parseAmount(formData.unitPrice)),
          minStock: roundCurrency(parseFloat(formData.minStock)),
          location: formData.location,
          notes: formData.notes,
          thickness: formData.thickness ? parseFloat(formData.thickness) : null,
          width: formData.width ? parseFloat(formData.width) : null,
          length: formData.length ? parseFloat(formData.length) : null,
        });

        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'inventory',
          targetId: editingItem.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `تعديل صنف: ${formData.itemName}`,
          metadata: {
            quantity: parseAmount(formData.quantity),
            unit: formData.unit,
            itemName: formData.itemName,
          },
        });

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات العنصر",
        });
      } else {
        const inventoryRef = collection(firestore, `users/${user.dataOwnerId}/inventory`);
        const docRef = await addDoc(inventoryRef, {
          itemName: formData.itemName,
          category: formData.category,
          subCategory: formData.subCategory,
          quantity: roundCurrency(parseAmount(formData.quantity)),
          unit: formData.unit,
          unitPrice: roundCurrency(parseAmount(formData.unitPrice)),
          minStock: roundCurrency(parseFloat(formData.minStock)),
          location: formData.location,
          notes: formData.notes,
          thickness: formData.thickness ? parseFloat(formData.thickness) : null,
          width: formData.width ? parseFloat(formData.width) : null,
          length: formData.length ? parseFloat(formData.length) : null,
          createdAt: new Date(),
        });

        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'inventory',
          targetId: docRef.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إضافة صنف: ${formData.itemName}`,
          metadata: {
            quantity: parseAmount(formData.quantity),
            unit: formData.unit,
            itemName: formData.itemName,
          },
        });

        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة عنصر جديد للمخزون",
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItem) { return; }

    setLoading(true);
    try {
      const itemRef = doc(firestore, `users/${user.dataOwnerId}/inventory`, selectedItem.id);
      const movementQty = roundCurrency(parseFloat(movementData.quantity));
      const newQuantity = movementData.type === "دخول"
        ? safeAdd(selectedItem.quantity, movementQty)
        : safeSubtract(selectedItem.quantity, movementQty);

      if (newQuantity < 0) {
        toast({
          title: "خطأ",
          description: "الكمية غير كافية في المخزون",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await updateDoc(itemRef, {
        quantity: newQuantity,
      });

      // Log the movement
      const movementsRef = collection(firestore, `users/${user.dataOwnerId}/inventory_movements`);
      await addDoc(movementsRef, {
        itemId: selectedItem.id,
        itemName: selectedItem.itemName,
        type: movementData.type,
        quantity: movementQty,
        unit: selectedItem.unit,
        linkedTransactionId: movementData.linkedTransactionId,
        notes: movementData.notes,
        userEmail: user.email || '',
        createdAt: new Date(),
      });

      // Log activity
      const movementDescription = movementData.type === "دخول"
        ? `إدخال مخزون: ${selectedItem.itemName} - ${movementQty} ${selectedItem.unit}`
        : `إخراج مخزون: ${selectedItem.itemName} - ${movementQty} ${selectedItem.unit}`;

      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'inventory',
        targetId: selectedItem.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: movementDescription,
        metadata: {
          quantity: movementQty,
          unit: selectedItem.unit,
          itemName: selectedItem.itemName,
          movementType: movementData.type,
        },
      });

      toast({
        title: "تمت العملية بنجاح",
        description: `تم تسجيل ${movementData.type} ${movementQty} ${selectedItem.unit}`,
      });

      setIsMovementDialogOpen(false);
      setSelectedItem(null);
      setMovementData(INITIAL_MOVEMENT_DATA);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName || "",
      category: item.category || "",
      subCategory: item.subCategory || "",
      quantity: (item.quantity || 0).toString(),
      unit: item.unit || "",
      unitPrice: (item.unitPrice || 0).toString(),
      minStock: (item.minStock || 0).toString(),
      location: item.location || "",
      notes: item.notes || "",
      thickness: (item.thickness || "").toString(),
      width: (item.width || "").toString(),
      length: (item.length || "").toString(),
    });
    setIsDialogOpen(true);
  };

  const handleMovement = (item: InventoryItem) => {
    setSelectedItem(item);
    setMovementData(INITIAL_MOVEMENT_DATA);
    setIsMovementDialogOpen(true);
  };

  const handleDelete = (itemId: string) => {
    if (!user) { return; }

    const item = items.find((i) => i.id === itemId);

    confirm(
      "حذف العنصر",
      "هل أنت متأكد من حذف هذا العنصر من المخزون؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const itemRef = doc(firestore, `users/${user.dataOwnerId}/inventory`, itemId);
          await deleteDoc(itemRef);

          logActivity(user.dataOwnerId, {
            action: 'delete',
            module: 'inventory',
            targetId: itemId,
            userId: user.uid,
            userEmail: user.email || '',
            description: `حذف صنف: ${item?.itemName || ''}`,
            metadata: {
              quantity: item?.quantity,
              unit: item?.unit,
              itemName: item?.itemName,
            },
          });

          toast({
            title: "تم الحذف",
            description: "تم حذف العنصر من المخزون بنجاح",
          });
        } catch (error) {
          const appError = handleError(error);
          toast({
            title: getErrorTitle(appError),
            description: appError.message,
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  const handleDeleteMovement = (movementId: string) => {
    if (!user) { return; }

    const movement = movements.find((m) => m.id === movementId);

    confirm(
      "حذف الحركة",
      "هل أنت متأكد من حذف هذه الحركة؟ سيتم عكس تأثير الكمية على المخزون.",
      async () => {
        try {
          // If movement has itemId, revert the quantity change
          if (movement?.itemId) {
            const itemRef = doc(firestore, `users/${user.dataOwnerId}/inventory`, movement.itemId);
            const itemSnapshot = await getDoc(itemRef);

            if (itemSnapshot.exists()) {
              const currentQuantity = itemSnapshot.data().quantity || 0;
              const movementQty = movement.quantity || 0;

              // Reverse the movement: if it was IN (دخول), subtract; if OUT (خروج), add
              const newQuantity = movement.type === "دخول"
                ? safeSubtract(currentQuantity, movementQty)  // Reverse IN by subtracting
                : safeAdd(currentQuantity, movementQty);       // Reverse OUT by adding

              // Update inventory item quantity
              await updateDoc(itemRef, {
                quantity: Math.max(0, newQuantity),  // Prevent negative quantity
              });
            }
          }

          // Delete the movement record
          const movementRef = doc(firestore, `users/${user.dataOwnerId}/inventory_movements`, movementId);
          await deleteDoc(movementRef);

          logActivity(user.dataOwnerId, {
            action: 'delete',
            module: 'inventory',
            targetId: movementId,
            userId: user.uid,
            userEmail: user.email || '',
            description: `حذف حركة مخزون: ${movement?.itemName || ''} - ${movement?.type || ''} (تم عكس الكمية)`,
            metadata: {
              quantity: movement?.quantity,
              itemName: movement?.itemName,
              movementType: movement?.type,
            },
          });

          toast({
            title: "تم الحذف",
            description: "تم حذف الحركة وعكس تأثير الكمية على المخزون",
          });
        } catch (error) {
          const appError = handleError(error);
          toast({
            title: getErrorTitle(appError),
            description: appError.message,
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingItem(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المخزون</h1>
          <p className="text-gray-600 mt-2">تتبع حركة المواد (دخول/خروج)</p>
        </div>
        <PermissionGate action="create" module="inventory">
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            إضافة عنصر للمخزون
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <InventoryStatsCards items={items} loading={dataLoading} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="items">المواد ({items.length})</TabsTrigger>
            <TabsTrigger value="movements">سجل الحركات ({movements.length})</TabsTrigger>
          </TabsList>
          {activeTab === "items" && items.length > 0 && (
            <PermissionGate action="export" module="inventory">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportInventoryToExcelProfessional(items)}
              >
                <Download className="w-4 h-4 ml-2" />
                Excel
              </Button>
            </PermissionGate>
          )}
        </div>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <InventoryItemsTable
            items={items}
            loading={dataLoading}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMovement={handleMovement}
          />
        </TabsContent>

        {/* Movement History Tab */}
        <TabsContent value="movements" className="space-y-4">
          <MovementHistoryTable
            movements={movements}
            loading={movementsLoading}
            isOwner={isOwner}
            onDelete={handleDeleteMovement}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddEditItemDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingItem={editingItem}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        loading={loading}
      />

      <MovementDialog
        isOpen={isMovementDialogOpen}
        onOpenChange={setIsMovementDialogOpen}
        selectedItem={selectedItem}
        movementData={movementData}
        setMovementData={setMovementData}
        onSubmit={handleMovementSubmit}
        loading={loading}
      />

      {confirmationDialog}
    </div>
  );
}
