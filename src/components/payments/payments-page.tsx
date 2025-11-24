"use client";

import { useState, useEffect } from "react";
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
import { Plus, Edit, Trash2 } from "lucide-react";
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
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { CopyButton } from "@/components/ui/copy-button";

// Categories with subcategories (matching ledger categories)
const CATEGORIES = [
  // Income Categories
  {
    name: "إيرادات المبيعات",
    type: "دخل",
    subcategories: ["مبيعات منتجات", "خدمات", "استشارات", "عمولات"]
  },
  {
    name: "رأس المال",
    type: "دخل",
    subcategories: ["رأس مال مالك", "سحوبات المالك"]
  },
  {
    name: "إيرادات أخرى",
    type: "دخل",
    subcategories: ["فوائد بنكية", "بيع أصول", "إيرادات متنوعة"]
  },
  // Expense Categories
  {
    name: "تكلفة البضاعة المباعة (COGS)",
    type: "مصروف",
    subcategories: ["مواد خام", "شحن", "شراء بضاعة جاهزة"]
  },
  {
    name: "مصاريف تشغيلية",
    type: "مصروف",
    subcategories: [
      "رواتب وأجور", "إيجارات", "كهرباء وماء", "صيانة",
      "وقود ومواصلات", "رحلة عمل", "نقل بضاعة", "تسويق وإعلان",
      "مصاريف إدارية", "اتصالات وإنترنت", "مصاريف مكتبية"
    ]
  },
  {
    name: "أصول ثابتة",
    type: "مصروف",
    subcategories: [
      "معدات وآلات", "أثاث ومفروشات", "سيارات ومركبات",
      "مباني وعقارات", "أجهزة كمبيوتر"
    ]
  },
  {
    name: "التزامات مالية",
    type: "مصروف",
    subcategories: ["سداد قروض", "فوائد قروض", "ضرائب ورسوم"]
  },
  {
    name: "مصاريف أخرى",
    type: "مصروف",
    subcategories: ["مصاريف قانونية", "تأمينات", "مصاريف متنوعة"]
  },
];

interface Payment {
  id: string;
  clientName: string;
  amount: number;
  type: string; // "قبض" or "صرف"
  linkedTransactionId: string; // Link to ledger transaction
  date: Date;
  notes: string;
  category?: string; // Added for better payment categorization
  subCategory?: string; // Added for detailed payment categorization
  createdAt: Date;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
  endorsementChequeId?: string;
}

