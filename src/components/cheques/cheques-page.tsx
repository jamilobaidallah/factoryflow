"use client";

import { useState, useMemo, useReducer } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ChequesList } from "./cheques-list";
import type { Cheque as ChequeType } from "./cheque-card";
import { exportChequesToExcelProfessional } from "@/lib/export-cheques-excel";
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
import { useAllClients } from "@/hooks/useAllClients";

// Components
import { ChequesFormDialog } from "./components/ChequesFormDialog";
import {
  ImageViewerDialog,
  EndorseDialog,
  ClearChequeDialog,
  BounceChequeDialog,
} from "./components/ChequeDialogs";
import { MultiAllocationDialog } from "@/components/payments/MultiAllocationDialog";
import { doc, updateDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";

// Dialog state management with useReducer
interface ChequeToCashData {
  chequeId: string;
  chequeNumber: string;
  clientName: string;
  amount: number;
  dueDate: Date;
  chequeType: "incoming" | "outgoing";
}

interface DialogState {
  imageViewerOpen: boolean;
  selectedImageUrl: string;
  endorseDialogOpen: boolean;
  chequeToEndorse: Cheque | null;
  endorseToSupplier: string;
  clearDialogOpen: boolean;
  chequeToClear: Cheque | null;
  bounceDialogOpen: boolean;
  chequeToBounce: Cheque | null;
  multiAllocationDialogOpen: boolean;
  chequeToCash: ChequeToCashData | null;
}

type DialogAction =
  | { type: 'OPEN_IMAGE_VIEWER'; imageUrl: string }
  | { type: 'CLOSE_IMAGE_VIEWER' }
  | { type: 'OPEN_ENDORSE_DIALOG'; cheque: Cheque }
  | { type: 'CLOSE_ENDORSE_DIALOG' }
  | { type: 'SET_ENDORSE_SUPPLIER'; value: string }
  | { type: 'OPEN_CLEAR_DIALOG'; cheque: Cheque }
  | { type: 'CLOSE_CLEAR_DIALOG' }
  | { type: 'OPEN_BOUNCE_DIALOG'; cheque: Cheque }
  | { type: 'CLOSE_BOUNCE_DIALOG' }
  | { type: 'OPEN_MULTI_ALLOCATION'; data: ChequeToCashData }
  | { type: 'CLOSE_MULTI_ALLOCATION' };

const initialDialogState: DialogState = {
  imageViewerOpen: false,
  selectedImageUrl: "",
  endorseDialogOpen: false,
  chequeToEndorse: null,
  endorseToSupplier: "",
  clearDialogOpen: false,
  chequeToClear: null,
  bounceDialogOpen: false,
  chequeToBounce: null,
  multiAllocationDialogOpen: false,
  chequeToCash: null,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'OPEN_IMAGE_VIEWER':
      return { ...state, imageViewerOpen: true, selectedImageUrl: action.imageUrl };
    case 'CLOSE_IMAGE_VIEWER':
      return { ...state, imageViewerOpen: false, selectedImageUrl: "" };
    case 'OPEN_ENDORSE_DIALOG':
      return { ...state, endorseDialogOpen: true, chequeToEndorse: action.cheque, endorseToSupplier: "" };
    case 'CLOSE_ENDORSE_DIALOG':
      return { ...state, endorseDialogOpen: false, chequeToEndorse: null, endorseToSupplier: "" };
    case 'SET_ENDORSE_SUPPLIER':
      return { ...state, endorseToSupplier: action.value };
    case 'OPEN_CLEAR_DIALOG':
      return { ...state, clearDialogOpen: true, chequeToClear: action.cheque };
    case 'CLOSE_CLEAR_DIALOG':
      return { ...state, clearDialogOpen: false, chequeToClear: null };
    case 'OPEN_BOUNCE_DIALOG':
      return { ...state, bounceDialogOpen: true, chequeToBounce: action.cheque };
    case 'CLOSE_BOUNCE_DIALOG':
      return { ...state, bounceDialogOpen: false, chequeToBounce: null };
    case 'OPEN_MULTI_ALLOCATION':
      return { ...state, multiAllocationDialogOpen: true, chequeToCash: action.data };
    case 'CLOSE_MULTI_ALLOCATION':
      return { ...state, multiAllocationDialogOpen: false, chequeToCash: null };
    default:
      return state;
  }
}

