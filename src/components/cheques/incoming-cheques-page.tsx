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

// Components
import { IncomingChequesTable } from "./components/IncomingChequesTable";
import { IncomingChequesFormDialog } from "./components/IncomingChequesFormDialog";
import { ImageViewerDialog, EndorseDialog } from "./components/IncomingChequeDialogs";
import { PaymentDateModal } from "./components/PaymentDateModal";

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
    </div>
  );
}
