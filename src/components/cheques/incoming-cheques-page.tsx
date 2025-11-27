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
import { Plus, Edit, Trash2, Image as ImageIcon, RefreshCw, X } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
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
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

interface Cheque {
  id: string;
  chequeNumber: string;
  clientName: string;
  amount: number;
  type: string; // "وارد" or "صادر"
  chequeType?: string; // "عادي" or "مجير"
  status: string; // "قيد الانتظار" or "تم الصرف" or "مرفوض" or "مجيّر"
  chequeImageUrl?: string;
  endorsedTo?: string;
  endorsedDate?: Date;
  linkedTransactionId: string;
  issueDate: Date;
  dueDate: Date;
  bankName: string;
  notes: string;
  createdAt: Date;
}

export default function IncomingChequesPage() {
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
  const [endorseTransactionId, setEndorseTransactionId] = useState("");

  const [formData, setFormData] = useState({
    chequeNumber: "",
    clientName: "",
    amount: "",
    status: "قيد الانتظار",
    linkedTransactionId: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date().toISOString().split("T")[0],
    bankName: "",
    notes: "",
  });

  useEffect(() => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
    // Limit to 1000 most recent cheques, filter client-side for type
    const q = query(chequesRef, orderBy("dueDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chequesData: Cheque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filter for incoming cheques only
        if (data.type === "وارد") {
          chequesData.push({
            id: doc.id,
            ...data,
            issueDate: data.issueDate?.toDate ? data.issueDate.toDate() : new Date(),
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          } as Cheque);
        }
      });
      setCheques(chequesData);
    });

    return () => unsubscribe();
  }, [user]);

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
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الشيك الوارد",
        });
      } else {
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: "وارد", // Always incoming
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
          createdAt: new Date(),
        });
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة شيك وارد جديد",
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
          const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeId);
          await deleteDoc(chequeRef);
          toast({
            title: "تم الحذف",
            description: "تم حذف الشيك بنجاح",
          });
        } catch (error) {
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
    setEndorseTransactionId("");
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
      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);

      // 1. Update incoming cheque status and type
      const incomingChequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToEndorse.id);
      await updateDoc(incomingChequeRef, {
        chequeType: "مجير",
        status: "مجيّر",
        endorsedTo: endorseToSupplier,
        endorsedDate: new Date(),
      });

      // 2. Create outgoing cheque entry (NEW!)
      const outgoingChequeDoc = await addDoc(chequesRef, {
        chequeNumber: chequeToEndorse.chequeNumber,
        clientName: endorseToSupplier, // Supplier name as recipient
        amount: chequeToEndorse.amount,
        type: "صادر", // Outgoing
        chequeType: "مجير", // Mark as endorsed check
        status: "قيد الانتظار", // Can be linked to ledger/invoice
        linkedTransactionId: endorseTransactionId.trim() || "", // Link to supplier invoice if provided
        issueDate: chequeToEndorse.issueDate,
        dueDate: chequeToEndorse.dueDate,
        bankName: chequeToEndorse.bankName,
        notes: `شيك مظهر من العميل: ${chequeToEndorse.clientName}`,
        createdAt: new Date(),
        endorsedFromId: chequeToEndorse.id, // Link back to incoming cheque
        isEndorsedCheque: true, // Special flag
      });

      // 3. Update incoming cheque with outgoing reference
      await updateDoc(incomingChequeRef, {
        endorsedToOutgoingId: outgoingChequeDoc.id,
      });

      // 4. Create payment record for original client (decrease receivable)
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
        endorsementChequeId: chequeToEndorse.id, // Link to cheque for reversal
      });

      // 5. Create payment record for supplier (decrease payable)
      await addDoc(paymentsRef, {
        clientName: endorseToSupplier,
        amount: chequeToEndorse.amount,
        type: "صرف",
        linkedTransactionId: endorseTransactionId.trim() || chequeToEndorse.linkedTransactionId || "",
        date: new Date(),
        notes: `استلام شيك مجيّر رقم ${chequeToEndorse.chequeNumber} من العميل: ${chequeToEndorse.clientName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: chequeToEndorse.id, // Link to cheque for reversal
      });

      toast({
        title: "تم التظهير بنجاح",
        description: `تم تظهير الشيك رقم ${chequeToEndorse.chequeNumber} إلى ${endorseToSupplier}`,
      });

      setEndorseDialogOpen(false);
      setChequeToEndorse(null);
      setEndorseToSupplier("");
      setEndorseTransactionId("");
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

  const handleCancelEndorsement = (cheque: Cheque) => {
    if (!user) {return;}

    confirm(
      "إلغاء التظهير",
      `هل أنت متأكد من إلغاء تظهير الشيك رقم ${cheque.chequeNumber}؟ سيتم حذف حركات التظهير المرتبطة والشيك من الصادرة.`,
      async () => {
        setLoading(true);
        try {
          // 1. Delete the outgoing cheque entry if it exists
          if ((cheque as any).endorsedToOutgoingId) {
            const outgoingChequeRef = doc(
              firestore,
              `users/${user.uid}/cheques`,
              (cheque as any).endorsedToOutgoingId
            );
            await deleteDoc(outgoingChequeRef);
          }

          // 2. Revert incoming cheque to pending status
          const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
          await updateDoc(chequeRef, {
            chequeType: "عادي",
            status: "قيد الانتظار",
            endorsedTo: null,
            endorsedDate: null,
            endorsedToOutgoingId: null,
          });

          // 3. Delete endorsement payment records
          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const paymentsSnapshot = await getDocs(
            query(paymentsRef, where("endorsementChequeId", "==", cheque.id))
          );

          const deletePromises = paymentsSnapshot.docs.map((doc) =>
            deleteDoc(doc.ref)
          );
          await Promise.all(deletePromises);

          toast({
            title: "تم إلغاء التظهير",
            description: `تم إلغاء تظهير الشيك رقم ${cheque.chequeNumber} بنجاح`,
          });
        } catch (error) {
          console.error("Error canceling endorsement:", error);
          toast({
            title: "خطأ",
            description: "حدث خطأ أثناء إلغاء التظهير",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      },
      "warning"
    );
  };

  // Calculate summary statistics
  const pendingCheques = cheques.filter(c => c.status === "قيد الانتظار");
  const clearedCheques = cheques.filter(c => c.status === "تم الصرف");
  const endorsedCheques = cheques.filter(c => c.status === "مجيّر");
  const bouncedCheques = cheques.filter(c => c.status === "مرفوض");

  const totalPendingValue = pendingCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalClearedValue = clearedCheques.reduce((sum, c) => sum + c.amount, 0);

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
          {cheques.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد شيكات واردة مسجلة. اضغط على &quot;إضافة شيك وارد&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الشيك</TableHead>
                  <TableHead>اسم العميل</TableHead>
                  <TableHead>البنك</TableHead>
                  <TableHead>المبلغ</TableHead>
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
                      <div className="space-y-1">
                        <div className="font-medium">{cheque.clientName}</div>
                        {cheque.endorsedTo && (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              ← مظهر إلى: {cheque.endorsedTo}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cheque.bankName}</TableCell>
                    <TableCell>{cheque.amount || 0} دينار</TableCell>
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
                        {/* Show endorse button only for pending cheques that are not endorsed */}
                        {cheque.status === "قيد الانتظار" &&
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
                        {/* Show cancel endorsement button for endorsed cheques */}
                        {cheque.status === "مجيّر" &&
                          cheque.chequeType === "مجير" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelEndorsement(cheque)}
                              title="إلغاء التظهير"
                              className="border-purple-300 text-purple-700 hover:bg-purple-50"
                            >
                              <X className="w-4 h-4" />
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
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCheque ? "تعديل الشيك الوارد" : "إضافة شيك وارد جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingCheque
                ? "قم بتعديل بيانات الشيك أدناه"
                : "أدخل بيانات الشيك الوارد الجديد أدناه"}
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
            <div className="space-y-2">
              <Label htmlFor="endorseTransactionId">
                رقم المعاملة / الفاتورة (اختياري)
                <span className="text-xs text-gray-500 block mt-1">
                  لربط الشيك بفاتورة المورد في دفتر الأستاذ
                </span>
              </Label>
              <Input
                id="endorseTransactionId"
                value={endorseTransactionId}
                onChange={(e) => setEndorseTransactionId(e.target.value)}
                placeholder="TXN-20250109-123456-789"
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
