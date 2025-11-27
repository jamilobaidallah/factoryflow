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
import { useConfirmation } from "@/components/ui/confirmation-dialog";
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
import { LedgerFormDialog } from "./components/LedgerFormDialog";
import { RelatedRecordsDialog } from "./components/RelatedRecordsDialog";

// Interfaces and constants are now imported from utils

export default function LedgerPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();

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

  const handleDelete = (entryId: string) => {
    if (!user) {return;}

    confirm(
      "حذف الحركة المالية",
      "هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف جميع السجلات المرتبطة (مدفوعات، شيكات، حركات مخزون). لا يمكن التراجع عن هذا الإجراء.",
      async () => {
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
      },
      "destructive"
    );
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

      <LedgerFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingEntry={editingEntry}
        onSubmit={handleSubmit}
        loading={loading}
        clients={clients}
        partners={partners}
        formData={formData}
        setFormData={setFormData}
        hasIncomingCheck={hasIncomingCheck}
        setHasIncomingCheck={setHasIncomingCheck}
        hasInventoryUpdate={hasInventoryUpdate}
        setHasInventoryUpdate={setHasInventoryUpdate}
        hasFixedAsset={hasFixedAsset}
        setHasFixedAsset={setHasFixedAsset}
        hasInitialPayment={hasInitialPayment}
        setHasInitialPayment={setHasInitialPayment}
        initialPaymentAmount={initialPaymentAmount}
        setInitialPaymentAmount={setInitialPaymentAmount}
        checkFormData={checkFormData}
        setCheckFormData={setCheckFormData}
        inventoryFormData={inventoryFormDataNew}
        setInventoryFormData={setInventoryFormDataNew}
        fixedAssetFormData={fixedAssetFormData}
        setFixedAssetFormData={setFixedAssetFormData}
      />

      {/* Related Records Management Dialog */}
      <RelatedRecordsDialog
        isOpen={isRelatedDialogOpen}
        onClose={() => setIsRelatedDialogOpen(false)}
        selectedEntry={selectedEntry}
        relatedTab={relatedTab}
        setRelatedTab={setRelatedTab}
        loading={loading}
        onAddPayment={handleAddPayment}
        onAddCheque={handleAddCheque}
        onAddInventory={handleAddInventory}
        paymentFormData={paymentFormData}
        setPaymentFormData={setPaymentFormData}
        chequeFormData={chequeFormData}
        setChequeFormData={setChequeFormData}
        inventoryFormData={inventoryFormData}
        setInventoryFormData={setInventoryFormData}
      />

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

      {confirmationDialog}
    </div>
  );
}
