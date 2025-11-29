"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

// Types and hooks
import { Cheque, ChequeFormData, initialChequeFormData } from "./types/cheques";
import { useOutgoingChequesData } from "./hooks/useOutgoingChequesData";
import { useOutgoingChequesOperations } from "./hooks/useOutgoingChequesOperations";

// Components
import { OutgoingChequesTable } from "./components/OutgoingChequesTable";
import { OutgoingChequesFormDialog } from "./components/OutgoingChequesFormDialog";
import { ImageViewerDialog, LinkTransactionDialog } from "./components/OutgoingChequeDialogs";
import { PaymentDateModal } from "./components/PaymentDateModal";

export default function OutgoingChequesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { cheques, loading: dataLoading } = useOutgoingChequesData();
  const { submitCheque, deleteCheque, linkTransaction } = useOutgoingChequesOperations();

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
    const clearedStatuses = [CHEQUE_STATUS_AR.CASHED, "cleared", CHEQUE_STATUS_AR.COLLECTED, "cashed"];
    const wasPending = editingCheque ? pendingStatuses.includes(editingCheque.status) : false;
    const isNowCleared = clearedStatuses.includes(formData.status);

    if (editingCheque && wasPending && isNowCleared) {
      // Store the form data and open payment date modal
      setPendingFormData(formData);
      setPaymentDateModalOpen(true);
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

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">الشيكات الصادرة</h1>
            <p className="text-gray-600 mt-2">إدارة الشيكات الصادرة للموردين والدائنين</p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الشيكات الصادرة</h1>
          <p className="text-gray-600 mt-2">إدارة الشيكات الصادرة للموردين والدائنين</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة شيك صادر
        </Button>
      </div>

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
    </div>
  );
}
