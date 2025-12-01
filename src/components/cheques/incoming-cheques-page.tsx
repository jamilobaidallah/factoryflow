"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

// Types and hooks
import { Cheque, ChequeFormData } from "./types/cheques";
import { useIncomingChequesData } from "./hooks/useIncomingChequesData";
import { useIncomingChequesOperations } from "./hooks/useIncomingChequesOperations";
import { useAllClients } from "@/hooks/useAllClients";

// Components
import { IncomingChequesTable } from "./components/IncomingChequesTable";
import { IncomingChequesFormDialog } from "./components/IncomingChequesFormDialog";
import { ImageViewerDialog, EndorseDialog } from "./components/IncomingChequeDialogs";
import { PaymentDateModal } from "./components/PaymentDateModal";
import { MultiAllocationDialog } from "@/components/payments/MultiAllocationDialog";
import { doc, updateDoc, deleteDoc, collection, getDocs, getDoc, writeBatch } from "firebase/firestore";
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
    cancelEndorsement,
  } = useIncomingChequesOperations();

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
  const [endorseToSupplier, setEndorseToSupplier] = useState("");
  const [endorseTransactionId, setEndorseTransactionId] = useState("");

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

  // Function to reverse a payment when cheque status changes back to pending
  const reversePayment = async (cheque: Cheque): Promise<boolean> => {
    if (!user || !cheque.linkedPaymentId) return false;

    try {
      const batch = writeBatch(firestore);

      // 1. Get the payment and its allocations
      const paymentRef = doc(firestore, `users/${user.uid}/payments`, cheque.linkedPaymentId);
      const paymentDoc = await getDoc(paymentRef);

      if (!paymentDoc.exists()) {
        console.warn("Payment not found:", cheque.linkedPaymentId);
        // Payment doesn't exist, just clear the link
        return true;
      }

      // 2. Get all allocations for this payment
      const allocationsRef = collection(firestore, `users/${user.uid}/payments/${cheque.linkedPaymentId}/allocations`);
      const allocationsSnapshot = await getDocs(allocationsRef);

      // 3. Reverse each allocation - restore the ledger entry's remaining balance
      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        const ledgerDocId = allocation.ledgerDocId;
        const allocatedAmount = allocation.allocatedAmount || 0;

        if (ledgerDocId) {
          const ledgerRef = doc(firestore, `users/${user.uid}/ledger`, ledgerDocId);
          const ledgerDoc = await getDoc(ledgerRef);

          if (ledgerDoc.exists()) {
            const ledgerData = ledgerDoc.data();
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const currentRemainingBalance = ledgerData.remainingBalance || 0;
            const originalAmount = ledgerData.amount || 0;

            // Restore the remaining balance
            const newTotalPaid = Math.max(0, currentTotalPaid - allocatedAmount);
            const newRemainingBalance = currentRemainingBalance + allocatedAmount;

            // Determine new payment status
            let newPaymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
            if (newTotalPaid >= originalAmount) {
              newPaymentStatus = 'paid';
            } else if (newTotalPaid > 0) {
              newPaymentStatus = 'partial';
            }

            batch.update(ledgerRef, {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newPaymentStatus,
            });
          }
        }

        // Delete the allocation
        batch.delete(allocationDoc.ref);
      }

      // 4. Delete the payment document
      batch.delete(paymentRef);

      // 5. Update the cheque to clear linkedPaymentId, paidTransactionIds, and clearedDate
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      batch.update(chequeRef, {
        linkedPaymentId: null,
        paidTransactionIds: null,
        clearedDate: null,
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error("Error reversing payment:", error);
      return false;
    }
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
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToCash.chequeId);
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

  const handleEndorse = async () => {
    if (!chequeToEndorse) return;
    setLoading(true);
    const success = await endorseCheque(chequeToEndorse, endorseToSupplier, endorseTransactionId);
    if (success) {
      setEndorseDialogOpen(false);
      setChequeToEndorse(null);
      setEndorseToSupplier("");
      setEndorseTransactionId("");
    }
    setLoading(false);
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
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة شيك وارد
        </Button>
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
                setEndorseToSupplier("");
                setEndorseTransactionId("");
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

      <EndorseDialog
        isOpen={endorseDialogOpen}
        onClose={() => setEndorseDialogOpen(false)}
        cheque={chequeToEndorse}
        supplierName={endorseToSupplier}
        setSupplierName={setEndorseToSupplier}
        transactionId={endorseTransactionId}
        setTransactionId={setEndorseTransactionId}
        loading={loading}
        onEndorse={handleEndorse}
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
