"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { ProductionOrder, ProductionFormData, InventoryItem } from "../types/production";
import { generateOrderNumber } from "../utils/production-helpers";
import { parseAmount, safeMultiply, safeAdd, safeSubtract, safeDivide, roundCurrency } from "@/lib/currency";

interface UseProductionOperationsReturn {
  submitOrder: (
    formData: ProductionFormData,
    inventoryItems: InventoryItem[],
    orders: ProductionOrder[],
    isEditMode: boolean,
    editingOrderId: string | null
  ) => Promise<boolean>;
  completeOrder: (order: ProductionOrder) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  deleteOrder: (order: ProductionOrder) => Promise<boolean>;
}

export function useProductionOperations(): UseProductionOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const submitOrder = async (
    formData: ProductionFormData,
    inventoryItems: InventoryItem[],
    orders: ProductionOrder[],
    isEditMode: boolean,
    editingOrderId: string | null
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const selectedItem = inventoryItems.find(item => item.id === formData.inputItemId);
      if (!selectedItem) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار مادة خام",
          variant: "destructive",
        });
        return false;
      }

      const inputQty = parseAmount(formData.inputQuantity);
      const outputQty = parseAmount(formData.outputQuantity);

      // Validate input quantity (skip for edit mode if already validated)
      if (!isEditMode && inputQty > selectedItem.quantity) {
        toast({
          title: "خطأ في الكمية",
          description: `الكمية المتوفرة في المخزون (${selectedItem.quantity}) غير كافية`,
          variant: "destructive",
        });
        return false;
      }

      const ordersRef = collection(firestore, `users/${user.uid}/production_orders`);

      if (isEditMode && editingOrderId) {
        const originalOrder = orders.find(o => o.id === editingOrderId);
        if (!originalOrder) {
          toast({
            title: "خطأ",
            description: "لم يتم العثور على الأمر",
            variant: "destructive",
          });
          return false;
        }

        const batch = writeBatch(firestore);
        const orderRef = doc(firestore, `users/${user.uid}/production_orders`, editingOrderId);

        // If order is completed, reverse old inventory changes and apply new ones
        if (originalOrder.status === "مكتمل") {
          // Step 1: Reverse old inventory changes
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
          const newInputItemRef = doc(firestore, `users/${user.uid}/inventory`, selectedItem.id);
          const newInputSnapshot = await getDocs(query(
            collection(firestore, `users/${user.uid}/inventory`),
            where("__name__", "==", selectedItem.id)
          ));

          const newInputUnitCost = newInputSnapshot.empty ? 0 : (newInputSnapshot.docs[0].data().unitPrice || 0);
          const totalMaterialCost = safeMultiply(inputQty, newInputUnitCost);
          const totalCost = safeAdd(totalMaterialCost, formData.productionExpenses ? parseAmount(formData.productionExpenses) : 0);
          const calculatedUnitCost = safeDivide(totalCost, outputQty);

          if (!newInputSnapshot.empty) {
            const currentQty = newInputSnapshot.docs[0].data().quantity || 0;

            if (currentQty < inputQty) {
              toast({
                title: "خطأ في الكمية",
                description: `الكمية المتوفرة في المخزون (${currentQty}) غير كافية للتعديل. المطلوب: ${inputQty}`,
                variant: "destructive",
              });
              return false;
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
              thickness: formData.outputThickness ? parseAmount(formData.outputThickness) : null,
              width: formData.outputWidth ? parseAmount(formData.outputWidth) : null,
              length: formData.outputLength ? parseAmount(formData.outputLength) : null,
              notes: `تم التحديث من تعديل أمر الإنتاج - تكلفة الوحدة: ${roundCurrency(calculatedUnitCost).toFixed(2)} دينار`,
              createdAt: new Date(),
            });
          }

          // Log movements
          const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);

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
          outputThickness: formData.outputThickness ? parseAmount(formData.outputThickness) : null,
          outputWidth: formData.outputWidth ? parseAmount(formData.outputWidth) : null,
          outputLength: formData.outputLength ? parseAmount(formData.outputLength) : null,
          unit: selectedItem.unit,
          productionExpenses: formData.productionExpenses ? parseAmount(formData.productionExpenses) : 0,
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
          outputThickness: formData.outputThickness ? parseAmount(formData.outputThickness) : null,
          outputWidth: formData.outputWidth ? parseAmount(formData.outputWidth) : null,
          outputLength: formData.outputLength ? parseAmount(formData.outputLength) : null,
          unit: selectedItem.unit,
          productionExpenses: formData.productionExpenses ? parseAmount(formData.productionExpenses) : 0,
          status: "قيد التنفيذ",
          notes: formData.notes,
          createdAt: new Date(),
        });

        toast({
          title: "تمت الإضافة بنجاح",
          description: `تم إنشاء أمر الإنتاج ${orderNumber}`,
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

  const completeOrder = async (order: ProductionOrder): Promise<boolean> => {
    if (!user) return false;

    try {
      const batch = writeBatch(firestore);

      // Update order status
      const orderRef = doc(firestore, `users/${user.uid}/production_orders`, order.id);
      batch.update(orderRef, {
        status: "مكتمل",
        completedAt: new Date(),
      });

      // Deduct input material and get unit cost
      const inputItemRef = doc(firestore, `users/${user.uid}/inventory`, order.inputItemId);
      const inputItemSnapshot = await getDocs(query(
        collection(firestore, `users/${user.uid}/inventory`),
        where("__name__", "==", order.inputItemId)
      ));

      const inputUnitCost = inputItemSnapshot.empty ? 0 : (inputItemSnapshot.docs[0].data().unitPrice || 0);
      const totalMaterialCost = safeMultiply(order.inputQuantity, inputUnitCost);
      const totalCost = safeAdd(totalMaterialCost, order.productionExpenses);
      const calculatedUnitCost = safeDivide(totalCost, order.outputQuantity);

      if (!inputItemSnapshot.empty) {
        const currentQty = inputItemSnapshot.docs[0].data().quantity || 0;
        batch.update(inputItemRef, {
          quantity: currentQty - order.inputQuantity,
        });
      }

      // Add output product to inventory
      const outputQuery = query(
        collection(firestore, `users/${user.uid}/inventory`),
        where("itemName", "==", order.outputItemName)
      );
      const outputSnapshot = await getDocs(outputQuery);

      if (!outputSnapshot.empty) {
        const outputItemRef = doc(firestore, `users/${user.uid}/inventory`, outputSnapshot.docs[0].id);
        const currentQty = outputSnapshot.docs[0].data().quantity || 0;
        batch.update(outputItemRef, {
          quantity: currentQty + order.outputQuantity,
          unitPrice: calculatedUnitCost,
        });
      } else {
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
          notes: `تم الإنشاء من أمر الإنتاج ${order.orderNumber} - تكلفة الوحدة: ${roundCurrency(calculatedUnitCost).toFixed(2)} دينار`,
          createdAt: new Date(),
        });
      }

      // Log movements
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);

      batch.set(doc(movementsRef), {
        itemId: order.inputItemId,
        itemName: order.inputItemName,
        type: "خروج",
        quantity: order.inputQuantity,
        unit: order.unit,
        linkedTransactionId: order.orderNumber,
        notes: `استخدام في الإنتاج - ${order.orderNumber}`,
        createdAt: new Date(),
      });

      batch.set(doc(movementsRef), {
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

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const orderRef = doc(firestore, `users/${user.uid}/production_orders`, orderId);
      await updateDoc(orderRef, {
        status: "ملغي",
      });

      toast({
        title: "تم الإلغاء",
        description: "تم إلغاء أمر الإنتاج",
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

  const deleteOrder = async (order: ProductionOrder): Promise<boolean> => {
    if (!user) return false;

    try {
      const batch = writeBatch(firestore);

      // If order is completed, reverse inventory changes
      if (order.status === "مكتمل") {
        const inputItemRef = doc(firestore, `users/${user.uid}/inventory`, order.inputItemId);
        const inputItemSnapshot = await getDocs(query(
          collection(firestore, `users/${user.uid}/inventory`),
          where("__name__", "==", order.inputItemId)
        ));

        if (!inputItemSnapshot.empty) {
          const currentQty = inputItemSnapshot.docs[0].data().quantity || 0;
          batch.update(inputItemRef, {
            quantity: currentQty + order.inputQuantity,
          });
        }

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
            batch.delete(outputItemRef);
          } else {
            batch.update(outputItemRef, {
              quantity: newQty,
            });
          }
        }

        // Log reversal movements
        const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);

        batch.set(doc(movementsRef), {
          itemId: order.inputItemId,
          itemName: order.inputItemName,
          type: "دخول",
          quantity: order.inputQuantity,
          unit: order.unit,
          linkedTransactionId: order.orderNumber,
          notes: `عكس حذف أمر الإنتاج - ${order.orderNumber}`,
          createdAt: new Date(),
        });

        batch.set(doc(movementsRef), {
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
      const orderRef = doc(firestore, `users/${user.uid}/production_orders`, order.id);
      batch.delete(orderRef);

      await batch.commit();

      toast({
        title: "تم الحذف",
        description: order.status === "مكتمل"
          ? "تم حذف أمر الإنتاج وعكس التغييرات على المخزون"
          : "تم حذف أمر الإنتاج",
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

  return { submitOrder, completeOrder, cancelOrder, deleteOrder };
}
