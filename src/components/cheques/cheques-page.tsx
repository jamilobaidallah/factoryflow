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
import { Plus, Edit, Trash2, Image as ImageIcon, RefreshCw, Download } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
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
import { firestore } from "@/firebase/config";

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
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [chequeToEndorse, setChequeToEndorse] = useState<Cheque | null>(null);
  const [endorseToSupplier, setEndorseToSupplier] = useState("");

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

  // Fetch total count
  useEffect(() => {
    if (!user) return;

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
    });

    return () => unsubscribe();
  }, [user, pageSize, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      if (editingCheque) {
        const chequeRef = doc(firestore, `users/${user.uid}/cheques`, editingCheque.id);
        await updateDoc(chequeRef, {
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
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الشيك",
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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
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
          console.error("Error deleting cheque:", error);
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
      console.error("Error endorsing cheque:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تظهير الشيك",
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
          {cheques.length === 0 ? (
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
                  <TableRow key={cheque.id}>
                    <TableCell className="font-medium">
                      {cheque.chequeNumber}
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
                      <div className="flex gap-2">
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
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الحفظ..." : editingCheque ? "تحديث" : "إضافة"}
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

      {confirmationDialog}
    </div>
  );
}
