"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";
import { OutgoingChequesSummaryHeader } from "./components/OutgoingChequesSummaryHeader";

// Types and hooks
import { Cheque, ChequeFormData, initialChequeFormData } from "./types/cheques";
import { useOutgoingChequesData } from "./hooks/useOutgoingChequesData";
import { useOutgoingChequesOperations } from "./hooks/useOutgoingChequesOperations";
import { useReversePayment } from "./hooks/useReversePayment";
import { useAllClients } from "@/hooks/useAllClients";

// Components
import { OutgoingChequesTable } from "./components/OutgoingChequesTable";
import { OutgoingChequesFormDialog } from "./components/OutgoingChequesFormDialog";
import { ImageViewerDialog, LinkTransactionDialog } from "./components/OutgoingChequeDialogs";
import { PaymentDateModal } from "./components/PaymentDateModal";
import { MultiAllocationDialog } from "@/components/payments/MultiAllocationDialog";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";

export default function OutgoingChequesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { user } = useUser();
  const { toast } = useToast();

  // Data and operations hooks
  const { cheques, loading: dataLoading } = useOutgoingChequesData();
  const { submitCheque, deleteCheque, linkTransaction } = useOutgoingChequesOperations();
  const { reversePayment } = useReversePayment();
  const { clients, loading: clientsLoading } = useAllClients();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state - override type to always be outgoing
  const initialOutgoingFormData: ChequeFormData = {
    ...initialChequeFormData,
    type: CHEQUE_TYPES.OUTGOING,
  };
  const [formData, setFormData] = useState<ChequeFormData>(initialOutgoingFormData);
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Dialog states
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [chequeToLink, setChequeToLink] = useState<Cheque | null>(null);
  const [linkTransactionId, setLinkTransactionId] = useState("");

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
    setFormData(initialOutgoingFormData);
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
      type: CHEQUE_TYPES.OUTGOING, // Always outgoing
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
          title: "تم إلغاء الصرف",
          description: `تم إلغاء صرف الشيك رقم ${editingCheque.chequeNumber} واسترداد المبالغ للمعاملات المستحقة`,
        });

        // Continue with normal submission to update the status
        await submitChequeWithDate();
      } else {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء إلغاء الصرف",
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
        chequeType: "outgoing",
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
        title: "تم صرف الشيك",
        description: `تم صرف الشيك رقم ${chequeToCash.chequeNumber} وتوزيع المبلغ على المعاملات المستحقة`,
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

  const handleViewImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageViewerOpen(true);
  };

  const openLinkDialog = (cheque: Cheque) => {
    setChequeToLink(cheque);
    setLinkTransactionId(cheque.linkedTransactionId || "");
    setLinkDialogOpen(true);
  };

  const handleLinkTransaction = async () => {
    if (!chequeToLink) return;

    setLoading(true);
    const success = await linkTransaction(chequeToLink, linkTransactionId);
    if (success) {
      setLinkDialogOpen(false);
      setChequeToLink(null);
      setLinkTransactionId("");
    }
    setLoading(false);
  };

  // Calculate summary statistics
  const stats = useMemo(() => {
    const pendingCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.PENDING);
    const clearedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.CASHED);
    const returnedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.RETURNED || c.status === CHEQUE_STATUS_AR.BOUNCED);
    const endorsedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.ENDORSED);
    const cancelledCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.CANCELLED);

    return {
      pendingCount: pendingCheques.length,
      pendingValue: pendingCheques.reduce((sum, c) => sum + c.amount, 0),
      clearedCount: clearedCheques.length,
      clearedValue: clearedCheques.reduce((sum, c) => sum + c.amount, 0),
      returnedCount: returnedCheques.length,
      endorsedCount: endorsedCheques.length,
      cancelledCount: cancelledCheques.length,
    };
  }, [cheques]);

  return (
    <div className="space-y-6">
      <OutgoingChequesSummaryHeader
        stats={stats}
        loading={dataLoading}
        actions={
          <PermissionGate action="create" module="cheques">
            <Button size="sm" className="gap-2" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              إضافة شيك صادر
            </Button>
          </PermissionGate>
        }
      />

      <OutgoingChequesTable
        cheques={cheques}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewImage={handleViewImage}
        onLinkTransaction={openLinkDialog}
      />

      <OutgoingChequesFormDialog
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

      <LinkTransactionDialog
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        cheque={chequeToLink}
        transactionId={linkTransactionId}
        setTransactionId={setLinkTransactionId}
        loading={loading}
        onLink={handleLinkTransaction}
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
