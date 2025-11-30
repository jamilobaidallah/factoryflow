"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ChequesList } from "./cheques-list";
import type { Cheque as ChequeType } from "./cheque-card";
import { exportChequesToExcel } from "@/lib/export-utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

// Types and hooks
import { Cheque, ChequeFormData, initialChequeFormData } from "./types/cheques";
import { useChequesData } from "./hooks/useChequesData";
import { useChequesOperations } from "./hooks/useChequesOperations";

// Components
import { ChequesFormDialog } from "./components/ChequesFormDialog";
import {
  ImageViewerDialog,
  EndorseDialog,
  ClearChequeDialog,
  BounceChequeDialog,
} from "./components/ChequeDialogs";
import { PaymentDateModal } from "./components/PaymentDateModal";
import { MultiAllocationDialog } from "@/components/payments/MultiAllocationDialog";
import { doc, updateDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";

export default function ChequesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { user } = useUser();
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Data and operations hooks
  const { cheques, clientPhones, totalCount, totalPages, loading: dataLoading, refresh } = useChequesData({
    pageSize,
    currentPage,
  });
  const { submitCheque, deleteCheque, endorseCheque, clearCheque, bounceCheque } = useChequesOperations();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ChequeFormData>(initialChequeFormData);
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Dialog states
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [chequeToEndorse, setChequeToEndorse] = useState<Cheque | null>(null);
  const [endorseToSupplier, setEndorseToSupplier] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [chequeToClear, setChequeToClear] = useState<Cheque | null>(null);
  const [bounceDialogOpen, setBounceDialogOpen] = useState(false);
  const [chequeToBounce, setChequeToBounce] = useState<Cheque | null>(null);

  // Payment date modal state
  const [paymentDateModalOpen, setPaymentDateModalOpen] = useState(false);
  const [paymentDateContext, setPaymentDateContext] = useState<'submit' | 'clear'>('submit');
  const [pendingFormData, setPendingFormData] = useState<ChequeFormData | null>(null);

  // Multi-allocation dialog state for cheque cashing
  const [multiAllocationDialogOpen, setMultiAllocationDialogOpen] = useState(false);
  const [chequeToCash, setChequeToCash] = useState<{
    chequeId: string;
    chequeNumber: string;
    clientName: string;
    amount: number;
    dueDate: Date;
    chequeType: "incoming" | "outgoing";
    paymentDate?: Date;
  } | null>(null);

  const resetForm = () => {
    setFormData(initialChequeFormData);
    setEditingCheque(null);
    setChequeImage(null);
    setImagePreview(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (cheque: Cheque) => {
    setEditingCheque(cheque);
    setFormData({
      chequeNumber: cheque.chequeNumber || "",
      clientName: cheque.clientName || "",
      amount: (cheque.amount || 0).toString(),
      type: cheque.type || CHEQUE_TYPES.INCOMING,
      status: cheque.status || CHEQUE_STATUS_AR.PENDING,
      linkedTransactionId: cheque.linkedTransactionId || "",
      issueDate: cheque.issueDate ? new Date(cheque.issueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      dueDate: cheque.dueDate ? new Date(cheque.dueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      bankName: cheque.bankName || "",
      notes: cheque.notes || "",
    });
    setChequeImage(null);
    setImagePreview(cheque.chequeImageUrl || null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if status is changing to 'Cashed Out' from a pending status
    const pendingStatuses = [CHEQUE_STATUS_AR.PENDING, "pending"];
    const clearedStatuses = [CHEQUE_STATUS_AR.CASHED, "cleared", CHEQUE_STATUS_AR.COLLECTED, "cashed"];
    const wasPending = editingCheque ? pendingStatuses.includes(editingCheque.status) : false;
    const isNowCleared = clearedStatuses.includes(formData.status);

    if (editingCheque && wasPending && isNowCleared) {
      // Step 1: Store form data and open PaymentDateModal first
      setPendingFormData(formData);
      setPaymentDateContext('submit');
      setPaymentDateModalOpen(true);
      setIsDialogOpen(false); // Close the cheque edit dialog
      return;
    }

    // Normal submission without payment date
    await submitChequeWithDate();
  };

  const submitChequeWithDate = async (paymentDate?: Date) => {
    setLoading(true);
    if (chequeImage) setUploadingImage(true);

    const dataToSubmit = pendingFormData || formData;
    const success = await submitCheque(dataToSubmit, editingCheque, chequeImage, paymentDate);

    if (success) {
      resetForm();
      setIsDialogOpen(false);
      setPendingFormData(null);
    }
    setLoading(false);
    setUploadingImage(false);
  };

  const handleDelete = (chequeId: string) => {
    confirm(
      "حذف الشيك",
      "هل أنت متأكد من حذف هذا الشيك؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteCheque(chequeId, cheques);
      },
      "destructive"
    );
  };

  const handleEndorse = async () => {
    if (!chequeToEndorse) return;
    setLoading(true);
    const success = await endorseCheque(chequeToEndorse, endorseToSupplier);
    if (success) {
      setEndorseDialogOpen(false);
      setChequeToEndorse(null);
      setEndorseToSupplier("");
    }
    setLoading(false);
  };

  const handleClear = async () => {
    if (!chequeToClear) return;

    // Step 1: Open PaymentDateModal first to select the date
    setPaymentDateContext('clear');
    setPaymentDateModalOpen(true);
    setClearDialogOpen(false);
    // Note: chequeToClear is kept for use in handlePaymentDateConfirm
  };

  const clearChequeWithDate = async (paymentDate?: Date) => {
    if (!chequeToClear) return;
    setLoading(true);
    const success = await clearCheque(chequeToClear, paymentDate);
    if (success) {
      setChequeToClear(null);
    }
    setLoading(false);
  };

  const handlePaymentDateConfirm = async (paymentDate: Date) => {
    setPaymentDateModalOpen(false);

    if (paymentDateContext === 'submit' && pendingFormData && editingCheque) {
      // Step 2: Open MultiAllocationDialog with the selected payment date (from edit form)
      setChequeToCash({
        chequeId: editingCheque.id,
        chequeNumber: pendingFormData.chequeNumber,
        clientName: pendingFormData.clientName,
        amount: parseFloat(pendingFormData.amount),
        dueDate: new Date(pendingFormData.dueDate),
        chequeType: pendingFormData.type === CHEQUE_TYPES.INCOMING ? "incoming" : "outgoing",
        paymentDate: paymentDate, // Pass the selected date to MultiAllocationDialog
      });
      setMultiAllocationDialogOpen(true);
    } else if (paymentDateContext === 'clear' && chequeToClear) {
      // Step 2: Open MultiAllocationDialog with the selected payment date (from "Mark as Cleared")
      setChequeToCash({
        chequeId: chequeToClear.id,
        chequeNumber: chequeToClear.chequeNumber,
        clientName: chequeToClear.clientName,
        amount: chequeToClear.amount,
        dueDate: chequeToClear.dueDate instanceof Date ? chequeToClear.dueDate : new Date(chequeToClear.dueDate),
        chequeType: chequeToClear.type === CHEQUE_TYPES.INCOMING ? "incoming" : "outgoing",
        paymentDate: paymentDate, // Pass the selected date to MultiAllocationDialog
      });
      setChequeToClear(null); // Clear now since we've captured the data
      setMultiAllocationDialogOpen(true);
    }
  };

  const handlePaymentDateCancel = () => {
    setPaymentDateModalOpen(false);
    setPendingFormData(null);

    // If we were in the middle of clearing, reopen the clear dialog
    if (paymentDateContext === 'clear' && chequeToClear) {
      setClearDialogOpen(true);
    }
  };

  const handleBounce = async () => {
    if (!chequeToBounce) return;
    setLoading(true);
    const success = await bounceCheque(chequeToBounce);
    if (success) {
      setBounceDialogOpen(false);
      setChequeToBounce(null);
    }
    setLoading(false);
  };

  // Handler for successful cheque cashing via MultiAllocationDialog
  const handleChequeCashingSuccess = async (paymentId: string) => {
    if (!user || !chequeToCash) return;

    try {
      // Update the cheque status to 'Cashed' and link the payment
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToCash.chequeId);
      await updateDoc(chequeRef, {
        status: CHEQUE_STATUS_AR.CASHED,
        clearedDate: new Date(),
        linkedPaymentId: paymentId,
      });

      toast({
        title: "تم تحصيل الشيك",
        description: `تم تحصيل الشيك رقم ${chequeToCash.chequeNumber} وتوزيع المبلغ على المعاملات المستحقة`,
      });

      // Reset state
      setChequeToCash(null);
      setPendingFormData(null);
      resetForm();
      refresh(); // Refresh the cheques list
    } catch (error) {
      console.error("Error updating cheque status:", error);
      toast({
        title: "خطأ",
        description: "تم حفظ الدفعة لكن حدث خطأ في تحديث حالة الشيك",
        variant: "destructive",
      });
    }
  };

  // Prepare cheques with phone numbers
  const chequesWithPhones: ChequeType[] = cheques.map((cheque) => ({
    ...cheque,
    clientPhone: clientPhones[cheque.clientName] || undefined,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الشيكات</h1>
          <p className="text-gray-600 mt-2">إدارة الشيكات الواردة والصادرة</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة شيك
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>سجل الشيكات ({cheques.length})</CardTitle>
            {cheques.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportChequesToExcel(cheques, `الشيكات_${new Date().toISOString().split('T')[0]}`)}
              >
                <Download className="w-4 h-4 ml-2" />
                Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <TableSkeleton rows={10} />
          ) : (
            <ChequesList
              cheques={chequesWithPhones}
              loading={loading}
              onRefresh={refresh}
              onMarkCleared={(cheque) => {
                setChequeToClear(cheque);
                setClearDialogOpen(true);
              }}
              onMarkBounced={(cheque) => {
                setChequeToBounce(cheque);
                setBounceDialogOpen(true);
              }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onEndorse={(cheque) => {
                setChequeToEndorse(cheque);
                setEndorseToSupplier("");
                setEndorseDialogOpen(true);
              }}
              onViewImage={(url) => {
                setSelectedImageUrl(url);
                setImageViewerOpen(true);
              }}
            />
          )}

          {totalPages > 1 && (
            <div className="hidden md:flex mt-4 items-center justify-between">
              <div className="text-sm text-muted-foreground">
                عرض {cheques.length} من {totalCount} شيك
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

      <ChequesFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingCheque={editingCheque}
        formData={formData}
        setFormData={setFormData}
        chequeImage={chequeImage}
        setChequeImage={setChequeImage}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
        loading={loading}
        uploadingImage={uploadingImage}
        onSubmit={handleSubmit}
      />

      <ImageViewerDialog
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        imageUrl={selectedImageUrl}
      />

      <EndorseDialog
        isOpen={endorseDialogOpen}
        onClose={() => setEndorseDialogOpen(false)}
        cheque={chequeToEndorse}
        supplierName={endorseToSupplier}
        setSupplierName={setEndorseToSupplier}
        loading={loading}
        onEndorse={handleEndorse}
      />

      <ClearChequeDialog
        isOpen={clearDialogOpen}
        onClose={() => {
          setClearDialogOpen(false);
          setChequeToClear(null);
        }}
        cheque={chequeToClear}
        loading={loading}
        onClear={handleClear}
      />

      <BounceChequeDialog
        isOpen={bounceDialogOpen}
        onClose={() => {
          setBounceDialogOpen(false);
          setChequeToBounce(null);
        }}
        cheque={chequeToBounce}
        loading={loading}
        onBounce={handleBounce}
      />

      <PaymentDateModal
        isOpen={paymentDateModalOpen}
        onClose={handlePaymentDateCancel}
        onConfirm={handlePaymentDateConfirm}
        defaultDate={
          paymentDateContext === 'submit' && editingCheque?.dueDate
            ? new Date(editingCheque.dueDate)
            : paymentDateContext === 'clear' && chequeToClear?.dueDate
            ? new Date(chequeToClear.dueDate)
            : new Date()
        }
        chequeNumber={
          paymentDateContext === 'submit' && editingCheque?.chequeNumber
            ? editingCheque.chequeNumber
            : paymentDateContext === 'clear' && chequeToClear?.chequeNumber
            ? chequeToClear.chequeNumber
            : ""
        }
      />

      {confirmationDialog}

      {/* Multi-Allocation Dialog for Cheque Cashing */}
      <MultiAllocationDialog
        open={multiAllocationDialogOpen}
        onOpenChange={(open) => {
          setMultiAllocationDialogOpen(open);
          if (!open) {
            setChequeToCash(null);
            setPendingFormData(null);
          }
        }}
        chequeData={chequeToCash || undefined}
        onChequeSuccess={handleChequeCashingSuccess}
      />
    </div>
  );
}
