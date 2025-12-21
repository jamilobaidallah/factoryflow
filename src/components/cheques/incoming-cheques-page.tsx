"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

// Types and hooks
import { Cheque, ChequeFormData } from "./types/cheques";
import { useIncomingChequesData } from "./hooks/useIncomingChequesData";
import { useIncomingChequesOperations, type EndorsementAllocationData } from "./hooks/useIncomingChequesOperations";
import { useReversePayment } from "./hooks/useReversePayment";
import { useAllClients } from "@/hooks/useAllClients";

// Components
import { IncomingChequesTable } from "./components/IncomingChequesTable";
import { IncomingChequesFormDialog } from "./components/IncomingChequesFormDialog";
import { ImageViewerDialog } from "./components/IncomingChequeDialogs";
import { EndorsementAllocationDialog } from "./components/EndorsementAllocationDialog";
import { PaymentDateModal } from "./components/PaymentDateModal";
import { MultiAllocationDialog } from "@/components/payments/MultiAllocationDialog";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";

const initialFormData: ChequeFormData = {
  chequeNumber: "",
  clientName: "",
  amount: "",
  type: CHEQUE_TYPES.INCOMING,
  status: CHEQUE_STATUS_AR.PENDING,
  linkedTransactionId: "",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date().toISOString().split("T")[0],
  bankName: "",
  notes: "",
};

