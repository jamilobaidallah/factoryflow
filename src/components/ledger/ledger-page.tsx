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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Edit, Trash2, FolderOpen, DollarSign, Download } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/hooks/use-toast";
import { exportLedgerToExcel, exportLedgerToPDF, exportLedgerToHTML } from "@/lib/export-utils";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  where,
  getDocs,
  query,
} from "firebase/firestore";
import { firestore, storage } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Import extracted utilities and hooks
import { LedgerEntry, CATEGORIES } from "./utils/ledger-constants";
import { getCategoryType, generateTransactionId } from "./utils/ledger-helpers";
import { useLedgerData } from "./hooks/useLedgerData";
import { useLedgerForm } from "./hooks/useLedgerForm";
import { useLedgerOperations } from "./hooks/useLedgerOperations";
import { QuickPayDialog } from "./components/QuickPayDialog";
import { LedgerStats } from "./components/LedgerStats";
import { LedgerTable } from "./components/LedgerTable";

// Interfaces and constants are now imported from utils

export default function LedgerPage() {
  const { user } = useUser();
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Use custom hook for data fetching with pagination
  const { entries, clients, partners, totalCount, totalPages } = useLedgerData({
    pageSize,
    currentPage,
  });
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

  // Use custom hooks for form state and operations
  const formHook = useLedgerForm();
  const { submitLedgerEntry, deleteLedgerEntry } = useLedgerOperations();

  // Destructure form state from hook
  const {
    formData,
    setFormData,
    hasIncomingCheck,
    setHasIncomingCheck,
    hasInventoryUpdate,
    setHasInventoryUpdate,
    hasFixedAsset,
    setHasFixedAsset,
    hasInitialPayment,
    setHasInitialPayment,
    initialPaymentAmount,
    setInitialPaymentAmount,
    checkFormData,
    setCheckFormData,
    inventoryFormData: inventoryFormDataNew,
    setInventoryFormData: setInventoryFormDataNew,
    fixedAssetFormData,
    setFixedAssetFormData,
    paymentFormData,
    setPaymentFormData,
    chequeRelatedFormData: chequeFormData,
    setChequeRelatedFormData: setChequeFormData,
    inventoryRelatedFormData: inventoryFormData,
    setInventoryRelatedFormData: setInventoryFormData,
    resetAllForms,
    loadEntryForEdit,
    resetPaymentForm,
    resetChequeForm,
    resetInventoryForm,
  } = formHook;

  // Calculate current entry type based on selected category for UI rendering
  const currentEntryType = getCategoryType(formData.category, formData.subCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await submitLedgerEntry(formData, editingEntry, {
        hasIncomingCheck,
        checkFormData,
        hasInventoryUpdate,
        inventoryFormData: inventoryFormDataNew,
        hasFixedAsset,
        fixedAssetFormData,
        hasInitialPayment,
        initialPaymentAmount,
      });

      if (success) {
        resetAllForms();
        setEditingEntry(null);
        setIsDialogOpen(false);
      }
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
    loadEntryForEdit(entry);
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

      // 4. Revert inventory quantities and delete related inventory movements
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
      const movementsQuery = query(movementsRef, where("linkedTransactionId", "==", entry.transactionId));
      const movementsSnapshot = await getDocs(movementsQuery);

      // Revert quantities before deleting movements
      for (const movementDoc of movementsSnapshot.docs) {
        const movement = movementDoc.data() as any;
        const itemId = movement.itemId;
        const quantity = movement.quantity || 0;
        const movementType = movement.type; // 'entry' or 'exit'

        if (itemId) {
          // Find the inventory item
          const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
          const itemQuery = query(inventoryRef, where("__name__", "==", itemId));
          const itemSnapshot = await getDocs(itemQuery);

          if (!itemSnapshot.empty) {
            const itemDoc = itemSnapshot.docs[0];
            const currentQuantity = (itemDoc.data() as any).quantity || 0;

            // Revert the quantity change
            // If it was دخول/entry (+), we subtract to revert
            // If it was خروج/exit (-), we add back to revert
            const revertedQuantity = movementType === "دخول"
              ? currentQuantity - quantity
              : currentQuantity + quantity;

            const itemDocRef = doc(firestore, `users/${user.uid}/inventory`, itemId);
            batch.update(itemDocRef, { quantity: Math.max(0, revertedQuantity) });
          }
        }

        // Delete the movement record
        batch.delete(movementDoc.ref);
      }

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
      depreciationMethod: "straight-line",
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
    setIsQuickPayDialogOpen(true);
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

      <LedgerStats entries={entries} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>سجل الحركات المالية ({entries.length})</CardTitle>
            {entries.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLedgerToExcel(entries, `الحركات_المالية_${new Date().toISOString().split('T')[0]}`)}
                >
                  <Download className="w-4 h-4 ml-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLedgerToHTML(entries)}
                  title="طباعة باللغة العربية"
                >
                  <Download className="w-4 h-4 ml-2" />
                  PDF عربي
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLedgerToPDF(entries, `الحركات_المالية_${new Date().toISOString().split('T')[0]}`)}
                >
                  <Download className="w-4 h-4 ml-2" />
                  PDF (EN)
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <LedgerTable
            entries={entries}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onQuickPay={openQuickPayDialog}
            onViewRelated={openRelatedDialog}
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                عرض {entries.length} من {totalCount} حركة
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(pageNum);
                          }}
                          isActive={currentPage === pageNum}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
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
      <QuickPayDialog
        isOpen={isQuickPayDialogOpen}
        onClose={() => setIsQuickPayDialogOpen(false)}
        entry={quickPayEntry}
        onSuccess={() => {
          // Data will refresh automatically via onSnapshot in useLedgerData
          setIsQuickPayDialogOpen(false);
          setQuickPayEntry(null);
        }}
      />
    </div>
  );
}