export default function PaymentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    clientName: "",
    amount: "",
    type: "قبض",
    linkedTransactionId: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    category: "",
    subCategory: "",
  });

  useEffect(() => {
    if (!user) {return;}

    const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
    const q = query(paymentsRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData: Payment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as Payment);
      });
      setPayments(paymentsData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      if (editingPayment) {
        const paymentRef = doc(firestore, `users/${user.uid}/payments`, editingPayment.id);
        await updateDoc(paymentRef, {
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: formData.type,
          linkedTransactionId: formData.linkedTransactionId,
          date: new Date(formData.date),
          notes: formData.notes,
          category: formData.category || null,
          subCategory: formData.subCategory || null,
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات المدفوعة",
        });
      } else {
        const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
        const paymentAmount = parseFloat(formData.amount);

        await addDoc(paymentsRef, {
          clientName: formData.clientName,
          amount: paymentAmount,
          type: formData.type,
          linkedTransactionId: formData.linkedTransactionId,
          date: new Date(formData.date),
          notes: formData.notes,
          category: formData.category || null,
          subCategory: formData.subCategory || null,
          createdAt: new Date(),
        });

        // Update AR/AP tracking if linkedTransactionId is provided
        let arapUpdated = false;
        let debugMessage = "";

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

            // Only update if AR/AP tracking is enabled for this transaction
            if (ledgerData.isARAPEntry) {
              const currentTotalPaid = ledgerData.totalPaid || 0;
              const transactionAmount = ledgerData.amount || 0;
              const newTotalPaid = currentTotalPaid + paymentAmount;
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

              arapUpdated = true;
              debugMessage = `تم تحديث: المدفوع ${newTotalPaid.toFixed(2)} - المتبقي ${newRemainingBalance.toFixed(2)}`;
            } else {
              debugMessage = "⚠ الحركة المالية لا تتبع نظام الذمم. فعّل 'تتبع الذمم' في دفتر الأستاذ";
            }
          } else {
            debugMessage = `⚠ لم يتم العثور على حركة مالية برقم: ${formData.linkedTransactionId}`;
          }
        }

        toast({
          title: "تمت الإضافة بنجاح",
          description: debugMessage || "تم إضافة مدفوعة جديدة",
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

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      clientName: payment.clientName || "",
      amount: (payment.amount || 0).toString(),
      type: payment.type || "قبض",
      linkedTransactionId: payment.linkedTransactionId || "",
      date: payment.date ? new Date(payment.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      notes: payment.notes || "",
      category: payment.category || "",
      subCategory: payment.subCategory || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (paymentId: string) => {
    if (!user) {return;}
    if (!confirm("هل أنت متأكد من حذف هذه المدفوعة؟")) {return;}

    try {
      // First, get the payment data to access linkedTransactionId and amount
      const payment = payments.find((p) => p.id === paymentId);

      if (payment && payment.linkedTransactionId) {
        // Reverse AR/AP update before deleting
        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        const ledgerQuery = query(
          ledgerRef,
          where("transactionId", "==", payment.linkedTransactionId.trim())
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (!ledgerSnapshot.empty) {
          const ledgerDoc = ledgerSnapshot.docs[0];
          const ledgerData = ledgerDoc.data();

          if (ledgerData.isARAPEntry) {
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const transactionAmount = ledgerData.amount || 0;
            const newTotalPaid = Math.max(0, currentTotalPaid - payment.amount);
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

      // Now delete the payment
      const paymentRef = doc(firestore, `users/${user.uid}/payments`, paymentId);
      await deleteDoc(paymentRef);

      toast({
        title: "تم الحذف",
        description: payment?.linkedTransactionId
          ? "تم حذف المدفوعة وتحديث الرصيد في دفتر الأستاذ"
          : "تم حذف المدفوعة بنجاح",
      });
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      clientName: "",
      amount: "",
      type: "قبض",
      linkedTransactionId: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      category: "",
      subCategory: "",
    });
    setEditingPayment(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const totalReceived = payments
    .filter((p) => p.type === "قبض" && !p.noCashMovement)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPaid = payments
    .filter((p) => p.type === "صرف" && !p.noCashMovement)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المدفوعات</h1>
          <p className="text-gray-600 mt-2">تتبع عمليات القبض والصرف</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة مدفوعة
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>إجمالي المقبوضات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {totalReceived} دينار
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>إجمالي المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {totalPaid} دينار
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل المدفوعات ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد مدفوعات مسجلة. اضغط على &quot;إضافة مدفوعة&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>اسم العميل</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>رقم المعاملة</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.clientName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            payment.type === "قبض"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {payment.type}
                        </span>
                        {payment.isEndorsement && (
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                            تظهير شيك
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        {payment.category && (
                          <>
                            <span className="font-medium text-gray-700">{payment.category}</span>
                            {payment.subCategory && (
                              <span className="text-xs text-gray-500">{payment.subCategory}</span>
                            )}
                          </>
                        )}
                        {!payment.category && <span className="text-gray-400 text-xs">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>{payment.amount || 0} دينار</TableCell>
                    <TableCell>
                      {payment.linkedTransactionId ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {payment.linkedTransactionId}
                          </span>
                          <CopyButton text={payment.linkedTransactionId} size="sm" />
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{payment.notes}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(payment)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(payment.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? "تعديل المدفوعة" : "إضافة مدفوعة جديدة"}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? "قم بتعديل بيانات المدفوعة أدناه"
                : "أدخل بيانات المدفوعة الجديدة أدناه"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
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
                  <option value="قبض">قبض</option>
                  <option value="صرف">صرف</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة (اختياري)</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => {
                    setFormData({ ...formData, category: e.target.value, subCategory: "" });
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">اختر الفئة</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              {formData.category && (
                <div className="space-y-2">
                  <Label htmlFor="subCategory">الفئة الفرعية (اختياري)</Label>
                  <select
                    id="subCategory"
                    value={formData.subCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subCategory: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">اختر الفئة الفرعية</option>
                    {CATEGORIES.find(c => c.name === formData.category)?.subcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <Label htmlFor="date">التاريخ</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
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
                {loading ? "جاري الحفظ..." : editingPayment ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