export default function ChequesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Read URL params for filtering
  const dueSoonDays = searchParams.get("dueSoon");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Data and operations hooks
  const { cheques, clientPhones, totalCount, totalPages, loading: dataLoading, refresh } = useChequesData({
    pageSize,
    currentPage,
  });
  const { submitCheque, deleteCheque, endorseCheque, clearCheque, bounceCheque } = useChequesOperations();
  const { clients, loading: clientsLoading } = useAllClients();

  // Filter cheques based on URL params
  const filteredCheques = useMemo(() => {
    if (!dueSoonDays) return cheques;

    const days = parseInt(dueSoonDays);
    if (isNaN(days)) return cheques;

    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return cheques.filter((cheque) => {
      // Only pending cheques
      if (cheque.status !== CHEQUE_STATUS_AR.PENDING) return false;

      // Due within X days
      const dueDate = cheque.dueDate instanceof Date ? cheque.dueDate : new Date(cheque.dueDate);
      return dueDate >= now && dueDate <= futureDate;
    });
  }, [cheques, dueSoonDays]);

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ChequeFormData>(initialChequeFormData);
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Dialog states - consolidated with useReducer
  const [dialogState, dispatch] = useReducer(dialogReducer, initialDialogState);

  // Pending form data for cheque cashing flow
  const [pendingFormData, setPendingFormData] = useState<ChequeFormData | null>(null);

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
      // Go directly to MultiAllocationDialog (date picker is inside)
      setPendingFormData(formData);
      dispatch({
        type: 'OPEN_MULTI_ALLOCATION',
        data: {
          chequeId: editingCheque.id,
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          dueDate: new Date(formData.dueDate),
          chequeType: formData.type === CHEQUE_TYPES.INCOMING ? "incoming" : "outgoing",
        }
      });
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
    if (!dialogState.chequeToEndorse) return;
    setLoading(true);
    const success = await endorseCheque(dialogState.chequeToEndorse, dialogState.endorseToSupplier);
    if (success) {
      dispatch({ type: 'CLOSE_ENDORSE_DIALOG' });
    }
    setLoading(false);
  };

  const handleClear = async () => {
    if (!dialogState.chequeToClear) return;

    // Go directly to MultiAllocationDialog (date picker is inside)
    const cheque = dialogState.chequeToClear;
    dispatch({ type: 'CLOSE_CLEAR_DIALOG' });
    dispatch({
      type: 'OPEN_MULTI_ALLOCATION',
      data: {
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber,
        clientName: cheque.clientName,
        amount: cheque.amount,
        dueDate: cheque.dueDate instanceof Date ? cheque.dueDate : new Date(cheque.dueDate),
        chequeType: cheque.type === CHEQUE_TYPES.INCOMING ? "incoming" : "outgoing",
      }
    });
  };

  // Handler for successful cheque cashing via MultiAllocationDialog
  const handleChequeCashingSuccess = async (paymentId: string) => {
    if (!user || !dialogState.chequeToCash) return;

    try {
      // Update the cheque status to 'Cashed' and link the payment
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, dialogState.chequeToCash.chequeId);
      await updateDoc(chequeRef, {
        status: CHEQUE_STATUS_AR.CASHED,
        clearedDate: new Date(),
        linkedPaymentId: paymentId,
      });

      toast({
        title: "تم تحصيل الشيك",
        description: `تم تحصيل الشيك رقم ${dialogState.chequeToCash.chequeNumber} وتوزيع المبلغ على المعاملات المستحقة`,
      });

      // Reset state
      dispatch({ type: 'CLOSE_MULTI_ALLOCATION' });
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

  const handleBounce = async () => {
    if (!dialogState.chequeToBounce) return;
    setLoading(true);
    const success = await bounceCheque(dialogState.chequeToBounce);
    if (success) {
      dispatch({ type: 'CLOSE_BOUNCE_DIALOG' });
    }
    setLoading(false);
  };

  // Prepare cheques with phone numbers (use filtered if URL param is set)
  const chequesWithPhones: ChequeType[] = filteredCheques.map((cheque) => ({
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

      {/* Filter indicator when dueSoon is active */}
      {dueSoonDays && (
        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-sm text-amber-800">
              عرض الشيكات المستحقة خلال {dueSoonDays} أيام ({filteredCheques.length} شيك)
            </span>
          </div>
          <Link href="/cheques">
            <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900">
              عرض الكل
            </Button>
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>سجل الشيكات ({dueSoonDays ? filteredCheques.length : cheques.length})</CardTitle>
            {cheques.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportChequesToExcelProfessional(dueSoonDays ? filteredCheques : cheques)}
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
              onMarkCleared={(cheque) => dispatch({ type: 'OPEN_CLEAR_DIALOG', cheque })}
              onMarkBounced={(cheque) => dispatch({ type: 'OPEN_BOUNCE_DIALOG', cheque })}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onEndorse={(cheque) => dispatch({ type: 'OPEN_ENDORSE_DIALOG', cheque })}
              onViewImage={(url) => dispatch({ type: 'OPEN_IMAGE_VIEWER', imageUrl: url })}
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
        clients={clients}
        clientsLoading={clientsLoading}
      />

      <ImageViewerDialog
        isOpen={dialogState.imageViewerOpen}
        onClose={() => dispatch({ type: 'CLOSE_IMAGE_VIEWER' })}
        imageUrl={dialogState.selectedImageUrl}
      />

      <EndorseDialog
        isOpen={dialogState.endorseDialogOpen}
        onClose={() => dispatch({ type: 'CLOSE_ENDORSE_DIALOG' })}
        cheque={dialogState.chequeToEndorse}
        supplierName={dialogState.endorseToSupplier}
        setSupplierName={(value) => dispatch({ type: 'SET_ENDORSE_SUPPLIER', value })}
        loading={loading}
        onEndorse={handleEndorse}
      />

      <ClearChequeDialog
        isOpen={dialogState.clearDialogOpen}
        onClose={() => dispatch({ type: 'CLOSE_CLEAR_DIALOG' })}
        cheque={dialogState.chequeToClear}
        loading={loading}
        onClear={handleClear}
      />

      <BounceChequeDialog
        isOpen={dialogState.bounceDialogOpen}
        onClose={() => dispatch({ type: 'CLOSE_BOUNCE_DIALOG' })}
        cheque={dialogState.chequeToBounce}
        loading={loading}
        onBounce={handleBounce}
      />

      {confirmationDialog}

      {/* Multi-Allocation Dialog for Cheque Cashing */}
      <MultiAllocationDialog
        open={dialogState.multiAllocationDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            dispatch({ type: 'CLOSE_MULTI_ALLOCATION' });
            setPendingFormData(null);
          }
        }}
        chequeData={dialogState.chequeToCash || undefined}
        onChequeSuccess={handleChequeCashingSuccess}
      />
    </div>
  );
}
