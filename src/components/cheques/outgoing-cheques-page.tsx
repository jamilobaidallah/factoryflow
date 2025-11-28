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
import { Plus, Edit, Trash2, Image as ImageIcon, Link, Upload, X } from "lucide-react";
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
  limit,
  where,
  getDocs,
} from "firebase/firestore";
import { firestore, storage } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface Cheque {
  id: string;
  chequeNumber: string;
  clientName: string;
  amount: number;
  type: string; // "وارد" or "صادر"
  chequeType?: string; // "عادي" or "مجير"
  status: string; // "قيد الانتظار" or "تم الصرف" or "ملغي"
  chequeImageUrl?: string;
  linkedTransactionId: string;
  issueDate: Date;
  dueDate: Date;
  bankName: string;
  notes: string;
  createdAt: Date;
  isEndorsedCheque?: boolean;
  endorsedFromId?: string;
}

export default function OutgoingChequesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [chequeToLink, setChequeToLink] = useState<Cheque | null>(null);
  const [linkTransactionId, setLinkTransactionId] = useState("");

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
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
    // Limit to 1000 most recent cheques, filter client-side for type
    const q = query(chequesRef, orderBy("dueDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chequesData: Cheque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filter for outgoing cheques only
        if (data.type === "صادر") {
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

        // Check if status changed from pending to cleared/cashed
        const oldStatus = editingCheque.status;
        const newStatus = formData.status;
        const pendingStatuses = ["قيد الانتظار", "pending"];
        const clearedStatuses = ["تم الصرف", "cleared", "محصل", "cashed"];
        const wasPending = pendingStatuses.includes(oldStatus);
        const isNowCleared = clearedStatuses.includes(newStatus);

        if (wasPending && isNowCleared) {
          // Add cleared date when status changes to cleared
          updateData.clearedDate = new Date();

          // Create a Payment record (disbursement for outgoing cheque)
          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const chequeAmount = parseFloat(formData.amount);

          await addDoc(paymentsRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: "صرف", // Disbursement - we paid the supplier
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            date: new Date(),
            notes: `صرف شيك رقم ${formData.chequeNumber}`,
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

                let newPaymentStatus: "paid" | "unpaid" | "partial" = "unpaid";
                if (newRemainingBalance <= 0) {
                  newPaymentStatus = "paid";
                } else if (newTotalPaid > 0) {
                  newPaymentStatus = "partial";
                }

                await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
                  totalPaid: newTotalPaid,
                  remainingBalance: newRemainingBalance,
                  paymentStatus: newPaymentStatus,
                });
              }
            }
          }
        }

        await updateDoc(chequeRef, updateData);
        toast({
          title: "تم التحديث بنجاح",
          description: wasPending && isNowCleared
            ? `تم صرف الشيك رقم ${formData.chequeNumber} وإنشاء سند صرف`
            : "تم تحديث بيانات الشيك الصادر",
        });
      } else {
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: "صادر", // Always outgoing
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
          createdAt: new Date(),
          ...(chequeImageUrl && { chequeImageUrl }),
        });
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة شيك صادر جديد",
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
      case "ملغي":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
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
    if (!user || !chequeToLink) {return;}

    setLoading(true);
    try {
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeToLink.id);
      await updateDoc(chequeRef, {
        linkedTransactionId: linkTransactionId.trim(),
      });

      toast({
        title: "تم الربط بنجاح",
        description: linkTransactionId.trim()
          ? `تم ربط الشيك بالمعاملة ${linkTransactionId}`
          : "تم إلغاء ربط الشيك بالمعاملة",
      });

      setLinkDialogOpen(false);
      setChequeToLink(null);
      setLinkTransactionId("");
    } catch (error) {
      console.error("Error linking transaction:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء ربط الشيك بالمعاملة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const pendingCheques = cheques.filter(c => c.status === "قيد الانتظار");
  const cashedCheques = cheques.filter(c => c.status === "تم الصرف");
  const cancelledCheques = cheques.filter(c => c.status === "ملغي");
  const endorsedCheques = cheques.filter(c => c.isEndorsedCheque);

  const totalPendingValue = pendingCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalCashedValue = cashedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalEndorsedValue = endorsedCheques.reduce((sum, c) => sum + c.amount, 0);

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
            <div className="text-2xl font-bold text-green-600">{cashedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalCashedValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">شيكات مظهرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{endorsedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalEndorsedValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ملغي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancelledCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">شيكات ملغاة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الشيكات الصادرة ({cheques.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cheques.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد شيكات صادرة مسجلة. اضغط على &quot;إضافة شيك صادر&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الشيك</TableHead>
                  <TableHead>اسم المستفيد</TableHead>
                  <TableHead>البنك</TableHead>
                  <TableHead>المبلغ</TableHead>
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
                      <div className="space-y-1">
                        <div>{cheque.chequeNumber}</div>
                        {cheque.isEndorsedCheque && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            شيك مظهر
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{cheque.clientName}</div>
                        {cheque.notes && cheque.isEndorsedCheque && (
                          <div className="text-xs text-gray-500">{cheque.notes}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cheque.bankName}</TableCell>
                    <TableCell>{cheque.amount || 0} دينار</TableCell>
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
                      {cheque.linkedTransactionId ? (
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                          {cheque.linkedTransactionId}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
                        {!cheque.isEndorsedCheque ? (
                          <>
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
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openLinkDialog(cheque)}
                            title="ربط بفاتورة"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Link className="w-4 h-4" />
                          </Button>
                        )}
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
              {editingCheque ? "تعديل الشيك الصادر" : "إضافة شيك صادر جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingCheque
                ? "قم بتعديل بيانات الشيك أدناه"
                : "أدخل بيانات الشيك الصادر الجديد أدناه"}
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
                  <Label htmlFor="clientName">اسم المستفيد (المورد)</Label>
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
                  <option value="ملغي">ملغي</option>
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

      {/* Link Transaction Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ربط الشيك بفاتورة المورد</DialogTitle>
            <DialogDescription>
              {chequeToLink && (
                <div className="text-sm mt-2 space-y-1">
                  <p><strong>رقم الشيك:</strong> {chequeToLink.chequeNumber}</p>
                  <p><strong>المورد:</strong> {chequeToLink.clientName}</p>
                  <p><strong>المبلغ:</strong> {chequeToLink.amount} دينار</p>
                  <p className="text-blue-600 mt-2">
                    💡 أدخل رقم المعاملة من دفتر الأستاذ لربط الشيك بفاتورة المورد
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="linkTransactionId">
                رقم المعاملة / الفاتورة
                <span className="text-xs text-gray-500 block mt-1">
                  اتركه فارغاً لإلغاء الربط
                </span>
              </Label>
              <Input
                id="linkTransactionId"
                value={linkTransactionId}
                onChange={(e) => setLinkTransactionId(e.target.value)}
                placeholder="TXN-20250109-123456-789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleLinkTransaction}
              disabled={loading}
            >
              {loading ? "جاري الحفظ..." : "حفظ الربط"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