export default function IncomingChequesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { user } = useUser();
  const { toast } = useToast();

  // Data and operations hooks
  const {
    cheques,
    pendingCheques,
    clearedCheques,
    endorsedCheques,
    bouncedCheques,
    totalPendingValue,
    totalClearedValue,
    loading: dataLoading,
  } = useIncomingChequesData();

  const {
    submitCheque,
    deleteCheque,
    endorseCheque,
    endorseChequeWithAllocations,
    cancelEndorsement,
  } = useIncomingChequesOperations();

  const { reversePayment } = useReversePayment();
  const { clients, loading: clientsLoading } = useAllClients();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ChequeFormData>(initialFormData);
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Dialog states
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [chequeToEndorse, setChequeToEndorse] = useState<Cheque | null>(null);

  // Payment date modal state
  const [paymentDateModalOpen, setPaymentDateModalOpen] = useState(false);
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
  } | null>(null);

  const resetForm = () => {
    setFormData(initialFormData);
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
      type: CHEQUE_TYPES.INCOMING,
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
    const clearedStatuses = [CHEQUE_STATUS_AR.CASHED, "cleared", CHEQUE_STATUS_AR.COLLECTED, "cashed", "تم الصرف", "محصل"];
    const wasCleared = editingCheque ? clearedStatuses.includes(editingCheque.status) : false;
    const wasPending = editingCheque ? pendingStatuses.includes(editingCheque.status) : false;
    const isNowCleared = clearedStatuses.includes(formData.status);
    const isNowPending = pendingStatuses.includes(formData.status);

    // CASE 1: Reversal - Status changing from cashed back to pending
    if (editingCheque && wasCleared && isNowPending && editingCheque.linkedPaymentId) {
      setLoading(true);
      const success = await reversePayment(editingCheque);

      if (success) {
        toast({
          title: "تم إلغاء التحصيل",
          description: `تم إلغاء تحصيل الشيك رقم ${editingCheque.chequeNumber} واسترداد المبالغ للمعاملات المستحقة`,
        });

        // Continue with normal submission to update the status
        await submitChequeWithDate();
      } else {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء إلغاء التحصيل",
          variant: "destructive",
        });
        setLoading(false);
      }
      return;
    }

    // CASE 2: Cashing - Status changing from pending to cashed
    if (editingCheque && wasPending && isNowCleared) {
      // Go directly to MultiAllocationDialog (date picker is inside)
      setPendingFormData(formData);
      setChequeToCash({
        chequeId: editingCheque.id,
        chequeNumber: formData.chequeNumber,
        clientName: formData.clientName,
        amount: parseFloat(formData.amount),
        dueDate: new Date(formData.dueDate),
        chequeType: "incoming",
      });
      setIsDialogOpen(false); // Close the cheque edit dialog
      setMultiAllocationDialogOpen(true);
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

  const handlePaymentDateConfirm = async (paymentDate: Date) => {
    setPaymentDateModalOpen(false);
    await submitChequeWithDate(paymentDate);
  };

  const handlePaymentDateCancel = () => {
    setPaymentDateModalOpen(false);
    setPendingFormData(null);
  };

  // Handler for successful cheque cashing via MultiAllocationDialog
  const handleChequeCashingSuccess = async (paymentId: string, paidTransactionIds: string[]) => {
    if (!user || !chequeToCash) return;

    try {
      // Update the cheque status to 'Cashed' and link the payment + transaction IDs
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, chequeToCash.chequeId);
      await updateDoc(chequeRef, {
        status: CHEQUE_STATUS_AR.CASHED,
        clearedDate: new Date(),
        linkedPaymentId: paymentId,
        paidTransactionIds: paidTransactionIds, // Store the transaction IDs that were paid
      });

      toast({
        title: "تم تحصيل الشيك",
        description: `تم تحصيل الشيك رقم ${chequeToCash.chequeNumber} وتوزيع المبلغ على المعاملات المستحقة`,
      });

      // Reset state - onSnapshot will auto-refresh the list
      setChequeToCash(null);
      setPendingFormData(null);
      resetForm();
    } catch (error) {
      console.error("Error updating cheque status:", error);
      toast({
        title: "خطأ",
        description: "تم حفظ الدفعة لكن حدث خطأ في تحديث حالة الشيك",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (chequeId: string) => {
    confirm(
      "حذف الشيك",
      "هل أنت متأكد من حذف هذا الشيك؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteCheque(chequeId);
      },
      "destructive"
    );
  };

  // Handle endorsement with multi-allocation
  const handleEndorseWithAllocations = async (data: EndorsementAllocationData): Promise<boolean> => {
    if (!chequeToEndorse) return false;

    setLoading(true);
    const success = await endorseChequeWithAllocations(chequeToEndorse, data);

    if (success) {
      setChequeToEndorse(null);
    }

    setLoading(false);
    return success;
  };

  const handleCancelEndorsement = (cheque: Cheque) => {
    confirm(
      "إلغاء التظهير",
      `هل أنت متأكد من إلغاء تظهير الشيك رقم ${cheque.chequeNumber}؟ سيتم حذف حركات التظهير المرتبطة والشيك من الصادرة.`,
      async () => {
        setLoading(true);
        await cancelEndorsement(cheque);
        setLoading(false);
      },
      "warning"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الشيكات الواردة</h1>
          <p className="text-gray-600 mt-2">إدارة الشيكات الواردة من العملاء مع إمكانية التظهير</p>
        </div>
        <PermissionGate action="create" module="cheques">
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            إضافة شيك وارد
          </Button>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">قيد الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalPendingValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">تم الصرف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{clearedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalClearedValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">مجيّر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{endorsedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">تم تظهيرها للموردين</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">مرفوض</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{bouncedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">شيكات مرتجعة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الشيكات الواردة ({cheques.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <TableSkeleton rows={10} />
          ) : (
            <IncomingChequesTable
              cheques={cheques}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onEndorse={(cheque) => {
                setChequeToEndorse(cheque);
                setEndorseDialogOpen(true);
              }}
              onCancelEndorsement={handleCancelEndorsement}
              onViewImage={(url) => {
                setSelectedImageUrl(url);
                setImageViewerOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>

      <IncomingChequesFormDialog
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
        clients={clients}
        clientsLoading={clientsLoading}
      />

      <ImageViewerDialog
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        imageUrl={selectedImageUrl}
      />

      <EndorsementAllocationDialog
        open={endorseDialogOpen}
        onOpenChange={(open) => {
          setEndorseDialogOpen(open);
          if (!open) {
            setChequeToEndorse(null);
          }
        }}
        cheque={chequeToEndorse}
        clients={clients}
        clientsLoading={clientsLoading}
        onEndorse={handleEndorseWithAllocations}
      />

      <PaymentDateModal
        isOpen={paymentDateModalOpen}
        onClose={handlePaymentDateCancel}
        onConfirm={handlePaymentDateConfirm}
        defaultDate={editingCheque?.dueDate ? new Date(editingCheque.dueDate) : new Date()}
        chequeNumber={editingCheque?.chequeNumber || ""}
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
