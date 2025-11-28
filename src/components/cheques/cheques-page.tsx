"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
import { Plus, Edit, Trash2, Image as ImageIcon, RefreshCw, Download, Upload, X } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { exportChequesToExcel } from "@/lib/export-utils";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { firestore, storage } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface Cheque {
  id: string;
  chequeNumber: string;
  clientName: string;
  amount: number;
  type: string; // "وارد" or "صادر"
  chequeType?: string; // "عادي" or "مجير"
  status: string; // "قيد الانتظار" or "تم الصرف" or "مرفوض" or "مجيّر"
  chequeImageUrl?: string; // URL to uploaded cheque image
  endorsedTo?: string; // Name of supplier the cheque was endorsed to
  endorsedDate?: Date; // Date when cheque was endorsed
  linkedTransactionId: string; // Link to ledger transaction
  issueDate: Date;
  dueDate: Date;
  bankName: string;
  notes: string;
  createdAt: Date;
}

export default function ChequesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [chequeToEndorse, setChequeToEndorse] = useState<Cheque | null>(null);
  const [endorseToSupplier, setEndorseToSupplier] = useState("");

  // Clear/Bounce cheque dialogs
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [chequeToClear, setChequeToClear] = useState<Cheque | null>(null);
  const [bounceDialogOpen, setBounceDialogOpen] = useState(false);
  const [chequeToBounce, setChequeToBounce] = useState<Cheque | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / pageSize);

  const [formData, setFormData] = useState({
    chequeNumber: "",
    clientName: "",
    amount: "",
    type: "وارد",
    status: "قيد الانتظار",
    linkedTransactionId: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date().toISOString().split("T")[0],
    bankName: "",
    notes: "",
  });
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fetch total count
  useEffect(() => {
    if (!user) { return; }

    const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
    getCountFromServer(query(chequesRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch cheques with pagination
  useEffect(() => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
    const q = query(chequesRef, orderBy("dueDate", "desc"), limit(pageSize));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chequesData: Cheque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        chequesData.push({
          id: doc.id,
          ...data,
          issueDate: data.issueDate?.toDate ? data.issueDate.toDate() : new Date(),
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as Cheque);
      });
      setCheques(chequesData);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user, pageSize, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      // Upload image if provided
      let chequeImageUrl: string | undefined = undefined;
      if (chequeImage) {
        setUploadingImage(true);
        const imageRef = ref(
          storage,
          `users/${user.uid}/cheques/${Date.now()}_${chequeImage.name}`
        );
        await uploadBytes(imageRef, chequeImage);
        chequeImageUrl = await getDownloadURL(imageRef);
        setUploadingImage(false);
      }

      if (editingCheque) {
        const chequeRef = doc(firestore, `users/${user.uid}/cheques`, editingCheque.id);
        const updateData: Record<string, unknown> = {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: formData.type,
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
        };

        // Only update image URL if a new image was uploaded
        if (chequeImageUrl) {
          updateData.chequeImageUrl = chequeImageUrl;
        }

        // Check if status changed from pending to cleared
        const oldStatus = editingCheque.status;
        const newStatus = formData.status;
        const pendingStatuses = ["قيد الانتظار", "pending"];
        const clearedStatuses = ["تم الصرف", "cleared", "محصل", "cashed"];
        const wasPending = pendingStatuses.includes(oldStatus);
        const isNowCleared = clearedStatuses.includes(newStatus);

        if (wasPending && isNowCleared) {
          // Add cleared date when status changes to cleared
          updateData.clearedDate = new Date();

          // Create a Payment record when cheque status changes from pending to cleared
          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const paymentType = formData.type === "وارد" ? "قبض" : "صرف";
          const chequeAmount = parseFloat(formData.amount);

          await addDoc(paymentsRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: paymentType,
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            date: new Date(),
            notes: `تحصيل شيك رقم ${formData.chequeNumber}`,
            createdAt: new Date(),
          });

          // Update AR/AP tracking if linkedTransactionId exists
          if (formData.linkedTransactionId) {
            const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
            const ledgerQuery = query(
              ledgerRef,
              where("transactionId", "==", formData.linkedTransactionId.trim())
            );
            const ledgerSnapshot = await getDocs(ledgerQuery);

            if (!ledgerSnapshot.empty) {
              const ledgerDoc = ledgerSnapshot.docs[0];
              const ledgerData = ledgerDoc.data();

              if (ledgerData.isARAPEntry) {
                const currentTotalPaid = ledgerData.totalPaid || 0;
                const transactionAmount = ledgerData.amount || 0;
                const newTotalPaid = currentTotalPaid + chequeAmount;
                const newRemainingBalance = transactionAmount - newTotalPaid;

                let newStatus: "paid" | "unpaid" | "partial" = "unpaid";
                if (newRemainingBalance <= 0) {
                  newStatus = "paid";
                } else if (newTotalPaid > 0) {
                  newStatus = "partial";
                }

                await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
                  totalPaid: newTotalPaid,
                  remainingBalance: newRemainingBalance,
                  paymentStatus: newStatus,
                });
              }
            }
          }
        }

        await updateDoc(chequeRef, updateData);
        toast({
          title: "تم التحديث بنجاح",
          description: wasPending && isNowCleared
            ? `تم تحصيل الشيك رقم ${formData.chequeNumber} وإنشاء سند قبض/صرف`
            : "تم تحديث بيانات الشيك",
        });
      } else {
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
        const chequeAmount = parseFloat(formData.amount);

        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: chequeAmount,
          type: formData.type,
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
          createdAt: new Date(),
          ...(chequeImageUrl && { chequeImageUrl }),
        });

        // Update AR/AP tracking if linkedTransactionId is provided
        if (formData.linkedTransactionId) {
          const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
          const ledgerQuery = query(
            ledgerRef,
            where("transactionId", "==", formData.linkedTransactionId)
          );
          const ledgerSnapshot = await getDocs(ledgerQuery);

          if (!ledgerSnapshot.empty) {
            const ledgerDoc = ledgerSnapshot.docs[0];
            const ledgerData = ledgerDoc.data();

            // Only update if AR/AP tracking is enabled for this transaction
            if (ledgerData.isARAPEntry) {
              const currentTotalPaid = ledgerData.totalPaid || 0;
              const transactionAmount = ledgerData.amount || 0;
              const newTotalPaid = currentTotalPaid + chequeAmount;
              const newRemainingBalance = transactionAmount - newTotalPaid;

              let newStatus: "paid" | "unpaid" | "partial" = "unpaid";
              if (newRemainingBalance <= 0) {
                newStatus = "paid";
              } else if (newTotalPaid > 0) {
                newStatus = "partial";
              }

              // Update the ledger entry
              await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
                totalPaid: newTotalPaid,
                remainingBalance: newRemainingBalance,
                paymentStatus: newStatus,
              });
            }
          }
        }

        toast({
          title: "تمت الإضافة بنجاح",
          description: formData.linkedTransactionId
            ? "تم إضافة الشيك وتحديث الرصيد المتبقي في دفتر الأستاذ"
            : "تم إضافة شيك جديد",
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cheque: Cheque) => {
    setEditingCheque(cheque);
    setFormData({
      chequeNumber: cheque.chequeNumber || "",
      clientName: cheque.clientName || "",
      amount: (cheque.amount || 0).toString(),
      type: cheque.type || "وارد",
      status: cheque.status || "قيد الانتظار",
      linkedTransactionId: cheque.linkedTransactionId || "",
      issueDate: cheque.issueDate ? new Date(cheque.issueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      dueDate: cheque.dueDate ? new Date(cheque.dueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      bankName: cheque.bankName || "",
      notes: cheque.notes || "",
    });
    // Set image preview if cheque has an existing image
    setChequeImage(null);
    setImagePreview(cheque.chequeImageUrl || null);
    setIsDialogOpen(true);
  };

  const handleDelete = (chequeId: string) => {
    if (!user) {return;}

    confirm(
      "حذف الشيك",
      "هل أنت متأكد من حذف هذا الشيك؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          // First, get the cheque data to access linkedTransactionId and amount
          const cheque = cheques.find((c) => c.id === chequeId);

          if (cheque && cheque.linkedTransactionId) {
            // Reverse AR/AP update before deleting
            const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
            const ledgerQuery = query(
              ledgerRef,
              where("transactionId", "==", cheque.linkedTransactionId.trim())
            );
            const ledgerSnapshot = await getDocs(ledgerQuery);

            if (!ledgerSnapshot.empty) {
              const ledgerDoc = ledgerSnapshot.docs[0];
              const ledgerData = ledgerDoc.data();

              if (ledgerData.isARAPEntry) {
                const currentTotalPaid = ledgerData.totalPaid || 0;
                const transactionAmount = ledgerData.amount || 0;
                const newTotalPaid = Math.max(0, currentTotalPaid - cheque.amount);
                const newRemainingBalance = transactionAmount - newTotalPaid;

                let newStatus: "paid" | "unpaid" | "partial" = "unpaid";
                if (newRemainingBalance <= 0) {
                  newStatus = "paid";
                } else if (newTotalPaid > 0) {
                  newStatus = "partial";
                }

                // Update the ledger entry
                await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
                  totalPaid: newTotalPaid,
                  remainingBalance: newRemainingBalance,
                  paymentStatus: newStatus,
                });
              }
            }
          }

          // Now delete the cheque
          const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeId);
          await deleteDoc(chequeRef);

          toast({
            title: "تم الحذف",
            description: cheque?.linkedTransactionId
              ? "تم حذف الشيك وتحديث الرصيد في دفتر الأستاذ"
              : "تم حذف الشيك بنجاح",
          });
        } catch (error) {
          const appError = handleError(error);
          toast({
            title: getErrorTitle(appError),
            description: appError.message,
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  const resetForm = () => {
    setFormData({
      chequeNumber: "",
      clientName: "",
      amount: "",
      type: "وارد",
      status: "قيد الانتظار",
      linkedTransactionId: "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date().toISOString().split("T")[0],
      bankName: "",
      notes: "",
    });
    setEditingCheque(null);
    setChequeImage(null);
    setImagePreview(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "تم الصرف":
        return "bg-green-100 text-green-700";
      case "قيد الانتظار":
        return "bg-yellow-100 text-yellow-700";
      case "مجيّر":
        return "bg-purple-100 text-purple-700";
      case "مرفوض":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const handleViewImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageViewerOpen(true);
  };

  const openEndorseDialog = (cheque: Cheque) => {
    setChequeToEndorse(cheque);
    setEndorseToSupplier("");
    setEndorseDialogOpen(true);
  };

  const handleEndorseCheque = async () => {
    if (!user || !chequeToEndorse || !endorseToSupplier.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم المورد",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Update cheque status and type
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToEndorse.id);
      await updateDoc(chequeRef, {
        chequeType: "مجير",
        status: "مجيّر",
        endorsedTo: endorseToSupplier,
        endorsedDate: new Date(),
      });

      // 2. Create payment record for original client (decrease receivable)
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      await addDoc(paymentsRef, {
        clientName: chequeToEndorse.clientName,
        amount: chequeToEndorse.amount,
        type: "قبض",
        linkedTransactionId: chequeToEndorse.linkedTransactionId || "",
        date: new Date(),
        notes: `تظهير شيك رقم ${chequeToEndorse.chequeNumber} للمورد: ${endorseToSupplier}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
      });

      // 3. Create payment record for supplier (decrease payable)
      await addDoc(paymentsRef, {
        clientName: endorseToSupplier,
        amount: chequeToEndorse.amount,
        type: "صرف",
        linkedTransactionId: chequeToEndorse.linkedTransactionId || "",
        date: new Date(),
        notes: `استلام شيك مجيّر رقم ${chequeToEndorse.chequeNumber} من العميل: ${chequeToEndorse.clientName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
      });

      toast({
        title: "تم التظهير بنجاح",
        description: `تم تظهير الشيك رقم ${chequeToEndorse.chequeNumber} إلى ${endorseToSupplier}`,
      });

      setEndorseDialogOpen(false);
      setChequeToEndorse(null);
      setEndorseToSupplier("");
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open clear cheque dialog
  const openClearDialog = (cheque: Cheque) => {
    setChequeToClear(cheque);
    setClearDialogOpen(true);
  };

  // Handle clearing a pending cheque (confirm collection)
  const handleClearCheque = async () => {
    if (!user || !chequeToClear) {
      return;
    }

    setLoading(true);
    try {
      // 1. Update cheque status to 'تم الصرف' (cleared)
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToClear.id);
      await updateDoc(chequeRef, {
        status: "تم الصرف",
        clearedDate: new Date(),
      });

      // 2. Create a Payment record
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentType = chequeToClear.type === "وارد" ? "قبض" : "صرف";

      await addDoc(paymentsRef, {
        clientName: chequeToClear.clientName,
        amount: chequeToClear.amount,
        type: paymentType,
        method: "cheque",
        linkedTransactionId: chequeToClear.linkedTransactionId || "",
        date: new Date(),
        notes: `تحصيل شيك مؤجل رقم ${chequeToClear.chequeNumber}`,
        createdAt: new Date(),
      });

      // 3. Update AR/AP tracking if linkedTransactionId exists
      if (chequeToClear.linkedTransactionId) {
        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        const ledgerQuery = query(
          ledgerRef,
          where("transactionId", "==", chequeToClear.linkedTransactionId.trim())
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (!ledgerSnapshot.empty) {
          const ledgerDoc = ledgerSnapshot.docs[0];
          const ledgerData = ledgerDoc.data();

          if (ledgerData.isARAPEntry) {
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const transactionAmount = ledgerData.amount || 0;
            const newTotalPaid = currentTotalPaid + chequeToClear.amount;
            const newRemainingBalance = transactionAmount - newTotalPaid;

            let newStatus: "paid" | "unpaid" | "partial" = "unpaid";
            if (newRemainingBalance <= 0) {
              newStatus = "paid";
            } else if (newTotalPaid > 0) {
              newStatus = "partial";
            }

            await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newStatus,
            });
          }
        }
      }

      toast({
        title: "تم التحصيل بنجاح",
        description: `تم تحصيل الشيك رقم ${chequeToClear.chequeNumber} وتحديث الرصيد`,
      });

      setClearDialogOpen(false);
      setChequeToClear(null);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open bounce cheque dialog
  const openBounceDialog = (cheque: Cheque) => {
    setChequeToBounce(cheque);
    setBounceDialogOpen(true);
  };

  // Handle bouncing a pending cheque
  const handleBounceCheque = async () => {
    if (!user || !chequeToBounce) {
      return;
    }

    setLoading(true);
    try {
      // Update cheque status to 'مرفوض' (bounced)
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToBounce.id);
      await updateDoc(chequeRef, {
        status: "مرفوض",
        bouncedDate: new Date(),
      });

      // No payment record created - client still owes the money
      // No AR/AP update - balance remains unchanged

      toast({
        title: "تم تسجيل الشيك كمرتجع",
        description: `تم تسجيل الشيك رقم ${chequeToBounce.chequeNumber} كمرتجع. رصيد العميل لم يتغير.`,
      });

      setBounceDialogOpen(false);
      setChequeToBounce(null);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if a cheque is overdue
  const isOverdue = (cheque: Cheque) => {
    if (cheque.status !== "قيد الانتظار") {return false;}
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(cheque.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

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
          ) : cheques.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد شيكات مسجلة. اضغط على &quot;إضافة شيك&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الشيك</TableHead>
                  <TableHead>اسم العميل</TableHead>
                  <TableHead>البنك</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>تصنيف الشيك</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>رقم المعاملة</TableHead>
                  <TableHead>صورة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.map((cheque) => (
                  <TableRow
                    key={cheque.id}
                    className={isOverdue(cheque) ? "bg-red-50" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {cheque.chequeNumber}
                        {isOverdue(cheque) && (
                          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                            متأخر
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{cheque.clientName}</div>
                        {cheque.endorsedTo && (
                          <div className="text-xs text-purple-600 mt-1">
                            ← مظهر إلى: {cheque.endorsedTo}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cheque.bankName}</TableCell>
                    <TableCell>{cheque.amount || 0} دينار</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${cheque.type === "وارد"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                          }`}
                      >
                        {cheque.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {cheque.chequeType === "مجير" ? "شيك مجير" : "عادي"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                          cheque.status
                        )}`}
                      >
                        {cheque.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(cheque.dueDate).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {cheque.linkedTransactionId || "-"}
                    </TableCell>
                    <TableCell>
                      {cheque.chequeImageUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewImage(cheque.chequeImageUrl!)}
                          title="عرض صورة الشيك"
                        >
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {/* Show clear (confirm collection) button for pending cheques */}
                        {cheque.status === "قيد الانتظار" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openClearDialog(cheque)}
                            title="تأكيد التحصيل"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </Button>
                        )}
                        {/* Show bounce button for pending cheques */}
                        {cheque.status === "قيد الانتظار" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openBounceDialog(cheque)}
                            title="شيك مرتجع"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Show endorse button only for incoming pending cheques that are not endorsed */}
                        {cheque.type === "وارد" &&
                          cheque.status === "قيد الانتظار" &&
                          cheque.chequeType !== "مجير" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEndorseDialog(cheque)}
                              title="تظهير الشيك"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(cheque)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(cheque.id)}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
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
                        if (currentPage < totalPages) { setCurrentPage(currentPage + 1); }
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
                        if (currentPage > 1) { setCurrentPage(currentPage - 1); }
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCheque ? "تعديل الشيك" : "إضافة شيك جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingCheque
                ? "قم بتعديل بيانات الشيك أدناه"
                : "أدخل بيانات الشيك الجديد أدناه"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chequeNumber">رقم الشيك</Label>
                  <Input
                    id="chequeNumber"
                    value={formData.chequeNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, chequeNumber: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">اسم العميل</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) =>
                      setFormData({ ...formData, clientName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
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
                  <Label htmlFor="bankName">اسم البنك</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) =>
                      setFormData({ ...formData, bankName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">النوع</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="وارد">وارد</option>
                    <option value="صادر">صادر</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">الحالة</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">تاريخ الإصدار</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, issueDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedTransactionId">رقم المعاملة المرتبطة (اختياري)</Label>
                <Input
                  id="linkedTransactionId"
                  value={formData.linkedTransactionId}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedTransactionId: e.target.value })
                  }
                  placeholder="TXN-20250109-123456-789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chequeImage">صورة الشيك (اختياري)</Label>
                <div className="space-y-2">
                  {imagePreview && (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="معاينة صورة الشيك"
                        className="max-h-32 rounded-md border object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => {
                          setChequeImage(null);
                          setImagePreview(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      id="chequeImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setChequeImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setImagePreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <Upload className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500">
                    {editingCheque?.chequeImageUrl && !chequeImage
                      ? "الصورة الحالية محفوظة. اختر صورة جديدة لاستبدالها"
                      : "يمكنك رفع صورة الشيك بصيغة JPG أو PNG"}
                  </p>
                </div>
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
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading || uploadingImage}>
                {uploadingImage ? "جاري رفع الصورة..." : loading ? "جاري الحفظ..." : editingCheque ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>صورة الشيك</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {selectedImageUrl && (
              <div className="relative w-full h-[70vh]">
                <Image
                  src={selectedImageUrl}
                  alt="Cheque"
                  fill
                  className="object-contain rounded-lg shadow-lg"
                  unoptimized
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageViewerOpen(false)}
            >
              إغلاق
            </Button>
            {selectedImageUrl && (
              <Button
                type="button"
                onClick={() => window.open(selectedImageUrl, '_blank')}
              >
                فتح في تبويب جديد
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Endorse Cheque Dialog */}
      <Dialog open={endorseDialogOpen} onOpenChange={setEndorseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تظهير الشيك</DialogTitle>
            <DialogDescription>
              {chequeToEndorse && (
                <div className="text-sm mt-2 space-y-1">
                  <p><strong>رقم الشيك:</strong> {chequeToEndorse.chequeNumber}</p>
                  <p><strong>من العميل:</strong> {chequeToEndorse.clientName}</p>
                  <p><strong>المبلغ:</strong> {chequeToEndorse.amount} دينار</p>
                  <p className="text-amber-600 mt-2">
                    ⚠️ سيتم تسجيل دفعة للعميل وللمورد دون حركة نقدية فعلية
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endorseToSupplier">اسم المورد المظهر له الشيك</Label>
              <Input
                id="endorseToSupplier"
                value={endorseToSupplier}
                onChange={(e) => setEndorseToSupplier(e.target.value)}
                placeholder="أدخل اسم المورد"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEndorseDialogOpen(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleEndorseCheque}
              disabled={loading || !endorseToSupplier.trim()}
            >
              {loading ? "جاري التظهير..." : "تظهير الشيك"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear/Collect Cheque Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد تحصيل الشيك</DialogTitle>
            <DialogDescription>
              {chequeToClear && (
                <div className="text-sm mt-2 space-y-1">
                  <p><strong>رقم الشيك:</strong> {chequeToClear.chequeNumber}</p>
                  <p><strong>العميل:</strong> {chequeToClear.clientName}</p>
                  <p><strong>المبلغ:</strong> {chequeToClear.amount} دينار</p>
                  <p><strong>تاريخ الاستحقاق:</strong> {new Date(chequeToClear.dueDate).toLocaleDateString("ar-EG")}</p>
                  <p className="text-green-600 mt-2">
                    ✓ سيتم تحديث حالة الشيك إلى &quot;تم الصرف&quot; وتسجيل دفعة وتحديث رصيد العميل
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setClearDialogOpen(false);
                setChequeToClear(null);
              }}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleClearCheque}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? "جاري التحصيل..." : "تأكيد التحصيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bounce Cheque Dialog */}
      <Dialog open={bounceDialogOpen} onOpenChange={setBounceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل شيك مرتجع</DialogTitle>
            <DialogDescription>
              {chequeToBounce && (
                <div className="text-sm mt-2 space-y-1">
                  <p><strong>رقم الشيك:</strong> {chequeToBounce.chequeNumber}</p>
                  <p><strong>العميل:</strong> {chequeToBounce.clientName}</p>
                  <p><strong>المبلغ:</strong> {chequeToBounce.amount} دينار</p>
                  <p><strong>تاريخ الاستحقاق:</strong> {new Date(chequeToBounce.dueDate).toLocaleDateString("ar-EG")}</p>
                  <p className="text-red-600 mt-2">
                    ⚠️ سيتم تسجيل الشيك كمرتجع. رصيد العميل لن يتغير - لا يزال مديناً بالمبلغ.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBounceDialogOpen(false);
                setChequeToBounce(null);
              }}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleBounceCheque}
              disabled={loading}
              variant="destructive"
            >
              {loading ? "جاري التسجيل..." : "تسجيل كمرتجع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
