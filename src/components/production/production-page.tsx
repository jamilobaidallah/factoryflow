"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, CheckCircle, XCircle, Eye, Pencil, Trash2 } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  writeBatch,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  thickness?: number;
  width?: number;
  length?: number;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  date: Date;
  inputItemId: string;
  inputItemName: string;
  inputQuantity: number;
  inputThickness?: number;
  inputWidth?: number;
  inputLength?: number;
  outputItemName: string;
  outputQuantity: number;
  outputThickness?: number;
  outputWidth?: number;
  outputLength?: number;
  unit: string;
  productionExpenses: number;
  status: "قيد التنفيذ" | "مكتمل" | "ملغي";
  notes: string;
  createdAt: Date;
  completedAt?: Date;
}

// Helper function to generate unique order number
const generateOrderNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `PROD-${year}${month}${day}-${random}`;
};

export default function ProductionPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    inputItemId: "",
    inputQuantity: "",
    outputItemName: "",
    outputQuantity: "",
    outputThickness: "",
    outputWidth: "",
    outputLength: "",
    productionExpenses: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Load inventory items
  useEffect(() => {
    if (!user) {return;}

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    // Limit to 500 inventory items for production dropdown
    const q = query(inventoryRef, orderBy("itemName", "asc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        itemsData.push({
          id: doc.id,
          ...data,
        } as InventoryItem);
      });
      setInventoryItems(itemsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load production orders
  useEffect(() => {
    if (!user) {return;}

    const ordersRef = collection(firestore, `users/${user.uid}/production_orders`);
    // Limit to 500 most recent production orders
    const q = query(ordersRef, orderBy("date", "desc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData: ProductionOrder[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ordersData.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : undefined,
        } as ProductionOrder);
      });
      setOrders(ordersData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      const selectedItem = inventoryItems.find(item => item.id === formData.inputItemId);
      if (!selectedItem) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار مادة خام",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const inputQty = parseFloat(formData.inputQuantity);
      const outputQty = parseFloat(formData.outputQuantity);

      // Validate input quantity (skip for edit mode if already validated)
      if (!isEditMode && inputQty > selectedItem.quantity) {
        toast({
          title: "خطأ في الكمية",
          description: `الكمية المتوفرة في المخزون (${selectedItem.quantity}) غير كافية`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const ordersRef = collection(firestore, `users/${user.uid}/production_orders`);

      if (isEditMode && editingOrderId) {
        // Update existing order
        const originalOrder = orders.find(o => o.id === editingOrderId);
        if (!originalOrder) {
          toast({
            title: "خطأ",
            description: "لم يتم العثور على الأمر",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const batch = writeBatch(firestore);
        const orderRef = doc(firestore, `users/${user.uid}/production_orders`, editingOrderId);

        // If order is completed, reverse old inventory changes and apply new ones
        if (originalOrder.status === "مكتمل") {
          // Step 1: Reverse old inventory changes
          // Add back old input material
          const oldInputItemRef = doc(firestore, `users/${user.uid}/inventory`, originalOrder.inputItemId);
          const oldInputSnapshot = await getDocs(query(
            collection(firestore, `users/${user.uid}/inventory`),
            where("__name__", "==", originalOrder.inputItemId)
          ));

          if (!oldInputSnapshot.empty) {
            const currentQty = oldInputSnapshot.docs[0].data().quantity || 0;
            batch.update(oldInputItemRef, {
              quantity: currentQty + originalOrder.inputQuantity,
            });
          }

          // Deduct old output product
          const oldOutputQuery = query(
            collection(firestore, `users/${user.uid}/inventory`),
            where("itemName", "==", originalOrder.outputItemName)
          );
          const oldOutputSnapshot = await getDocs(oldOutputQuery);

          if (!oldOutputSnapshot.empty) {
            const oldOutputItemRef = doc(firestore, `users/${user.uid}/inventory`, oldOutputSnapshot.docs[0].id);
            const currentQty = oldOutputSnapshot.docs[0].data().quantity || 0;
            const newQty = currentQty - originalOrder.outputQuantity;

            if (newQty <= 0) {
              batch.delete(oldOutputItemRef);
            } else {
              batch.update(oldOutputItemRef, {
                quantity: newQty,
              });
            }
          }

          // Step 2: Apply new inventory changes
          // Deduct new input material
          const newInputItemRef = doc(firestore, `users/${user.uid}/inventory`, selectedItem.id);
          const newInputSnapshot = await getDocs(query(
            collection(firestore, `users/${user.uid}/inventory`),
            where("__name__", "==", selectedItem.id)
          ));

          const newInputUnitCost = newInputSnapshot.empty ? 0 : (newInputSnapshot.docs[0].data().unitPrice || 0);
          const totalMaterialCost = inputQty * newInputUnitCost;
          const totalCost = totalMaterialCost + (formData.productionExpenses ? parseFloat(formData.productionExpenses) : 0);
          const calculatedUnitCost = totalCost / outputQty;

          if (!newInputSnapshot.empty) {
            const currentQty = newInputSnapshot.docs[0].data().quantity || 0;

            // Critical validation: Check if enough inventory available
            if (currentQty < inputQty) {
              toast({
                title: "خطأ في الكمية",
                description: `الكمية المتوفرة في المخزون (${currentQty}) غير كافية للتعديل. المطلوب: ${inputQty}`,
                variant: "destructive",
              });
              setLoading(false);
              return;
            }

            batch.update(newInputItemRef, {
              quantity: currentQty - inputQty,
            });
          }

          // Add new output product
          const newOutputQuery = query(
            collection(firestore, `users/${user.uid}/inventory`),
            where("itemName", "==", formData.outputItemName)
          );
          const newOutputSnapshot = await getDocs(newOutputQuery);

          if (!newOutputSnapshot.empty) {
            const newOutputItemRef = doc(firestore, `users/${user.uid}/inventory`, newOutputSnapshot.docs[0].id);
            const currentQty = newOutputSnapshot.docs[0].data().quantity || 0;
            batch.update(newOutputItemRef, {
              quantity: currentQty + outputQty,
              unitPrice: calculatedUnitCost,
            });
          } else {
            const newOutputRef = doc(collection(firestore, `users/${user.uid}/inventory`));
            batch.set(newOutputRef, {
              itemName: formData.outputItemName,
              category: "منتج جاهز",
              quantity: outputQty,
              unit: selectedItem.unit,
              unitPrice: calculatedUnitCost,
              minStock: 0,
              location: "",
              thickness: formData.outputThickness ? parseFloat(formData.outputThickness) : null,
              width: formData.outputWidth ? parseFloat(formData.outputWidth) : null,
              length: formData.outputLength ? parseFloat(formData.outputLength) : null,
              notes: `تم التحديث من تعديل أمر الإنتاج - تكلفة الوحدة: ${calculatedUnitCost.toFixed(2)} دينار`,
              createdAt: new Date(),
            });
          }

          // Step 3: Log reversal and new movements
          const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);

          // Log reversal movements
          batch.set(doc(movementsRef), {
            itemId: originalOrder.inputItemId,
            itemName: originalOrder.inputItemName,
            type: "دخول",
            quantity: originalOrder.inputQuantity,
            unit: originalOrder.unit,
            linkedTransactionId: originalOrder.orderNumber,
            notes: `عكس تعديل أمر الإنتاج - ${originalOrder.orderNumber}`,
            createdAt: new Date(),
          });

          batch.set(doc(movementsRef), {
            itemId: "",
            itemName: originalOrder.outputItemName,
            type: "خروج",
            quantity: originalOrder.outputQuantity,
            unit: originalOrder.unit,
            linkedTransactionId: originalOrder.orderNumber,
            notes: `عكس تعديل أمر الإنتاج - ${originalOrder.orderNumber}`,
            createdAt: new Date(),
          });

          // Log new movements
          batch.set(doc(movementsRef), {
            itemId: selectedItem.id,
            itemName: selectedItem.itemName,
            type: "خروج",
            quantity: inputQty,
            unit: selectedItem.unit,
            linkedTransactionId: originalOrder.orderNumber,
            notes: `تعديل أمر الإنتاج - ${originalOrder.orderNumber}`,
            createdAt: new Date(),
          });

          batch.set(doc(movementsRef), {
            itemId: "",
            itemName: formData.outputItemName,
            type: "دخول",
            quantity: outputQty,
            unit: selectedItem.unit,
            linkedTransactionId: originalOrder.orderNumber,
            notes: `تعديل أمر الإنتاج - ${originalOrder.orderNumber}`,
            createdAt: new Date(),
          });
        }

        // Update the order document
        batch.update(orderRef, {
          date: new Date(formData.date),
          inputItemId: selectedItem.id,
          inputItemName: selectedItem.itemName,
          inputQuantity: inputQty,
          inputThickness: selectedItem.thickness || null,
          inputWidth: selectedItem.width || null,
          inputLength: selectedItem.length || null,
          outputItemName: formData.outputItemName,
          outputQuantity: outputQty,
          outputThickness: formData.outputThickness ? parseFloat(formData.outputThickness) : null,
          outputWidth: formData.outputWidth ? parseFloat(formData.outputWidth) : null,
          outputLength: formData.outputLength ? parseFloat(formData.outputLength) : null,
          unit: selectedItem.unit,
          productionExpenses: formData.productionExpenses ? parseFloat(formData.productionExpenses) : 0,
          notes: formData.notes,
        });

        await batch.commit();

        toast({
          title: "تم التحديث بنجاح",
          description: originalOrder.status === "مكتمل"
            ? "تم تحديث أمر الإنتاج وتحديث المخزون تلقائياً"
            : "تم تحديث أمر الإنتاج",
        });
      } else {
        // Create new order
        const orderNumber = generateOrderNumber();
        await addDoc(ordersRef, {
          orderNumber: orderNumber,
          date: new Date(formData.date),
          inputItemId: selectedItem.id,
          inputItemName: selectedItem.itemName,
          inputQuantity: inputQty,
          inputThickness: selectedItem.thickness || null,
          inputWidth: selectedItem.width || null,
          inputLength: selectedItem.length || null,
          outputItemName: formData.outputItemName,
          outputQuantity: outputQty,
          outputThickness: formData.outputThickness ? parseFloat(formData.outputThickness) : null,
          outputWidth: formData.outputWidth ? parseFloat(formData.outputWidth) : null,
          outputLength: formData.outputLength ? parseFloat(formData.outputLength) : null,
          unit: selectedItem.unit,
          productionExpenses: formData.productionExpenses ? parseFloat(formData.productionExpenses) : 0,
          status: "قيد التنفيذ",
          notes: formData.notes,
          createdAt: new Date(),
        });

        toast({
          title: "تمت الإضافة بنجاح",
          description: `تم إنشاء أمر الإنتاج ${orderNumber}`,
        });
      }

      resetForm();
      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingOrderId(null);
    } catch (error) {
      toast({
        title: "خطأ",
        description: isEditMode ? "حدث خطأ أثناء تحديث أمر الإنتاج" : "حدث خطأ أثناء إنشاء أمر الإنتاج",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (order: ProductionOrder) => {
    if (!user) {return;}
    if (!confirm("هل أنت متأكد من إكمال أمر الإنتاج؟ سيتم تحديث المخزون تلقائياً.")) {return;}

    setLoading(true);
    try {
      const batch = writeBatch(firestore);

      // 1. Update order status
      const orderRef = doc(firestore, `users/${user.uid}/production_orders`, order.id);
      batch.update(orderRef, {
        status: "مكتمل",
        completedAt: new Date(),
      });

      // 2. Deduct input material from inventory and get unit cost
      const inputItemRef = doc(firestore, `users/${user.uid}/inventory`, order.inputItemId);
      const inputItemSnapshot = await getDocs(query(
        collection(firestore, `users/${user.uid}/inventory`),
        where("__name__", "==", order.inputItemId)
      ));

      // Calculate unit cost for finished product BEFORE updating quantities
      // Material cost + production expenses ÷ output quantity
      const inputUnitCost = inputItemSnapshot.empty ? 0 : (inputItemSnapshot.docs[0].data().unitPrice || 0);
      const totalMaterialCost = order.inputQuantity * inputUnitCost;
      const totalCost = totalMaterialCost + order.productionExpenses;
      const calculatedUnitCost = totalCost / order.outputQuantity;

      if (!inputItemSnapshot.empty) {
        const currentQty = inputItemSnapshot.docs[0].data().quantity || 0;
        batch.update(inputItemRef, {
          quantity: currentQty - order.inputQuantity,
        });
      }

      // 3. Add output product to inventory (or create if doesn't exist)
      const outputQuery = query(
        collection(firestore, `users/${user.uid}/inventory`),
        where("itemName", "==", order.outputItemName)
      );
      const outputSnapshot = await getDocs(outputQuery);

      if (!outputSnapshot.empty) {
        // Output item exists - update quantity
        const outputItemRef = doc(firestore, `users/${user.uid}/inventory`, outputSnapshot.docs[0].id);
        const currentQty = outputSnapshot.docs[0].data().quantity || 0;
        batch.update(outputItemRef, {
          quantity: currentQty + order.outputQuantity,
          unitPrice: calculatedUnitCost, // Update with calculated cost
        });
      } else {
        // Create new output item
        const newOutputRef = doc(collection(firestore, `users/${user.uid}/inventory`));
        batch.set(newOutputRef, {
          itemName: order.outputItemName,
          category: "منتج جاهز",
          quantity: order.outputQuantity,
          unit: order.unit,
          unitPrice: calculatedUnitCost,
          minStock: 0,
          location: "",
          thickness: order.outputThickness || null,
          width: order.outputWidth || null,
          length: order.outputLength || null,
          notes: `تم الإنشاء من أمر الإنتاج ${order.orderNumber} - تكلفة الوحدة: ${calculatedUnitCost.toFixed(2)} دينار`,
          createdAt: new Date(),
        });
      }

      // 4. Log production movements
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);

      // Input movement (exit)
      const inputMovementRef = doc(movementsRef);
      batch.set(inputMovementRef, {
        itemId: order.inputItemId,
        itemName: order.inputItemName,
        type: "خروج",
        quantity: order.inputQuantity,
        unit: order.unit,
        linkedTransactionId: order.orderNumber,
        notes: `استخدام في الإنتاج - ${order.orderNumber}`,
        createdAt: new Date(),
      });

      // Output movement (entry)
      const outputMovementRef = doc(movementsRef);
      batch.set(outputMovementRef, {
        itemId: "",
        itemName: order.outputItemName,
        type: "دخول",
        quantity: order.outputQuantity,
        unit: order.unit,
        thickness: order.outputThickness || null,
        width: order.outputWidth || null,
        length: order.outputLength || null,
        linkedTransactionId: order.orderNumber,
        notes: `إنتاج من أمر ${order.orderNumber}`,
        createdAt: new Date(),
      });

      await batch.commit();

      toast({
        title: "تم إكمال الأمر",
        description: "تم تحديث المخزون بنجاح",
      });
    } catch (error) {
      console.error("Error completing order:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إكمال الأمر",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) {return;}
    if (!confirm("هل أنت متأكد من إلغاء أمر الإنتاج؟")) {return;}

    try {
      const orderRef = doc(firestore, `users/${user.uid}/production_orders`, orderId);
      await updateDoc(orderRef, {
        status: "ملغي",
      });

      toast({
        title: "تم الإلغاء",
        description: "تم إلغاء أمر الإنتاج",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الإلغاء",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string, status: string) => {
    if (!user) {return;}

    const order = orders.find(o => o.id === orderId);
    if (!order) {return;}

    const message = status === "مكتمل"
      ? "هل أنت متأكد من حذف أمر الإنتاج؟ سيتم عكس التغييرات على المخزون تلقائياً."
      : "هل أنت متأكد من حذف أمر الإنتاج؟";

    if (!confirm(message)) {return;}

    setLoading(true);
    try {
      const batch = writeBatch(firestore);

      // If order is completed, reverse inventory changes
      if (status === "مكتمل") {
        // 1. Add back the input material to inventory
        const inputItemRef = doc(firestore, `users/${user.uid}/inventory`, order.inputItemId);
        const inputItemSnapshot = await getDocs(query(
          collection(firestore, `users/${user.uid}/inventory`),
          where("__name__", "==", order.inputItemId)
        ));

        if (!inputItemSnapshot.empty) {
          const currentQty = inputItemSnapshot.docs[0].data().quantity || 0;
          batch.update(inputItemRef, {
            quantity: currentQty + order.inputQuantity, // Add back
          });
        }

        // 2. Deduct the output product from inventory
        const outputQuery = query(
          collection(firestore, `users/${user.uid}/inventory`),
          where("itemName", "==", order.outputItemName)
        );
        const outputSnapshot = await getDocs(outputQuery);

        if (!outputSnapshot.empty) {
          const outputItemRef = doc(firestore, `users/${user.uid}/inventory`, outputSnapshot.docs[0].id);
          const currentQty = outputSnapshot.docs[0].data().quantity || 0;
          const newQty = currentQty - order.outputQuantity;

          if (newQty <= 0) {
            // If quantity becomes zero or negative, delete the item
            batch.delete(outputItemRef);
          } else {
            batch.update(outputItemRef, {
              quantity: newQty,
            });
          }
        }

        // 3. Log reversal movements
        const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);

        // Reversal of input (add back)
        const reversalInputRef = doc(movementsRef);
        batch.set(reversalInputRef, {
          itemId: order.inputItemId,
          itemName: order.inputItemName,
          type: "دخول",
          quantity: order.inputQuantity,
          unit: order.unit,
          linkedTransactionId: order.orderNumber,
          notes: `عكس حذف أمر الإنتاج - ${order.orderNumber}`,
          createdAt: new Date(),
        });

        // Reversal of output (remove)
        const reversalOutputRef = doc(movementsRef);
        batch.set(reversalOutputRef, {
          itemId: "",
          itemName: order.outputItemName,
          type: "خروج",
          quantity: order.outputQuantity,
          unit: order.unit,
          linkedTransactionId: order.orderNumber,
          notes: `عكس حذف أمر الإنتاج - ${order.orderNumber}`,
          createdAt: new Date(),
        });
      }

      // Delete the order
      const orderRef = doc(firestore, `users/${user.uid}/production_orders`, orderId);
      batch.delete(orderRef);

      await batch.commit();

      toast({
        title: "تم الحذف",
        description: status === "مكتمل"
          ? "تم حذف أمر الإنتاج وعكس التغييرات على المخزون"
          : "تم حذف أمر الإنتاج",
      });
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      inputItemId: "",
      inputQuantity: "",
      outputItemName: "",
      outputQuantity: "",
      outputThickness: "",
      outputWidth: "",
      outputLength: "",
      productionExpenses: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const openAddDialog = () => {
    resetForm();
    setIsEditMode(false);
    setEditingOrderId(null);
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
      date: order.date instanceof Date ? order.date.toISOString().split("T")[0] : new Date(order.date).toISOString().split("T")[0],
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

  const selectedInputItem = inventoryItems.find(item => item.id === formData.inputItemId);

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === "مكتمل").length;
  const pendingOrders = orders.filter(o => o.status === "قيد التنفيذ").length;

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>إجمالي الأوامر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {totalOrders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>قيد التنفيذ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {pendingOrders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>المكتملة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {completedOrders}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أوامر الإنتاج ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد أوامر إنتاج. اضغط على &quot;إنشاء أمر إنتاج&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الأمر</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المادة الخام</TableHead>
                  <TableHead>الكمية المستخدمة</TableHead>
                  <TableHead>المنتج النهائي</TableHead>
                  <TableHead>الكمية المنتجة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(order.date).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.inputItemName}</div>
                      {order.inputThickness && (
                        <div className="text-xs text-gray-500">
                          {order.inputThickness}سم × {order.inputWidth || "-"}سم × {order.inputLength || "-"}سم
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.inputQuantity} {order.unit}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.outputItemName}</div>
                      {order.outputThickness && (
                        <div className="text-xs text-gray-500">
                          {order.outputThickness}سم × {order.outputWidth || "-"}سم × {order.outputLength || "-"}سم
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.outputQuantity} {order.unit}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${order.status === "مكتمل"
                            ? "bg-green-100 text-green-700"
                            : order.status === "قيد التنفيذ"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                          }`}
                      >
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewOrder(order)}
                          title="عرض"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {order.status === "قيد التنفيذ" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(order)}
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleCompleteOrder(order)}
                              disabled={loading}
                              title="إكمال"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelOrder(order.id)}
                              title="إلغاء"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}

                        {order.status === "مكتمل" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(order)}
                              title="تعديل (سيتم تحديث المخزون تلقائياً)"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </>
                        )}

                        {order.status !== "قيد التنفيذ" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteOrder(order.id, order.status)}
                            title={order.status === "مكتمل" ? "حذف (سيتم عكس التغييرات على المخزون)" : "حذف"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "تعديل أمر الإنتاج" : "إنشاء أمر إنتاج جديد"}</DialogTitle>
            <DialogDescription>
              قم بتحويل المواد الخام إلى منتجات جاهزة
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="date">التاريخ</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-red-700">📥 المدخلات (المادة الخام)</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inputItemId">المادة الخام</Label>
                    <select
                      id="inputItemId"
                      value={formData.inputItemId}
                      onChange={(e) =>
                        setFormData({ ...formData, inputItemId: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">اختر المادة الخام</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.itemName} - الكمية المتوفرة: {item.quantity} {item.unit}
                          {item.thickness && ` (${item.thickness}سم)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedInputItem && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600">
                        <strong>المادة المختارة:</strong> {selectedInputItem.itemName}
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>الكمية المتوفرة:</strong> {selectedInputItem.quantity} {selectedInputItem.unit}
                      </div>
                      {selectedInputItem.thickness && (
                        <div className="text-sm text-gray-600">
                          <strong>المقاسات:</strong> {selectedInputItem.thickness}سم × {selectedInputItem.width || "-"}سم × {selectedInputItem.length || "-"}سم
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="inputQuantity">الكمية المستخدمة</Label>
                    <Input
                      id="inputQuantity"
                      type="number"
                      step="0.01"
                      value={formData.inputQuantity}
                      onChange={(e) =>
                        setFormData({ ...formData, inputQuantity: e.target.value })
                      }
                      required
                      placeholder="الكمية التي سيتم استخدامها"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-green-700">📤 المخرجات (المنتج النهائي)</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="outputItemName">اسم المنتج النهائي</Label>
                    <Input
                      id="outputItemName"
                      value={formData.outputItemName}
                      onChange={(e) =>
                        setFormData({ ...formData, outputItemName: e.target.value })
                      }
                      required
                      placeholder="مثال: سماحة 4سم"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="outputQuantity">الكمية المنتجة</Label>
                    <Input
                      id="outputQuantity"
                      type="number"
                      step="0.01"
                      value={formData.outputQuantity}
                      onChange={(e) =>
                        setFormData({ ...formData, outputQuantity: e.target.value })
                      }
                      required
                      placeholder="الكمية المتوقعة من المنتج النهائي"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>مقاسات المنتج النهائي (اختياري)</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="outputThickness" className="text-xs">السماكة (سم)</Label>
                        <Input
                          id="outputThickness"
                          type="number"
                          step="0.01"
                          value={formData.outputThickness}
                          onChange={(e) =>
                            setFormData({ ...formData, outputThickness: e.target.value })
                          }
                          placeholder="4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outputWidth" className="text-xs">العرض (سم)</Label>
                        <Input
                          id="outputWidth"
                          type="number"
                          step="0.01"
                          value={formData.outputWidth}
                          onChange={(e) =>
                            setFormData({ ...formData, outputWidth: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outputLength" className="text-xs">الطول (سم)</Label>
                        <Input
                          id="outputLength"
                          type="number"
                          step="0.01"
                          value={formData.outputLength}
                          onChange={(e) =>
                            setFormData({ ...formData, outputLength: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {formData.inputQuantity && formData.outputQuantity && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-700">
                    <strong>نسبة التحويل:</strong> {formData.inputQuantity} {selectedInputItem?.unit} ← {formData.outputQuantity} {selectedInputItem?.unit}
                    {" "}
                    ({(parseFloat(formData.outputQuantity) / parseFloat(formData.inputQuantity)).toFixed(2)}x)
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-purple-700">💰 التكاليف</h3>
                <div className="space-y-2">
                  <Label htmlFor="productionExpenses">مصاريف الإنتاج (دينار)</Label>
                  <Input
                    id="productionExpenses"
                    type="number"
                    step="0.01"
                    value={formData.productionExpenses}
                    onChange={(e) =>
                      setFormData({ ...formData, productionExpenses: e.target.value })
                    }
                    placeholder="مثال: كهرباء، صيانة، إلخ"
                  />
                  <p className="text-xs text-gray-500">
                    سيتم إضافة هذا المبلغ إلى تكلفة المواد الخام لحساب تكلفة الوحدة النهائية
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="ملاحظات إضافية عن عملية الإنتاج"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? (isEditMode ? "جاري التحديث..." : "جاري الإنشاء...")
                  : (isEditMode ? "تحديث أمر الإنتاج" : "إنشاء أمر الإنتاج")
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل أمر الإنتاج</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <strong>رقم الأمر:</strong> {selectedOrder.orderNumber}
              </div>
              <div>
                <strong>التاريخ:</strong> {new Date(selectedOrder.date).toLocaleDateString("ar-EG")}
              </div>
              <div>
                <strong>الحالة:</strong>{" "}
                <span
                  className={`px-2 py-1 rounded-full text-xs ${selectedOrder.status === "مكتمل"
                      ? "bg-green-100 text-green-700"
                      : selectedOrder.status === "قيد التنفيذ"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700"
                    }`}
                >
                  {selectedOrder.status}
                </span>
              </div>
              <div className="border-t pt-3">
                <strong>المدخلات:</strong>
                <div className="ml-4 mt-2">
                  <div>{selectedOrder.inputItemName}</div>
                  <div className="text-sm text-gray-600">
                    الكمية: {selectedOrder.inputQuantity} {selectedOrder.unit}
                  </div>
                  {selectedOrder.inputThickness && (
                    <div className="text-sm text-gray-600">
                      المقاسات: {selectedOrder.inputThickness}سم × {selectedOrder.inputWidth || "-"}سم × {selectedOrder.inputLength || "-"}سم
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t pt-3">
                <strong>المخرجات:</strong>
                <div className="ml-4 mt-2">
                  <div>{selectedOrder.outputItemName}</div>
                  <div className="text-sm text-gray-600">
                    الكمية: {selectedOrder.outputQuantity} {selectedOrder.unit}
                  </div>
                  {selectedOrder.outputThickness && (
                    <div className="text-sm text-gray-600">
                      المقاسات: {selectedOrder.outputThickness}سم × {selectedOrder.outputWidth || "-"}سم × {selectedOrder.outputLength || "-"}سم
                    </div>
                  )}
                </div>
              </div>
              {selectedOrder.productionExpenses > 0 && (
                <div className="border-t pt-3">
                  <strong>مصاريف الإنتاج:</strong>
                  <div className="ml-4 mt-1 text-purple-700 font-semibold">
                    {selectedOrder.productionExpenses.toFixed(2)} دينار
                  </div>
                </div>
              )}
              {selectedOrder.notes && (
                <div className="border-t pt-3">
                  <strong>ملاحظات:</strong>
                  <div className="ml-4 mt-1">{selectedOrder.notes}</div>
                </div>
              )}
              {selectedOrder.completedAt && (
                <div className="border-t pt-3">
                  <strong>تاريخ الإكمال:</strong>
                  <div className="ml-4 mt-1">
                    {new Date(selectedOrder.completedAt).toLocaleString("ar-EG")}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
