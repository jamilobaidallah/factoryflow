"use client";

import { useState } from "react";
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
import { Plus, Edit, Trash2, FolderOpen, DollarSign } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  where,
  getDocs,
} from "firebase/firestore";
import { firestore, storage } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Import extracted utilities and hooks
import { LedgerEntry, CATEGORIES } from "./utils/ledger-constants";
import { getCategoryType, generateTransactionId } from "./utils/ledger-helpers";
import { useLedgerData } from "./hooks/useLedgerData";

// Interfaces and constants are now imported from utils

export default function LedgerPage() {
  const { user } = useUser();
  const { toast } = useToast();

  // Use custom hook for data fetching
  const { entries, clients, partners } = useLedgerData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [loading, setLoading] = useState(false);

  // Related records management
  const [isRelatedDialogOpen, setIsRelatedDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [relatedTab, setRelatedTab] = useState<"payments" | "cheques" | "inventory">("payments");

  // Quick payment dialog
  const [isQuickPayDialogOpen, setIsQuickPayDialogOpen] = useState(false);
  const [quickPayEntry, setQuickPayEntry] = useState<LedgerEntry | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState("");

  // Form states for adding related records
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    notes: "",
  });

  const [chequeFormData, setChequeFormData] = useState({
    chequeNumber: "",
    amount: "",
    bankName: "",
    dueDate: new Date().toISOString().split("T")[0],
    status: "قيد الانتظار",
    chequeType: "عادي",
    chequeImage: null as File | null,
  });

  const [inventoryFormData, setInventoryFormData] = useState({
    itemName: "",
    quantity: "",
    unit: "",
    thickness: "",
    width: "",
    length: "",
    notes: "",
  });

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "",
    subCategory: "",
    associatedParty: "",
    ownerName: "",  // For capital transactions
    date: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
    immediateSettlement: false,
    trackARAP: false,  // Track Accounts Receivable/Payable
  });

  // New unified entry states
  const [hasIncomingCheck, setHasIncomingCheck] = useState(false);
  const [hasInventoryUpdate, setHasInventoryUpdate] = useState(false);
  const [hasFixedAsset, setHasFixedAsset] = useState(false);
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");

  const [checkFormData, setCheckFormData] = useState({
    chequeNumber: "",
    chequeAmount: "",
    bankName: "",
    dueDate: new Date().toISOString().split("T")[0],
  });

  const [inventoryFormDataNew, setInventoryFormDataNew] = useState({
    itemName: "",
    quantity: "",
    unit: "",
    thickness: "",
    width: "",
    length: "",
    shippingCost: "",
    otherCosts: "",
  });

  const [fixedAssetFormData, setFixedAssetFormData] = useState({
    assetName: "",
    usefulLifeYears: "",
    salvageValue: "",
  });

  // Calculate current entry type based on selected category for UI rendering
  const currentEntryType = getCategoryType(formData.category, formData.subCategory);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    // Auto-determine type from category (with special handling for owner withdrawals)
    const entryType = getCategoryType(formData.category, formData.subCategory);

    setLoading(true);
    try {
      if (editingEntry) {
        const entryRef = doc(firestore, `users/${user.uid}/ledger`, editingEntry.id);
        await updateDoc(entryRef, {
          description: formData.description,
          type: entryType,
          amount: parseFloat(formData.amount),
          category: formData.category,
          subCategory: formData.subCategory,
          associatedParty: formData.associatedParty,
          ownerName: formData.ownerName || "",  // Include owner for capital transactions
          date: new Date(formData.date),
          reference: formData.reference,
          notes: formData.notes,
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث الحركة المالية",
        });
      } else {
        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        const transactionId = generateTransactionId();

        // Validate amounts if check is included
        if (hasIncomingCheck && formData.immediateSettlement) {
          const totalAmount = parseFloat(formData.amount);
          const checkAmount = parseFloat(checkFormData.chequeAmount);
          if (checkAmount > totalAmount) {
            toast({
              title: "خطأ في المبلغ",
              description: "مبلغ الشيك لا يمكن أن يكون أكبر من المبلغ الإجمالي",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }

        // Validate initial payment amount
        if (hasInitialPayment && initialPaymentAmount) {
          const totalAmount = parseFloat(formData.amount);
          const paymentAmt = parseFloat(initialPaymentAmount);
          if (paymentAmt > totalAmount) {
            toast({
              title: "خطأ في المبلغ",
              description: "مبلغ الدفعة الأولية لا يمكن أن يكون أكبر من المبلغ الإجمالي",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          if (paymentAmt <= 0) {
            toast({
              title: "خطأ في المبلغ",
              description: "يرجى إدخال مبلغ صحيح للدفعة الأولية",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }

        // Use batch for atomic operations when check, inventory, fixed asset, or initial payment is included
        if (hasIncomingCheck || hasInventoryUpdate || hasFixedAsset || hasInitialPayment) {
          const batch = writeBatch(firestore);

          // 1. Add ledger entry
          const ledgerDocRef = doc(ledgerRef);
          const totalAmount = parseFloat(formData.amount);

          // Calculate initial payment status for AR/AP tracking
          let initialPaid = 0;
          let initialStatus: "paid" | "unpaid" | "partial" = "unpaid";

          if (formData.trackARAP) {
            // If immediate settlement, calculate what's paid
            if (formData.immediateSettlement) {
              const cashAmount = hasIncomingCheck
                ? totalAmount - parseFloat(checkFormData.chequeAmount || "0")
                : totalAmount;
              initialPaid = cashAmount;
              initialStatus = cashAmount >= totalAmount ? "paid" : "partial";
            } else if (hasInitialPayment && initialPaymentAmount) {
              // Initial partial payment
              initialPaid = parseFloat(initialPaymentAmount);
              initialStatus = initialPaid >= totalAmount ? "paid" : "partial";
            }
          } else if (formData.immediateSettlement) {
            // Legacy behavior: immediate settlement = fully paid
            initialPaid = totalAmount;
            initialStatus = "paid";
          }

          batch.set(ledgerDocRef, {
            transactionId: transactionId,
            description: formData.description,
            type: entryType,
            amount: totalAmount,
            category: formData.category,
            subCategory: formData.subCategory,
            associatedParty: formData.associatedParty,
            ownerName: formData.ownerName || "",  // Include owner for capital transactions
            date: new Date(formData.date),
            reference: formData.reference,
            notes: formData.notes,
            createdAt: new Date(),
            // AR/AP tracking fields
            ...(formData.trackARAP && {
              isARAPEntry: true,
              totalPaid: initialPaid,
              remainingBalance: totalAmount - initialPaid,
              paymentStatus: initialStatus,
            }),
          });

          // 2. Add incoming check if selected
          if (hasIncomingCheck) {
            const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
            const chequeDocRef = doc(chequesRef);
            batch.set(chequeDocRef, {
              chequeNumber: checkFormData.chequeNumber,
              clientName: formData.associatedParty || "غير محدد",
              amount: parseFloat(checkFormData.chequeAmount),
              type: "وارد",
              chequeType: "عادي",
              status: "قيد الانتظار",
              linkedTransactionId: transactionId,
              issueDate: new Date(formData.date),
              dueDate: new Date(checkFormData.dueDate),
              bankName: checkFormData.bankName,
              notes: `مرتبط بالمعاملة: ${formData.description}`,
              createdAt: new Date(),
            });

            // Create payment record for the check (no cash movement)
            const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
            const paymentDocRef = doc(paymentsRef);
            batch.set(paymentDocRef, {
              clientName: formData.associatedParty || "غير محدد",
              amount: parseFloat(checkFormData.chequeAmount),
              type: entryType === "دخل" ? "قبض" : "صرف",
              linkedTransactionId: transactionId,
              date: new Date(formData.date),
              notes: `شيك ${entryType === "دخل" ? "وارد" : "صادر"} - ${formData.description}`,
              createdAt: new Date(),
              noCashMovement: true,
            });
          }

          // 3. Add cash payment if immediate settlement is checked
          if (formData.immediateSettlement) {
            const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
            const paymentDocRef = doc(paymentsRef);
            const cashAmount = hasIncomingCheck
              ? parseFloat(formData.amount) - parseFloat(checkFormData.chequeAmount)
              : parseFloat(formData.amount);

            if (cashAmount > 0) {
              batch.set(paymentDocRef, {
                clientName: formData.associatedParty || "غير محدد",
                amount: cashAmount,
                type: entryType === "دخل" ? "قبض" : "صرف",
                linkedTransactionId: transactionId,
                date: new Date(formData.date),
                notes: `تسوية فورية نقدية - ${formData.description}`,
                category: formData.category,
                subCategory: formData.subCategory,
                createdAt: new Date(),
              });
            }
          }

          // 3b. Add initial partial payment if checked (for AR/AP tracking)
          if (hasInitialPayment && initialPaymentAmount && formData.trackARAP) {
            const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
            const paymentDocRef = doc(paymentsRef);
            const paymentAmt = parseFloat(initialPaymentAmount);

            if (paymentAmt > 0) {
              batch.set(paymentDocRef, {
                clientName: formData.associatedParty || "غير محدد",
                amount: paymentAmt,
                type: entryType === "دخل" ? "قبض" : "صرف",
                linkedTransactionId: transactionId,
                date: new Date(formData.date),
                notes: `دفعة أولية - ${formData.description}`,
                category: formData.category,
                subCategory: formData.subCategory,
                createdAt: new Date(),
              });
            }
          }

          // 4. Add inventory movement if selected
          if (hasInventoryUpdate) {
            // IMPORTANT: When you buy materials (expense), inventory INCREASES (دخول)
            // When you sell products (income), inventory DECREASES (خروج)
            const movementType = entryType === "مصروف" ? "دخول" : "خروج";
            const quantityChange = parseFloat(inventoryFormDataNew.quantity);

            // First, check if inventory item exists
            const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
            const itemQuery = query(inventoryRef, where("itemName", "==", inventoryFormDataNew.itemName));
            const itemSnapshot = await getDocs(itemQuery);

            let itemId = "";

            if (!itemSnapshot.empty) {
              // Item exists - update quantity
              const existingItem = itemSnapshot.docs[0];
              itemId = existingItem.id;
              const currentQuantity = existingItem.data().quantity || 0;
              const currentUnitPrice = existingItem.data().unitPrice || 0;
              const newQuantity = movementType === "دخول"
                ? currentQuantity + quantityChange
                : currentQuantity - quantityChange;

              // Validate we don't go negative
              if (newQuantity < 0) {
                toast({
                  title: "خطأ في المخزون",
                  description: `الكمية المتوفرة في المخزون (${currentQuantity}) غير كافية لإجراء عملية خروج بكمية ${quantityChange}`,
                  variant: "destructive",
                });
                setLoading(false);
                return;
              }

              const itemDocRef = doc(firestore, `users/${user.uid}/inventory`, itemId);

              // CRITICAL ACCOUNTING: Calculate weighted average cost when adding inventory
              if (movementType === "دخول" && formData.amount) {
                // Calculate new unit price from purchase amount
                const purchaseUnitPrice = parseFloat(formData.amount) / quantityChange;

                // Weighted Average Cost formula:
                // New Unit Price = (Old Quantity × Old Price + New Quantity × New Price) / Total Quantity
                const oldValue = currentQuantity * currentUnitPrice;
                const newValue = quantityChange * purchaseUnitPrice;
                const weightedAvgPrice = parseFloat(((oldValue + newValue) / newQuantity).toFixed(2));

                batch.update(itemDocRef, {
                  quantity: newQuantity,
                  unitPrice: weightedAvgPrice,
                  lastPurchasePrice: parseFloat(purchaseUnitPrice.toFixed(2)),
                  lastPurchaseDate: new Date(),
                  lastPurchaseAmount: formData.amount,
                });
              } else {
                // Just update quantity (for sales or when no purchase amount)
                batch.update(itemDocRef, {
                  quantity: newQuantity,
                });
              }
            } else {
              // Item doesn't exist - create it
              if (movementType === "خروج") {
                toast({
                  title: "خطأ في المخزون",
                  description: `الصنف "${inventoryFormDataNew.itemName}" غير موجود في المخزون. لا يمكن إجراء عملية خروج`,
                  variant: "destructive",
                });
                setLoading(false);
                return;
              }

              // Calculate landed cost (purchase amount + shipping + other costs)
              const shippingCost = inventoryFormDataNew.shippingCost ? parseFloat(inventoryFormDataNew.shippingCost) : 0;
              const otherCosts = inventoryFormDataNew.otherCosts ? parseFloat(inventoryFormDataNew.otherCosts) : 0;
              const purchaseAmount = formData.amount ? parseFloat(formData.amount) : 0;
              const totalLandedCost = purchaseAmount + shippingCost + otherCosts;

              // Calculate unit price from total landed cost and round to 2 decimals
              const calculatedUnitPrice = totalLandedCost > 0 ? parseFloat((totalLandedCost / quantityChange).toFixed(2)) : 0;

              const newItemRef = doc(inventoryRef);
              itemId = newItemRef.id;
              batch.set(newItemRef, {
                itemName: inventoryFormDataNew.itemName,
                category: formData.category || "غير مصنف",
                quantity: quantityChange,
                unit: inventoryFormDataNew.unit,
                unitPrice: calculatedUnitPrice,
                thickness: inventoryFormDataNew.thickness ? parseFloat(inventoryFormDataNew.thickness) : null,
                width: inventoryFormDataNew.width ? parseFloat(inventoryFormDataNew.width) : null,
                length: inventoryFormDataNew.length ? parseFloat(inventoryFormDataNew.length) : null,
                minStock: 0,
                location: "",
                notes: `تم الإنشاء تلقائياً من المعاملة: ${formData.description}`,
                createdAt: new Date(),
                lastPurchasePrice: calculatedUnitPrice,
                lastPurchaseDate: new Date(),
                lastPurchaseAmount: totalLandedCost,
              });
            }

            // Add movement record
            const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
            const movementDocRef = doc(movementsRef);
            batch.set(movementDocRef, {
              itemId: itemId,
              itemName: inventoryFormDataNew.itemName,
              type: movementType,
              quantity: quantityChange,
              unit: inventoryFormDataNew.unit,
              thickness: inventoryFormDataNew.thickness ? parseFloat(inventoryFormDataNew.thickness) : null,
              width: inventoryFormDataNew.width ? parseFloat(inventoryFormDataNew.width) : null,
              length: inventoryFormDataNew.length ? parseFloat(inventoryFormDataNew.length) : null,
              linkedTransactionId: transactionId,
              notes: `مرتبط بالمعاملة: ${formData.description}`,
              createdAt: new Date(),
            });

            // CRITICAL ACCOUNTING: Auto-record COGS when selling (إيراد + خروج)
            if (entryType === "إيراد" && movementType === "خروج" && !itemSnapshot.empty) {
              const existingItem = itemSnapshot.docs[0];
              const unitCost = existingItem.data().unitPrice || 0;
              const cogsAmount = quantityChange * unitCost;

              // Create automatic COGS ledger entry
              const cogsDocRef = doc(ledgerRef);
              batch.set(cogsDocRef, {
                transactionId: `COGS-${transactionId}`,
                description: `تكلفة البضاعة المباعة - ${inventoryFormDataNew.itemName}`,
                type: "مصروف",
                amount: cogsAmount,
                category: "تكلفة البضاعة المباعة (COGS)",
                subCategory: "مبيعات",
                date: new Date(formData.date),
                linkedTransactionId: transactionId,
                autoGenerated: true,
                notes: `حساب تلقائي: ${quantityChange} × ${unitCost.toFixed(2)} = ${cogsAmount.toFixed(2)} دينار`,
                createdAt: new Date(),
              });
            }
          }

          // 5. Add fixed asset if selected
          if (hasFixedAsset) {
            const fixedAssetsRef = collection(firestore, `users/${user.uid}/fixed_assets`);
            const assetDocRef = doc(fixedAssetsRef);

            // Generate asset number
            const now = new Date();
            const year = now.getFullYear();
            const assetsSnapshot = await getDocs(fixedAssetsRef);
            const assetNumber = `ASSET-${year}-${String(assetsSnapshot.size + 1).padStart(4, '0')}`;

            // Calculate depreciation
            const purchaseCost = parseFloat(formData.amount);
            const salvageValue = parseFloat(fixedAssetFormData.salvageValue);
            const usefulLifeMonths = parseFloat(fixedAssetFormData.usefulLifeYears) * 12;
            const monthlyDepreciation = (purchaseCost - salvageValue) / usefulLifeMonths;

            batch.set(assetDocRef, {
              assetNumber: assetNumber,
              assetName: fixedAssetFormData.assetName,
              category: formData.subCategory || "غير محدد",
              purchaseDate: new Date(formData.date),
              purchaseCost: purchaseCost,
              salvageValue: salvageValue,
              linkedPurchaseTransactionId: transactionId,
              depreciationMethod: "straight-line",
              usefulLifeMonths: usefulLifeMonths,
              monthlyDepreciation: monthlyDepreciation,
              status: "active",
              accumulatedDepreciation: 0,
              bookValue: purchaseCost,
              supplier: formData.associatedParty || "",
              notes: formData.notes || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Commit batch
          await batch.commit();

          // Build success message
          const successParts = ["حركة مالية"];
          if (hasIncomingCheck) {successParts.push(entryType === "دخل" ? "شيك وارد" : "شيك صادر");}
          if (hasInventoryUpdate) {successParts.push("حركة مخزون");}
          if (hasFixedAsset) {successParts.push("أصل ثابت");}
          if (formData.immediateSettlement) {successParts.push("تسوية فورية");}

          toast({
            title: "تمت الإضافة بنجاح",
            description: `تم إضافة: ${successParts.join(" + ")} - رقم المعاملة: ${transactionId}`,
          });
        } else {
          // Original simple add without batch
          const totalAmount = parseFloat(formData.amount);

          // Calculate initial payment status for AR/AP tracking
          let initialPaid = 0;
          let initialStatus: "paid" | "unpaid" | "partial" = "unpaid";

          if (formData.trackARAP) {
            if (formData.immediateSettlement) {
              initialPaid = totalAmount;
              initialStatus = "paid";
            }
          } else if (formData.immediateSettlement) {
            initialPaid = totalAmount;
            initialStatus = "paid";
          }

          await addDoc(ledgerRef, {
            transactionId: transactionId,
            description: formData.description,
            type: entryType,
            amount: totalAmount,
            category: formData.category,
            subCategory: formData.subCategory,
            associatedParty: formData.associatedParty,
            ownerName: formData.ownerName || "",  // Include owner for capital transactions
            date: new Date(formData.date),
            reference: formData.reference,
            notes: formData.notes,
            createdAt: new Date(),
            // AR/AP tracking fields
            ...(formData.trackARAP && {
              isARAPEntry: true,
              totalPaid: initialPaid,
              remainingBalance: totalAmount - initialPaid,
              paymentStatus: initialStatus,
            }),
          });

          // If immediate settlement is checked, create payment record
          if (formData.immediateSettlement) {
            const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
            const paymentType = entryType === "دخل" ? "قبض" : "صرف";
            await addDoc(paymentsRef, {
              clientName: formData.associatedParty || "غير محدد",
              amount: parseFloat(formData.amount),
              type: paymentType,
              linkedTransactionId: transactionId,
              date: new Date(formData.date),
              notes: `تسوية فورية - ${formData.description}`,
              category: formData.category || null,
              subCategory: formData.subCategory || null,
              createdAt: new Date(),
            });
          }

          toast({
            title: "تمت الإضافة بنجاح",
            description: formData.immediateSettlement
              ? `تم إضافة حركة مالية وتسوية فورية - رقم المعاملة: ${transactionId}`
              : `تم إضافة حركة مالية جديدة - رقم المعاملة: ${transactionId}`,
          });
        }
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving ledger entry:", error);
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setFormData({
      description: entry.description || "",
      amount: (entry.amount || 0).toString(),
      category: entry.category || "",
      subCategory: entry.subCategory || "",
      associatedParty: entry.associatedParty || "",
      ownerName: (entry as any).ownerName || "",  // Load owner for capital transactions
      date: entry.date ? new Date(entry.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      reference: entry.reference || "",
      notes: entry.notes || "",
      immediateSettlement: false,
      trackARAP: false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entryId: string) => {
    if (!user) {return;}
    if (!confirm("هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف جميع السجلات المرتبطة (مدفوعات، شيكات، حركات مخزون).")) {return;}

    try {
      // Get the entry to find its transactionId
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على الحركة",
          variant: "destructive",
        });
        return;
      }

      const batch = writeBatch(firestore);

      // 1. Delete the ledger entry
      const entryRef = doc(firestore, `users/${user.uid}/ledger`, entryId);
      batch.delete(entryRef);

      // 2. Delete related payments
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentsQuery = query(paymentsRef, where("linkedTransactionId", "==", entry.transactionId));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. Delete related cheques
      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
      const chequesQuery = query(chequesRef, where("linkedTransactionId", "==", entry.transactionId));
      const chequesSnapshot = await getDocs(chequesQuery);
      chequesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 4. Delete related inventory movements
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
      const movementsQuery = query(movementsRef, where("linkedTransactionId", "==", entry.transactionId));
      const movementsSnapshot = await getDocs(movementsQuery);
      movementsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 5. Delete auto-generated COGS entries
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const cogsQuery = query(ledgerRef, where("transactionId", "==", `COGS-${entry.transactionId}`));
      const cogsSnapshot = await getDocs(cogsQuery);
      cogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Commit all deletions
      await batch.commit();

      const deletedCount = paymentsSnapshot.size + chequesSnapshot.size + movementsSnapshot.size + cogsSnapshot.size;
      toast({
        title: "تم الحذف",
        description: deletedCount > 0
          ? `تم حذف الحركة المالية و ${deletedCount} سجل مرتبط`
          : "تم حذف الحركة المالية بنجاح",
      });
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      category: "",
      subCategory: "",
      associatedParty: "",
      ownerName: "",  // Reset owner name
      date: new Date().toISOString().split("T")[0],
      reference: "",
      notes: "",
      immediateSettlement: false,
      trackARAP: false,
    });
    setEditingEntry(null);
    setHasIncomingCheck(false);
    setHasInventoryUpdate(false);
    setHasFixedAsset(false);
    setHasInitialPayment(false);
    setInitialPaymentAmount("");
    setCheckFormData({
      chequeNumber: "",
      chequeAmount: "",
      bankName: "",
      dueDate: new Date().toISOString().split("T")[0],
    });
    setInventoryFormDataNew({
      itemName: "",
      quantity: "",
      unit: "",
      thickness: "",
      width: "",
      length: "",
      shippingCost: "",
      otherCosts: "",
    });
    setFixedAssetFormData({
      assetName: "",
      usefulLifeYears: "",
      salvageValue: "",
    });
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openRelatedDialog = (entry: LedgerEntry) => {
    setSelectedEntry(entry);
    setIsRelatedDialogOpen(true);
  };

  const openQuickPayDialog = (entry: LedgerEntry) => {
    setQuickPayEntry(entry);
    setQuickPayAmount("");
    setIsQuickPayDialogOpen(true);
  };

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickPayEntry) {return;}

    const paymentAmount = parseFloat(quickPayAmount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
        variant: "destructive",
      });
      return;
    }

    // Validate payment amount
    if (quickPayEntry.remainingBalance !== undefined && paymentAmount > quickPayEntry.remainingBalance) {
      toast({
        title: "خطأ في المبلغ",
        description: `المبلغ المتبقي هو ${quickPayEntry.remainingBalance.toFixed(2)} دينار فقط`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const paymentType = quickPayEntry.type === "دخل" ? "قبض" : "صرف";

      // Add payment record
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      await addDoc(paymentsRef, {
        clientName: quickPayEntry.associatedParty || "غير محدد",
        amount: paymentAmount,
        type: paymentType,
        linkedTransactionId: quickPayEntry.transactionId,
        date: new Date(),
        notes: `دفعة جزئية - ${quickPayEntry.description}`,
        category: quickPayEntry.category,
        subCategory: quickPayEntry.subCategory,
        createdAt: new Date(),
      });

      // Update ledger entry AR/AP tracking
      const newTotalPaid = (quickPayEntry.totalPaid || 0) + paymentAmount;
      const newRemainingBalance = quickPayEntry.amount - newTotalPaid;
      const newStatus = newRemainingBalance === 0 ? "paid" : newRemainingBalance < quickPayEntry.amount ? "partial" : "unpaid";

      const ledgerEntryRef = doc(firestore, `users/${user.uid}/ledger`, quickPayEntry.id);
      await updateDoc(ledgerEntryRef, {
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        paymentStatus: newStatus,
      });

      toast({
        title: "تمت الإضافة بنجاح",
        description: `تم إضافة دفعة بمبلغ ${paymentAmount.toFixed(2)} دينار`,
      });

      setIsQuickPayDialogOpen(false);
      setQuickPayAmount("");
      setQuickPayEntry(null);
    } catch (error) {
      console.error("Error adding quick payment:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الدفعة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEntry) {return;}

    setLoading(true);
    try {
      const paymentAmount = parseFloat(paymentFormData.amount);

      // Validate payment amount
      if (selectedEntry.isARAPEntry && selectedEntry.remainingBalance !== undefined) {
        if (paymentAmount > selectedEntry.remainingBalance) {
          toast({
            title: "خطأ في المبلغ",
            description: `المبلغ المتبقي هو ${selectedEntry.remainingBalance.toFixed(2)} دينار فقط`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentType = selectedEntry.type === "دخل" ? "قبض" : "صرف";

      await addDoc(paymentsRef, {
        clientName: selectedEntry.associatedParty || "غير محدد",
        amount: paymentAmount,
        type: paymentType,
        linkedTransactionId: selectedEntry.transactionId,
        date: new Date(),
        notes: paymentFormData.notes,
        createdAt: new Date(),
      });

      // Update ledger entry AR/AP tracking if enabled
      if (selectedEntry.isARAPEntry) {
        const newTotalPaid = (selectedEntry.totalPaid || 0) + paymentAmount;
        const newRemainingBalance = selectedEntry.amount - newTotalPaid;
        let newStatus: "paid" | "unpaid" | "partial" = "unpaid";

        if (newRemainingBalance <= 0) {
          newStatus = "paid";
        } else if (newTotalPaid > 0) {
          newStatus = "partial";
        }

        const ledgerEntryRef = doc(firestore, `users/${user.uid}/ledger`, selectedEntry.id);
        await updateDoc(ledgerEntryRef, {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          paymentStatus: newStatus,
        });
      }

      toast({
        title: "تمت الإضافة بنجاح",
        description: selectedEntry.isARAPEntry
          ? `تم إضافة الدفعة وتحديث الرصيد المتبقي`
          : "تم إضافة الدفعة المرتبطة بالمعاملة",
      });
      setPaymentFormData({ amount: "", notes: "" });
      setIsRelatedDialogOpen(false); // Close dialog to show updated ledger
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الدفعة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEntry) {return;}

    setLoading(true);
    try {
      let chequeImageUrl = "";

      // Upload cheque image if provided
      if (chequeFormData.chequeImage) {
        const imageRef = ref(
          storage,
          `users/${user.uid}/cheques/${Date.now()}_${chequeFormData.chequeImage.name}`
        );
        await uploadBytes(imageRef, chequeFormData.chequeImage);
        chequeImageUrl = await getDownloadURL(imageRef);
      }

      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
      const chequeDirection = selectedEntry.type === "دخل" ? "وارد" : "صادر";
      const chequeAmount = parseFloat(chequeFormData.amount);

      await addDoc(chequesRef, {
        chequeNumber: chequeFormData.chequeNumber,
        clientName: selectedEntry.associatedParty || "غير محدد",
        amount: chequeAmount,
        type: chequeDirection,
        chequeType: chequeFormData.chequeType,
        status: chequeFormData.status,
        chequeImageUrl: chequeImageUrl,
        linkedTransactionId: selectedEntry.transactionId,
        issueDate: new Date(),
        dueDate: new Date(chequeFormData.dueDate),
        bankName: chequeFormData.bankName,
        notes: `مرتبط بالمعاملة: ${selectedEntry.description}`,
        createdAt: new Date(),
      });

      // Update AR/AP tracking if enabled for this transaction
      if (selectedEntry.isARAPEntry && selectedEntry.remainingBalance !== undefined) {
        // Validate cheque amount
        if (chequeAmount > selectedEntry.remainingBalance) {
          toast({
            title: "تحذير",
            description: `المبلغ المتبقي هو ${selectedEntry.remainingBalance.toFixed(2)} دينار فقط`,
            variant: "destructive",
          });
        } else {
          const newTotalPaid = (selectedEntry.totalPaid || 0) + chequeAmount;
          const newRemainingBalance = selectedEntry.amount - newTotalPaid;
          let newStatus: "paid" | "unpaid" | "partial" = "unpaid";

          if (newRemainingBalance <= 0) {
            newStatus = "paid";
          } else if (newTotalPaid > 0) {
            newStatus = "partial";
          }

          const ledgerEntryRef = doc(firestore, `users/${user.uid}/ledger`, selectedEntry.id);
          await updateDoc(ledgerEntryRef, {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          });
        }
      }

      toast({
        title: "تمت الإضافة بنجاح",
        description: selectedEntry.isARAPEntry
          ? "تم إضافة الشيك وتحديث الرصيد المتبقي"
          : "تم إضافة الشيك المرتبط بالمعاملة",
      });
      setChequeFormData({
        chequeNumber: "",
        amount: "",
        bankName: "",
        dueDate: new Date().toISOString().split("T")[0],
        status: "قيد الانتظار",
        chequeType: "عادي",
        chequeImage: null,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الشيك",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEntry) {return;}

    setLoading(true);
    try {
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
      const movementType = selectedEntry.type === "مصروف" ? "خروج" : "دخول";
      await addDoc(movementsRef, {
        itemId: "",
        itemName: inventoryFormData.itemName,
        type: movementType,
        quantity: parseFloat(inventoryFormData.quantity),
        unit: inventoryFormData.unit,
        thickness: inventoryFormData.thickness ? parseFloat(inventoryFormData.thickness) : null,
        width: inventoryFormData.width ? parseFloat(inventoryFormData.width) : null,
        length: inventoryFormData.length ? parseFloat(inventoryFormData.length) : null,
        linkedTransactionId: selectedEntry.transactionId,
        notes: inventoryFormData.notes || `مرتبط بالمعاملة: ${selectedEntry.description}`,
        createdAt: new Date(),
      });
      toast({
        title: "تمت الإضافة بنجاح",
        description: "تم إضافة حركة المخزون المرتبطة بالمعاملة",
      });
      setInventoryFormData({
        itemName: "",
        quantity: "",
        unit: "",
        thickness: "",
        width: "",
        length: "",
        notes: ""
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة حركة المخزون",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = entries
    .filter((e) => e.type === "دخل")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalExpenses = entries
    .filter((e) => e.type === "مصروف")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">دفتر الأستاذ</h1>
          <p className="text-gray-600 mt-2">تسجيل جميع الحركات المالية</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة حركة مالية
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>إجمالي الدخل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {totalIncome.toFixed(2)} دينار
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>إجمالي المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {totalExpenses.toFixed(2)} دينار
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الرصيد الصافي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${netBalance >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {netBalance.toFixed(2)} دينار
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الحركات المالية ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد حركات مالية مسجلة. اضغط على &quot;إضافة حركة مالية&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم المعاملة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>الفئة الفرعية</TableHead>
                  <TableHead>الطرف المعني</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>حالة الدفع</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.transactionId ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {entry.transactionId}
                          </span>
                          <CopyButton text={entry.transactionId} size="sm" />
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(entry.date).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.description}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${entry.type === "دخل"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                          }`}
                      >
                        {entry.type}
                      </span>
                    </TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell>{entry.subCategory}</TableCell>
                    <TableCell>{entry.associatedParty || "-"}</TableCell>
                    <TableCell>{entry.amount || 0} دينار</TableCell>
                    <TableCell>
                      {entry.isARAPEntry ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${entry.paymentStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : entry.paymentStatus === "partial"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                                }`}
                            >
                              {entry.paymentStatus === "paid"
                                ? "مدفوع"
                                : entry.paymentStatus === "partial"
                                  ? "دفعة جزئية"
                                  : "غير مدفوع"}
                            </span>
                          </div>
                          {entry.paymentStatus !== "paid" && (
                            <div className="text-xs text-gray-600">
                              متبقي: {entry.remainingBalance?.toFixed(2)} دينار
                            </div>
                          )}
                          {entry.totalPaid && entry.totalPaid > 0 && (
                            <div className="text-xs text-gray-500">
                              مدفوع: {entry.totalPaid.toFixed(2)} دينار
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {entry.isARAPEntry && entry.paymentStatus !== "paid" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openQuickPayDialog(entry)}
                            title="إضافة دفعة"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openRelatedDialog(entry)}
                          title="إدارة السجلات المرتبطة"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "تعديل الحركة المالية" : "إضافة حركة مالية جديدة"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "قم بتعديل بيانات الحركة أدناه"
                : "أدخل بيانات الحركة المالية الجديدة أدناه"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">التصنيف الرئيسي</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, subCategory: "" })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">اختر التصنيف</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subCategory">الفئة الفرعية</Label>
                  <select
                    id="subCategory"
                    value={formData.subCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subCategory: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                    disabled={!formData.category}
                  >
                    <option value="">اختر الفئة الفرعية</option>
                    {formData.category && CATEGORIES
                      .find(cat => cat.name === formData.category)
                      ?.subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="associatedParty">الطرف المعني (العميل/المورد)</Label>
                <Input
                  id="associatedParty"
                  list="clients-list"
                  value={formData.associatedParty}
                  onChange={(e) =>
                    setFormData({ ...formData, associatedParty: e.target.value })
                  }
                  placeholder="اختر من القائمة أو اكتب اسم جديد"
                />
                <datalist id="clients-list">
                  {clients.map((client) => (
                    <option key={client.id} value={client.name} />
                  ))}
                </datalist>
              </div>

              {/* Show owner dropdown only for capital transactions */}
              {formData.category === "رأس المال" && (
                <div className="space-y-2">
                  <Label htmlFor="ownerName">اسم الشريك/المالك *</Label>
                  <select
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerName: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">اختر الشريك</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.name}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                  {partners.length === 0 && (
                    <p className="text-sm text-orange-600">
                      ⚠ لم يتم إضافة شركاء بعد. يرجى إضافة شريك من صفحة &quot;الشركاء&quot; أولاً.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ (دينار)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                  />
                </div>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">المرجع</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData({ ...formData, reference: e.target.value })
                  }
                  placeholder="رقم الفاتورة أو المرجع"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
              {!editingEntry && (
                <>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id="trackARAP"
                      checked={formData.trackARAP}
                      onChange={(e) =>
                        setFormData({ ...formData, trackARAP: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="trackARAP" className="cursor-pointer font-normal">
                      📊 تتبع الذمم (حسابات القبض/الدفع)
                    </Label>
                  </div>

                  {/* Initial Payment Option - Only for AR/AP tracking */}
                  {formData.trackARAP && !formData.immediateSettlement && (
                    <>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id="hasInitialPayment"
                          checked={hasInitialPayment}
                          onChange={(e) => setHasInitialPayment(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="hasInitialPayment" className="cursor-pointer font-normal">
                          💰 إضافة دفعة أولية
                        </Label>
                      </div>

                      {hasInitialPayment && (
                        <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
                          <h4 className="font-semibold text-sm text-green-900">
                            بيانات الدفعة الأولية
                          </h4>
                          <div className="space-y-2">
                            <Label htmlFor="initialPaymentAmount">المبلغ المدفوع</Label>
                            <Input
                              id="initialPaymentAmount"
                              type="number"
                              step="0.01"
                              placeholder="أدخل المبلغ"
                              value={initialPaymentAmount}
                              onChange={(e) => setInitialPaymentAmount(e.target.value)}
                              required={hasInitialPayment}
                            />
                            {formData.amount && initialPaymentAmount && (
                              <p className="text-xs text-gray-600">
                                المتبقي: {(parseFloat(formData.amount) - parseFloat(initialPaymentAmount)).toFixed(2)} دينار
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id="immediateSettlement"
                      checked={formData.immediateSettlement}
                      onChange={(e) =>
                        setFormData({ ...formData, immediateSettlement: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="immediateSettlement" className="cursor-pointer font-normal">
                      تسوية فورية (إضافة تلقائية للمدفوعات)
                    </Label>
                  </div>

                  {/* New: Add Incoming/Outgoing Check */}
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id="hasIncomingCheck"
                      checked={hasIncomingCheck}
                      onChange={(e) => setHasIncomingCheck(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="hasIncomingCheck" className="cursor-pointer font-normal">
                      ☑️ إضافة شيك {currentEntryType === "دخل" ? "وارد" : "صادر"}
                    </Label>
                  </div>

                  {/* Check Fields - Collapsible */}
                  {hasIncomingCheck && (
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-blue-900">
                        بيانات الشيك {currentEntryType === "دخل" ? "الوارد" : "الصادر"}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="chequeNumber">رقم الشيك</Label>
                          <Input
                            id="chequeNumber"
                            value={checkFormData.chequeNumber}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, chequeNumber: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chequeAmount">مبلغ الشيك (دينار)</Label>
                          <Input
                            id="chequeAmount"
                            type="number"
                            step="0.01"
                            value={checkFormData.chequeAmount}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, chequeAmount: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bankName">اسم البنك</Label>
                          <Input
                            id="bankName"
                            value={checkFormData.bankName}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, bankName: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chequeDueDate">تاريخ الاستحقاق</Label>
                          <Input
                            id="chequeDueDate"
                            type="date"
                            value={checkFormData.dueDate}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, dueDate: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                        </div>
                      </div>
                      {formData.immediateSettlement && (
                        <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
                          💡 المبلغ النقدي: {(parseFloat(formData.amount || "0") - parseFloat(checkFormData.chequeAmount || "0")).toFixed(2)} دينار
                        </div>
                      )}
                    </div>
                  )}

                  {/* New: Add Inventory Update */}
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id="hasInventoryUpdate"
                      checked={hasInventoryUpdate}
                      onChange={(e) => setHasInventoryUpdate(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="hasInventoryUpdate" className="cursor-pointer font-normal">
                      ☑️ تحديث المخزون
                    </Label>
                  </div>

                  {/* Inventory Fields - Collapsible */}
                  {hasInventoryUpdate && (
                    <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-green-900">بيانات المخزون</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="itemName">اسم الصنف</Label>
                          <Input
                            id="itemName"
                            value={inventoryFormDataNew.itemName}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, itemName: e.target.value })
                            }
                            required={hasInventoryUpdate}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quantity">الكمية</Label>
                          <Input
                            id="quantity"
                            type="number"
                            step="0.01"
                            value={inventoryFormDataNew.quantity}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, quantity: e.target.value })
                            }
                            required={hasInventoryUpdate}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">الوحدة</Label>
                        <select
                          id="unit"
                          value={inventoryFormDataNew.unit}
                          onChange={(e) =>
                            setInventoryFormDataNew({ ...inventoryFormDataNew, unit: e.target.value })
                          }
                          required={hasInventoryUpdate}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">اختر الوحدة</option>
                          <option value="م">م (متر)</option>
                          <option value="م²">م² (متر مربع)</option>
                          <option value="قطعة">قطعة</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="thickness" className="text-xs">السماكة (اختياري)</Label>
                          <Input
                            id="thickness"
                            type="number"
                            step="0.01"
                            value={inventoryFormDataNew.thickness}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, thickness: e.target.value })
                            }
                            placeholder="سم"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="width" className="text-xs">العرض (اختياري)</Label>
                          <Input
                            id="width"
                            type="number"
                            step="0.01"
                            value={inventoryFormDataNew.width}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, width: e.target.value })
                            }
                            placeholder="سم"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="length" className="text-xs">الطول (اختياري)</Label>
                          <Input
                            id="length"
                            type="number"
                            step="0.01"
                            value={inventoryFormDataNew.length}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, length: e.target.value })
                            }
                            placeholder="سم"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="shippingCost" className="text-xs">شحن ونقل (اختياري)</Label>
                          <Input
                            id="shippingCost"
                            type="number"
                            step="0.01"
                            value={inventoryFormDataNew.shippingCost}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, shippingCost: e.target.value })
                            }
                            placeholder="د.أ"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="otherCosts" className="text-xs">تكاليف أخرى (اختياري)</Label>
                          <Input
                            id="otherCosts"
                            type="number"
                            step="0.01"
                            value={inventoryFormDataNew.otherCosts}
                            onChange={(e) =>
                              setInventoryFormDataNew({ ...inventoryFormDataNew, otherCosts: e.target.value })
                            }
                            placeholder="د.أ"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* New: Add Fixed Asset - Only show if category is "أصول ثابتة" */}
                  {formData.category === "أصول ثابتة" && (
                    <>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id="hasFixedAsset"
                          checked={hasFixedAsset}
                          onChange={(e) => setHasFixedAsset(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="hasFixedAsset" className="cursor-pointer font-normal">
                          🏢 إضافة إلى سجل الأصول الثابتة
                        </Label>
                      </div>

                      {/* Fixed Asset Fields - Collapsible */}
                      {hasFixedAsset && (
                        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
                          <h4 className="font-semibold text-sm text-purple-900">بيانات الأصل الثابت</h4>
                          <div className="space-y-2">
                            <Label htmlFor="assetName">اسم الأصل</Label>
                            <Input
                              id="assetName"
                              value={fixedAssetFormData.assetName}
                              onChange={(e) =>
                                setFixedAssetFormData({ ...fixedAssetFormData, assetName: e.target.value })
                              }
                              required={hasFixedAsset}
                              placeholder="مثال: ماكينة CNC، سيارة توصيل"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="usefulLifeYears">العمر الإنتاجي (سنوات)</Label>
                              <Input
                                id="usefulLifeYears"
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={fixedAssetFormData.usefulLifeYears}
                                onChange={(e) =>
                                  setFixedAssetFormData({ ...fixedAssetFormData, usefulLifeYears: e.target.value })
                                }
                                required={hasFixedAsset}
                                placeholder="5"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="salvageValue">القيمة المتبقية (دينار)</Label>
                              <Input
                                id="salvageValue"
                                type="number"
                                step="0.01"
                                min="0"
                                value={fixedAssetFormData.salvageValue}
                                onChange={(e) =>
                                  setFixedAssetFormData({ ...fixedAssetFormData, salvageValue: e.target.value })
                                }
                                required={hasFixedAsset}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <div className="text-sm text-purple-700 bg-purple-100 p-2 rounded">
                            💡 الاستهلاك الشهري: {
                              fixedAssetFormData.usefulLifeYears && fixedAssetFormData.salvageValue
                                ? ((parseFloat(formData.amount || "0") - parseFloat(fixedAssetFormData.salvageValue)) / (parseFloat(fixedAssetFormData.usefulLifeYears) * 12)).toFixed(2)
                                : "0.00"
                            } دينار
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
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
                {loading ? "جاري الحفظ..." : editingEntry ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Related Records Management Dialog */}
      <Dialog open={isRelatedDialogOpen} onOpenChange={setIsRelatedDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إدارة السجلات المرتبطة بالمعاملة</DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <div className="text-sm">
                  <p><strong>الوصف:</strong> {selectedEntry.description}</p>
                  <p><strong>رقم المعاملة:</strong> <span className="font-mono">{selectedEntry.transactionId}</span></p>
                  <p><strong>المبلغ:</strong> {selectedEntry.amount} دينار</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Tabs for different record types */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-4">
              <button
                onClick={() => setRelatedTab("payments")}
                className={`pb-2 px-1 border-b-2 font-medium text-sm ${relatedTab === "payments"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                الدفعات
              </button>
              <button
                onClick={() => setRelatedTab("cheques")}
                className={`pb-2 px-1 border-b-2 font-medium text-sm ${relatedTab === "cheques"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                الشيكات
              </button>
              <button
                onClick={() => setRelatedTab("inventory")}
                className={`pb-2 px-1 border-b-2 font-medium text-sm ${relatedTab === "inventory"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                المخزون
              </button>
            </nav>
          </div>

          <div className="py-4">
            {/* Payments Tab */}
            {relatedTab === "payments" && (
              <div className="space-y-4">
                <h3 className="font-semibold">إضافة دفعة جديدة</h3>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount">المبلغ (دينار)</Label>
                      <Input
                        id="paymentAmount"
                        type="number"
                        step="0.01"
                        value={paymentFormData.amount}
                        onChange={(e) =>
                          setPaymentFormData({ ...paymentFormData, amount: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentNotes">ملاحظات</Label>
                      <Input
                        id="paymentNotes"
                        value={paymentFormData.notes}
                        onChange={(e) =>
                          setPaymentFormData({ ...paymentFormData, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? "جاري الإضافة..." : "إضافة دفعة"}
                  </Button>
                </form>
              </div>
            )}

            {/* Cheques Tab */}
            {relatedTab === "cheques" && (
              <div className="space-y-4">
                <h3 className="font-semibold">إضافة شيك جديد</h3>
                <form onSubmit={handleAddCheque} className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="chequeNumber">رقم الشيك</Label>
                        <Input
                          id="chequeNumber"
                          value={chequeFormData.chequeNumber}
                          onChange={(e) =>
                            setChequeFormData({ ...chequeFormData, chequeNumber: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chequeAmount">المبلغ (دينار)</Label>
                        <Input
                          id="chequeAmount"
                          type="number"
                          step="0.01"
                          value={chequeFormData.amount}
                          onChange={(e) =>
                            setChequeFormData({ ...chequeFormData, amount: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">اسم البنك</Label>
                        <Input
                          id="bankName"
                          value={chequeFormData.bankName}
                          onChange={(e) =>
                            setChequeFormData({ ...chequeFormData, bankName: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chequeDueDate">تاريخ الاستحقاق</Label>
                        <Input
                          id="chequeDueDate"
                          type="date"
                          value={chequeFormData.dueDate}
                          onChange={(e) =>
                            setChequeFormData({ ...chequeFormData, dueDate: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="chequeType">نوع الشيك</Label>
                        <select
                          id="chequeType"
                          value={chequeFormData.chequeType}
                          onChange={(e) =>
                            setChequeFormData({ ...chequeFormData, chequeType: e.target.value })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          required
                        >
                          <option value="عادي">عادي</option>
                          <option value="مجير">شيك مجير</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chequeStatus">الحالة</Label>
                        <select
                          id="chequeStatus"
                          value={chequeFormData.status}
                          onChange={(e) =>
                            setChequeFormData({ ...chequeFormData, status: e.target.value })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          required
                        >
                          <option value="قيد الانتظار">قيد الانتظار</option>
                          <option value="تم الصرف">تم الصرف</option>
                          <option value="مرفوض">مرفوض</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chequeImage">صورة الشيك</Label>
                      <Input
                        id="chequeImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setChequeFormData({ ...chequeFormData, chequeImage: file });
                        }}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-gray-500">اختياري - يمكنك رفع صورة الشيك</p>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? "جاري الإضافة..." : "إضافة شيك"}
                  </Button>
                </form>
              </div>
            )}

            {/* Inventory Tab */}
            {relatedTab === "inventory" && (
              <div className="space-y-4">
                <h3 className="font-semibold">إضافة حركة مخزون</h3>
                <form onSubmit={handleAddInventory} className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="itemName">اسم الصنف</Label>
                      <Input
                        id="itemName"
                        value={inventoryFormData.itemName}
                        onChange={(e) =>
                          setInventoryFormData({ ...inventoryFormData, itemName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">الكمية</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.01"
                          value={inventoryFormData.quantity}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, quantity: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">الوحدة</Label>
                        <Input
                          id="unit"
                          value={inventoryFormData.unit}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, unit: e.target.value })
                          }
                          required
                          placeholder="كجم، قطعة، صندوق"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>الأبعاد (اختياري)</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="thickness" className="text-xs">السماكة</Label>
                          <Input
                            id="thickness"
                            type="number"
                            step="0.01"
                            value={inventoryFormData.thickness}
                            onChange={(e) =>
                              setInventoryFormData({ ...inventoryFormData, thickness: e.target.value })
                            }
                            placeholder="سم"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="width" className="text-xs">العرض</Label>
                          <Input
                            id="width"
                            type="number"
                            step="0.01"
                            value={inventoryFormData.width}
                            onChange={(e) =>
                              setInventoryFormData({ ...inventoryFormData, width: e.target.value })
                            }
                            placeholder="سم"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="length" className="text-xs">الطول</Label>
                          <Input
                            id="length"
                            type="number"
                            step="0.01"
                            value={inventoryFormData.length}
                            onChange={(e) =>
                              setInventoryFormData({ ...inventoryFormData, length: e.target.value })
                            }
                            placeholder="سم"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invNotes">ملاحظات</Label>
                      <Input
                        id="invNotes"
                        value={inventoryFormData.notes}
                        onChange={(e) =>
                          setInventoryFormData({ ...inventoryFormData, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? "جاري الإضافة..." : "إضافة حركة مخزون"}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Payment Dialog */}
      <Dialog open={isQuickPayDialogOpen} onOpenChange={setIsQuickPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة دفعة</DialogTitle>
            <DialogDescription>
              {quickPayEntry && (
                <div className="space-y-2 mt-2">
                  <div className="text-sm">
                    <span className="font-medium">المعاملة:</span> {quickPayEntry.description}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">المبلغ الإجمالي:</span> {quickPayEntry.amount.toFixed(2)} دينار
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">المبلغ المتبقي:</span>{" "}
                    <span className="text-red-600 font-bold">
                      {quickPayEntry.remainingBalance?.toFixed(2)} دينار
                    </span>
                  </div>
                  {quickPayEntry.totalPaid && quickPayEntry.totalPaid > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">المدفوع:</span> {quickPayEntry.totalPaid.toFixed(2)} دينار
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickPayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quickPayAmount">المبلغ المدفوع</Label>
              <Input
                id="quickPayAmount"
                type="number"
                step="0.01"
                placeholder="أدخل المبلغ"
                value={quickPayAmount}
                onChange={(e) => setQuickPayAmount(e.target.value)}
                required
              />
              {quickPayEntry && quickPayEntry.remainingBalance && (
                <p className="text-xs text-gray-500">
                  الحد الأقصى: {quickPayEntry.remainingBalance.toFixed(2)} دينار
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuickPayDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الإضافة..." : "إضافة الدفعة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
