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
import { Plus, Edit, Trash2, Download, Layers } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { exportPaymentsToExcel } from "@/lib/export-utils";
import { MultiAllocationDialog } from "./MultiAllocationDialog";
import { usePaymentAllocations } from "./hooks/usePaymentAllocations";
import { isMultiAllocationPayment } from "@/lib/arap-utils";
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
  startAfter,
  getCountFromServer,
  DocumentSnapshot,
  QueryConstraint,
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
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { assertNonNegative, isDataIntegrityError } from "@/lib/errors";
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
  // Multi-allocation fields
  isMultiAllocation?: boolean;
  totalAllocated?: number;
  allocationMethod?: 'fifo' | 'manual';
  allocationCount?: number;
  allocationTransactionIds?: string[]; // Array of transaction IDs
}

export default function PaymentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiAllocationDialogOpen, setIsMultiAllocationDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Multi-allocation hook for delete reversal
  const { reversePaymentAllocations } = usePaymentAllocations();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / pageSize);
  // Store the last document of each page for cursor-based pagination
  const [pageCursors, setPageCursors] = useState<Map<number, DocumentSnapshot>>(new Map());

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

  // Fetch total count
  useEffect(() => {
    if (!user) { return; }

    const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
    getCountFromServer(query(paymentsRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch payments with cursor-based pagination
  useEffect(() => {
    if (!user) {return;}

    const paymentsRef = collection(firestore, `users/${user.uid}/payments`);

    // Build query constraints
    const queryConstraints: QueryConstraint[] = [
      orderBy("date", "desc"),
      limit(pageSize)
    ];

    // For pages > 1, use the cursor from the previous page
    if (currentPage > 1) {
      const cursor = pageCursors.get(currentPage - 1);
      if (cursor) {
        queryConstraints.push(startAfter(cursor));
      }
    }

    const q = query(paymentsRef, ...queryConstraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData: Payment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        paymentsData.push({
          id: docSnap.id,
          ...convertFirestoreDates(data),
        } as Payment);
      });

      // Store the last document as cursor for the next page
      if (snapshot.docs && snapshot.docs.length > 0) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setPageCursors(prev => {
          const newMap = new Map(prev);
          newMap.set(currentPage, lastDoc);
          return newMap;
        });
      }

      setPayments(paymentsData);
      setDataLoading(false);
    });

    return () => unsubscribe();
    // Note: pageCursors intentionally excluded to avoid infinite loops - we only read from it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pageSize, currentPage]);

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

  const handleDelete = (paymentId: string) => {
    if (!user) {return;}

    const payment = payments.find((p) => p.id === paymentId);
    const isMultiAlloc = payment && isMultiAllocationPayment(payment);

    confirm(
      "حذف المدفوعة",
      isMultiAlloc
        ? `هل أنت متأكد من حذف هذه المدفوعة الموزعة على ${payment.allocationCount} معاملة؟ سيتم إلغاء جميع التخصيصات.`
        : "هل أنت متأكد من حذف هذه المدفوعة؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          if (isMultiAlloc) {
            // Use multi-allocation reversal logic
            const success = await reversePaymentAllocations(paymentId);
            if (success) {
              toast({
                title: "تم الحذف",
                description: `تم حذف المدفوعة وإلغاء ${payment.allocationCount} تخصيص`,
              });
            } else {
              toast({
                title: "خطأ",
                description: "حدث خطأ أثناء حذف المدفوعة",
                variant: "destructive",
              });
            }
            return;
          }

          // Original single-transaction delete logic
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

                // Fail fast on negative totalPaid - this indicates data corruption
                const newTotalPaid = assertNonNegative(currentTotalPaid - payment.amount, {
                  operation: 'reversePaymentDelete',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });
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
          if (isDataIntegrityError(error)) {
            toast({
              title: "خطأ في سلامة البيانات",
              description: "المبلغ المدفوع سيصبح سالباً. قد يكون هناك تكرار في عملية الحذف.",
              variant: "destructive",
            });
          } else {
            const appError = handleError(error);
            toast({
              title: getErrorTitle(appError),
              description: appError.message,
              variant: "destructive",
            });
          }
        }
      },
      "destructive"
    );
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
        <PermissionGate action="create" module="payments">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsMultiAllocationDialogOpen(true)}
              aria-label="إضافة دفعة متعددة"
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              دفعة متعددة
            </Button>
            <Button className="gap-2" onClick={openAddDialog} aria-label="إضافة مدفوعة جديدة">
              <Plus className="w-4 h-4" aria-hidden="true" />
              إضافة مدفوعة
            </Button>
          </div>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dataLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">سجل المدفوعات ({payments.length})</h2>
          {payments.length > 0 && (
            <PermissionGate action="export" module="payments">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPaymentsToExcel(payments, `المدفوعات_${new Date().toISOString().split('T')[0]}`)}
                aria-label="تصدير المدفوعات إلى ملف Excel"
              >
                <Download className="w-4 h-4 ml-2" aria-hidden="true" />
                Excel
              </Button>
            </PermissionGate>
          )}
        </div>
        {dataLoading ? (
          <TableSkeleton rows={10} />
        ) : payments.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            لا توجد مدفوعات مسجلة. اضغط على &quot;إضافة مدفوعة&quot; للبدء.
          </p>
        ) : (
          <div className="card-modern overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">اسم العميل</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">النوع</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الفئة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">رقم المعاملة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">ملاحظات</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="table-row-hover">
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.clientName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span
                          className={payment.type === "قبض" ? "badge-success" : "badge-danger"}
                          role="status"
                          aria-label={`النوع: ${payment.type}`}
                        >
                          {payment.type}
                        </span>
                        {payment.isEndorsement && (
                          <span className="badge-primary">
                            تظهير شيك
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        {payment.category && (
                          <>
                            <span className="font-medium text-slate-700">{payment.category}</span>
                            {payment.subCategory && (
                              <span className="text-xs text-slate-500">{payment.subCategory}</span>
                            )}
                          </>
                        )}
                        {!payment.category && <span className="text-slate-400 text-xs">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${payment.type === "قبض" ? 'text-green-600' : 'text-red-600'}`}>
                        {(payment.amount || 0).toLocaleString()} دينار
                      </span>
                    </TableCell>
                    <TableCell>
                      {payment.isMultiAllocation && payment.allocationTransactionIds?.length ? (
                        <div className="flex flex-col gap-1">
                          {payment.allocationTransactionIds.map((txnId, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="font-mono text-xs text-purple-700">
                                {txnId}
                              </span>
                              <CopyButton text={txnId} size="sm" />
                            </div>
                          ))}
                        </div>
                      ) : payment.isMultiAllocation ? (
                        <span className="badge-primary">
                          {payment.allocationCount} معاملات
                        </span>
                      ) : payment.linkedTransactionId ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {payment.linkedTransactionId}
                          </span>
                          <CopyButton text={payment.linkedTransactionId} size="sm" />
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{payment.notes}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" role="group" aria-label="إجراءات المدفوعة">
                        <PermissionGate action="update" module="payments">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            onClick={() => handleEdit(payment)}
                            aria-label={`تعديل مدفوعة ${payment.clientName}`}
                          >
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" module="payments">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(payment.id)}
                            aria-label={`حذف مدفوعة ${payment.clientName}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              عرض {payments.length} من {totalCount} مدفوعة
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
      </div>

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

      {confirmationDialog}

      {/* Multi-Allocation Payment Dialog */}
      <MultiAllocationDialog
        open={isMultiAllocationDialogOpen}
        onOpenChange={setIsMultiAllocationDialogOpen}
      />
    </div>
  );
}
