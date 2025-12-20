"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Copy,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  FileText,
  Download,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { formatShortDate } from "@/lib/date-utils";
import { exportStatementToPDF } from "@/lib/export-statement-pdf";
import { exportStatementToExcel } from "@/lib/export-statement-excel";
import {
  formatCurrency,
  formatStatementDate,
  getDateRange,
  extractPaymentMethod
} from "@/lib/statement-format";

// Aliases for backward compatibility with existing code
const formatNumber = formatCurrency;
const formatDateAr = formatStatementDate;

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  createdAt: Date;
}

interface LedgerEntry {
  id: string;
  transactionId?: string;
  type: string;
  amount: number;
  date: Date;
  category: string;
  subCategory?: string;
  description: string;
  associatedParty?: string;
  remainingBalance?: number;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  date: Date;
  description: string;
  paymentMethod: string;
  notes: string;  // Payment method info is stored in notes field
  associatedParty?: string;
}

interface Cheque {
  id: string;
  chequeNumber: string;
  amount: number;
  issueDate: Date;
  dueDate?: Date;
  bankName: string;
  status: string;
  type: string;
  associatedParty?: string;
}

interface StatementItem {
  id: string;
  transactionId?: string;
  source: 'ledger' | 'payment';
  date: Date;
  isPayment: boolean;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  // Ledger-specific
  category?: string;
  subCategory?: string;
  // Payment-specific
  notes?: string;
}

interface ClientDetailPageProps {
  clientId: string;
}

export default function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial metrics
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalPaymentsReceived, setTotalPaymentsReceived] = useState(0);
  const [totalPaymentsMade, setTotalPaymentsMade] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);

  // Modal state for transaction details
  const [selectedTransaction, setSelectedTransaction] = useState<StatementItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Date filter state for statement
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Load client data
  useEffect(() => {
    if (!user || !clientId) {return;}

    const clientRef = doc(firestore, `users/${user.dataOwnerId}/clients`, clientId);
    getDoc(clientRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setClient({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Client);
        } else {
          toast({
            title: "خطأ",
            description: "العميل غير موجود",
            variant: "destructive",
          });
          router.push("/clients");
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading client:", error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء تحميل بيانات العميل",
          variant: "destructive",
        });
        setLoading(false);
      });
  }, [user, clientId, router, toast]);

  // Load ledger entries for this client
  useEffect(() => {
    if (!user || !client) {return;}

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const q = query(
      ledgerRef,
      where("associatedParty", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries: LedgerEntry[] = [];
        let sales = 0;
        let purchases = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const entry = {
            id: doc.id,
            ...data,
            date: data.date?.toDate?.() || new Date(),
          } as LedgerEntry;
          entries.push(entry);

          // Calculate totals
          if (entry.type === "دخل" || entry.type === "إيراد") {
            sales += entry.amount;
          } else if (entry.type === "مصروف") {
            purchases += entry.amount;
          }
        });

        // Sort by date in JavaScript instead of Firestore
        entries.sort((a, b) => b.date.getTime() - a.date.getTime());

        setLedgerEntries(entries);
        setTotalSales(sales);
        setTotalPurchases(purchases);
      },
      (error) => {
        console.error("Error loading ledger entries:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  // Load payments for this client
  useEffect(() => {
    if (!user || !client) {return;}

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    const q = query(
      paymentsRef,
      where("clientName", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentsList: Payment[] = [];
        let received = 0;
        let made = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const payment = {
            id: doc.id,
            ...data,
            date: data.date?.toDate?.() || new Date(),
          } as Payment;
          paymentsList.push(payment);

          // Calculate totals
          if (payment.type === "قبض") {
            received += payment.amount;
          } else if (payment.type === "صرف") {
            made += payment.amount;
          }
        });

        // Sort by date in JavaScript
        paymentsList.sort((a, b) => b.date.getTime() - a.date.getTime());

        setPayments(paymentsList);
        setTotalPaymentsReceived(received);
        setTotalPaymentsMade(made);
      },
      (error) => {
        console.error("Error loading payments:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  // Load cheques for this client
  useEffect(() => {
    if (!user || !client) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const q = query(
      chequesRef,
      where("clientName", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chequesList: Cheque[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          chequesList.push({
            id: doc.id,
            ...data,
            issueDate: data.issueDate?.toDate?.() || new Date(),
            dueDate: data.dueDate?.toDate?.() || data.issueDate?.toDate?.() || new Date(),
          } as Cheque);
        });
        // Sort by issue date in JavaScript
        chequesList.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
        setCheques(chequesList);
      },
      (error) => {
        console.error("Error loading cheques:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  // Calculate current balance
  useEffect(() => {
    const balance = totalSales - totalPurchases - (totalPaymentsReceived - totalPaymentsMade);
    setCurrentBalance(balance);
  }, [totalSales, totalPurchases, totalPaymentsReceived, totalPaymentsMade]);

  // Export statement to Excel
  const exportStatement = async () => {
    if (!client) {return;}

    // Combine all transactions (same logic as statement tab and PDF export)
    const allTxns = [
      ...ledgerEntries.map((e) => ({
        date: e.date,
        type: "Invoice" as const,
        description: e.description,
        debit: e.type === "دخل" || e.type === "إيراد" ? e.amount : 0,
        credit: e.type === "مصروف" ? e.amount : 0,
        balance: 0,
      })),
      ...payments.map((p) => ({
        date: p.date,
        type: "Payment" as const,
        description: p.notes || p.description || '',
        debit: p.type === "صرف" ? p.amount : 0,
        credit: p.type === "قبض" ? p.amount : 0,
        balance: 0,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate balances
    const clientInitialBalance = client?.balance || 0;
    let runningBalance = clientInitialBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const txnsWithBalance = allTxns.map((t) => {
      totalDebit += t.debit;
      totalCredit += t.credit;
      runningBalance += t.debit - t.credit;
      return { ...t, balance: runningBalance };
    });

    // Get pending cheques
    const pendingCheques = cheques
      .filter((c) => c.status === "قيد الانتظار")
      .map((c) => ({
        chequeNumber: c.chequeNumber,
        bankName: c.bankName,
        dueDate: c.dueDate || c.issueDate,
        amount: c.amount,
      }));

    const totalPendingCheques = pendingCheques.reduce((sum, c) => sum + c.amount, 0);

    try {
      await exportStatementToExcel({
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        openingBalance: clientInitialBalance,
        transactions: txnsWithBalance,
        totalDebit,
        totalCredit,
        finalBalance: runningBalance,
        pendingCheques: pendingCheques.length > 0 ? pendingCheques : undefined,
        expectedBalanceAfterCheques: pendingCheques.length > 0 ? runningBalance - totalPendingCheques : undefined,
      });

      toast({
        title: "تم التصدير",
        description: "تم تصدير كشف الحساب بنجاح",
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast({
        title: "خطأ",
        description: "فشل تصدير الملف",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.name}</h1>
            <p className="text-gray-500">{client.phone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportStatement} variant="outline">
            <Download className="w-4 h-4 ml-2" />
            Excel
          </Button>
          <Button
            onClick={async () => {
              // Build statement data for PDF export
              const allTxns = [
                ...ledgerEntries.map((e) => ({
                  date: e.date,
                  description: e.description,
                  debit: e.type === "دخل" || e.type === "إيراد" ? e.amount : 0,
                  credit: e.type === "مصروف" ? e.amount : 0,
                  balance: 0,
                })),
                ...payments.map((p) => ({
                  date: p.date,
                  description: p.notes || p.description || '',
                  debit: p.type === "صرف" ? p.amount : 0,
                  credit: p.type === "قبض" ? p.amount : 0,
                  balance: 0,
                })),
              ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              // Calculate balances
              const clientInitialBalance = client?.balance || 0;
              let runningBalance = clientInitialBalance;
              let totalDebit = 0;
              let totalCredit = 0;

              const txnsWithBalance = allTxns.map((t) => {
                totalDebit += t.debit;
                totalCredit += t.credit;
                runningBalance += t.debit - t.credit;
                return { ...t, balance: runningBalance };
              });

              // Get pending cheques
              const pendingCheques = cheques
                .filter((c) => c.status === "قيد الانتظار")
                .map((c) => ({
                  chequeNumber: c.chequeNumber,
                  bankName: c.bankName,
                  dueDate: c.dueDate || c.issueDate,
                  amount: c.amount,
                }));

              const totalPendingCheques = pendingCheques.reduce((sum, c) => sum + c.amount, 0);

              try {
                await exportStatementToPDF({
                  clientName: client.name,
                  clientPhone: client.phone,
                  clientEmail: client.email,
                  openingBalance: clientInitialBalance,
                  transactions: txnsWithBalance,
                  totalDebit,
                  totalCredit,
                  finalBalance: runningBalance,
                  pendingCheques: pendingCheques.length > 0 ? pendingCheques : undefined,
                  expectedBalanceAfterCheques: pendingCheques.length > 0 ? runningBalance - totalPendingCheques : undefined,
                });

                toast({
                  title: "تم التصدير",
                  description: "تم تصدير كشف الحساب بنجاح",
                });
              } catch (error) {
                console.error('PDF export error:', error);
                toast({
                  title: "خطأ",
                  description: "فشل تصدير الملف",
                  variant: "destructive",
                });
              }
            }}
            variant="outline"
          >
            <FileText className="w-4 h-4 ml-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              إجمالي المبيعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalSales.toFixed(2)} د.أ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {ledgerEntries.filter((e) => e.type === "دخل" || e.type === "إيراد").length} معاملة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              إجمالي المشتريات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalPurchases.toFixed(2)} د.أ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {ledgerEntries.filter((e) => e.type === "مصروف").length} معاملة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              المدفوعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-gray-700">
              <span className="text-green-600">قبض: {totalPaymentsReceived.toFixed(2)}</span>
            </div>
            <div className="text-lg font-semibold text-gray-700">
              <span className="text-red-600">صرف: {totalPaymentsMade.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              الرصيد الحالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                currentBalance >= 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {formatNumber(Math.abs(currentBalance))} د.أ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {currentBalance > 0 ? "عليه" : currentBalance < 0 ? "له" : "(مسدد)"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Client Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات العميل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">الهاتف</p>
              <p className="font-medium">{client.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">البريد الإلكتروني</p>
              <p className="font-medium">{client.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">العنوان</p>
              <p className="font-medium">{client.address || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">تاريخ التسجيل</p>
              <p className="font-medium">{formatShortDate(client.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transactions">المعاملات المالية</TabsTrigger>
          <TabsTrigger value="payments">الدفعات</TabsTrigger>
          <TabsTrigger value="cheques">الشيكات</TabsTrigger>
          <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>المعاملات المالية</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        لا توجد معاملات مالية
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatShortDate(entry.date)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              entry.type === "دخل" || entry.type === "إيراد"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {entry.type}
                          </span>
                        </TableCell>
                        <TableCell>{entry.category}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-left font-medium">
                          {entry.amount.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>الدفعات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        لا توجد دفعات
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatShortDate(payment.date)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              payment.type === "قبض"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {payment.type}
                          </span>
                        </TableCell>
                        <TableCell>{payment.paymentMethod}</TableCell>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell className="text-left font-medium">
                          {payment.amount.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cheques Tab */}
        <TabsContent value="cheques">
          <Card>
            <CardHeader>
              <CardTitle>الشيكات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الشيك</TableHead>
                    <TableHead>تاريخ الإصدار</TableHead>
                    <TableHead>البنك</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cheques.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        لا توجد شيكات
                      </TableCell>
                    </TableRow>
                  ) : (
                    cheques.map((cheque) => (
                      <TableRow key={cheque.id}>
                        <TableCell>{cheque.chequeNumber}</TableCell>
                        <TableCell>{formatShortDate(cheque.issueDate)}</TableCell>
                        <TableCell>{cheque.bankName}</TableCell>
                        <TableCell>{cheque.type}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              cheque.status === "معلق"
                                ? "bg-yellow-100 text-yellow-800"
                                : cheque.status === "مصروف"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {cheque.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-left font-medium">
                          {cheque.amount.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statement Tab - Redesigned Account Statement */}
        <TabsContent value="statement">
          <Card>
            <CardContent className="p-0">
              {(() => {
                // Combine and sort all transactions chronologically
                const allTransactions: StatementItem[] = [
                  ...ledgerEntries.map((e) => ({
                    id: e.id,
                    transactionId: e.transactionId,
                    source: 'ledger' as const,
                    date: e.date,
                    isPayment: false,
                    entryType: e.type,
                    description: e.description,
                    category: e.category,
                    subCategory: e.subCategory,
                    // Income/Sales: amount goes in مدين (client owes us)
                    // Expense/Purchases from them: amount goes in دائن (we owe them)
                    debit: e.type === "دخل" || e.type === "إيراد" ? e.amount : 0,
                    credit: e.type === "مصروف" ? e.amount : 0,
                  })),
                  ...payments.map((p) => ({
                    id: p.id,
                    source: 'payment' as const,
                    date: p.date,
                    isPayment: true,
                    entryType: p.type,
                    description: p.notes || p.description || '',  // Use notes field for payment method
                    notes: p.notes,
                    // Payment received (قبض): goes in دائن (reduces what they owe us)
                    // Payment made (صرف): goes in مدين (reduces what we owe them)
                    debit: p.type === "صرف" ? p.amount : 0,
                    credit: p.type === "قبض" ? p.amount : 0,
                  })),
                ].sort((a, b) => a.date.getTime() - b.date.getTime());

                // Calculate date range (from all transactions, before filtering)
                const dateRange = getDateRange(allTransactions);

                // Calculate opening balance
                // Start with client's initial balance (الرصيد الافتتاحي) from their record
                const clientInitialBalance = client?.balance || 0;
                let openingBalance = clientInitialBalance;

                // If date filter is applied, add all transactions BEFORE the "from" date
                if (dateFrom) {
                  const fromDate = new Date(dateFrom);
                  fromDate.setHours(0, 0, 0, 0);
                  allTransactions.forEach((item) => {
                    const itemDate = new Date(item.date);
                    itemDate.setHours(0, 0, 0, 0);
                    if (itemDate < fromDate) {
                      openingBalance += item.debit - item.credit;
                    }
                  });
                }

                // Filter transactions by date range
                const filteredTransactions = allTransactions.filter((item) => {
                  const itemDate = new Date(item.date);
                  itemDate.setHours(0, 0, 0, 0);

                  if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (itemDate < fromDate) {
                      return false;
                    }
                  }
                  if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (itemDate > toDate) {
                      return false;
                    }
                  }
                  return true;
                });

                // Calculate totals from filtered transactions
                // Running balance starts from opening balance
                let totalDebit = 0;
                let totalCredit = 0;
                let runningBalance = openingBalance;
                const rowsWithBalance = filteredTransactions.map((t) => {
                  totalDebit += t.debit;
                  totalCredit += t.credit;
                  runningBalance += t.debit - t.credit;
                  return { ...t, balance: runningBalance };
                });

                const finalBalance = runningBalance;

                return (
                  <div>
                    {/* Statement Header */}
                    <div className="bg-gradient-to-l from-blue-600 to-blue-800 text-white p-5 rounded-t-lg">
                      <h3 className="text-lg mb-1">كشف حساب</h3>
                      <div className="text-2xl font-bold mb-2">{client.name}</div>
                      {allTransactions.length > 0 && (
                        <div className="text-sm opacity-90">
                          الفترة: من {dateFrom ? format(dateFrom, "dd/MM/yyyy") : formatDateAr(dateRange.oldest)} إلى {dateTo ? format(dateTo, "dd/MM/yyyy") : formatDateAr(dateRange.newest)}
                        </div>
                      )}
                    </div>

                    {/* Date Range Filter Bar */}
                    <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 border-b" dir="rtl">
                      <span className="text-sm font-medium text-gray-600">تصفية حسب التاريخ:</span>

                      {/* From Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">من</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-[140px] justify-start text-right font-normal ${
                                !dateFrom && "text-muted-foreground"
                              }`}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "اختر تاريخ"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* To Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">إلى</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-[140px] justify-start text-right font-normal ${
                                !dateTo && "text-muted-foreground"
                              }`}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "dd/MM/yyyy") : "اختر تاريخ"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Clear Filter Button */}
                      {(dateFrom || dateTo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDateFrom(undefined);
                            setDateTo(undefined);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          مسح الفلتر
                        </Button>
                      )}

                      {/* Show filtered count */}
                      {(dateFrom || dateTo) && (
                        <span className="text-sm text-gray-500 mr-auto">
                          ({filteredTransactions.length} من {allTransactions.length} معاملة)
                        </span>
                      )}
                    </div>

                    {/* Statement Table - RTL column order: الرصيد | دائن | مدين | البيان | التاريخ */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-200">
                            <th colSpan={2} className="px-4 py-3 text-right text-sm font-semibold text-gray-600">الرصيد</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">دائن</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">مدين</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">البيان</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Opening Balance Row */}
                          <tr className="bg-gray-100">
                            <td className={`pl-1 pr-2 py-3 font-medium ${openingBalance > 0 ? 'text-red-600' : openingBalance < 0 ? 'text-green-600' : ''}`}>
                              د.أ {openingBalance > 0 ? 'عليه' : openingBalance < 0 ? 'له' : ''}
                            </td>
                            <td className={`pl-0 pr-4 py-3 font-medium text-left ${openingBalance > 0 ? 'text-red-600' : openingBalance < 0 ? 'text-green-600' : ''}`}>
                              {formatNumber(Math.abs(openingBalance))}
                            </td>
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3"></td>
                            <td colSpan={2} className="px-4 py-3 text-right font-medium text-gray-600">رصيد افتتاحي</td>
                          </tr>

                          {/* Transaction Rows */}
                          {rowsWithBalance.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                لا توجد معاملات
                              </td>
                            </tr>
                          ) : (
                            rowsWithBalance.map((transaction, index) => (
                              <tr
                                key={index}
                                onClick={() => {
                                  setSelectedTransaction(transaction);
                                  setIsModalOpen(true);
                                }}
                                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                              >
                                <td className={`pl-1 pr-2 py-3 text-sm font-semibold ${transaction.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  د.أ {transaction.balance > 0 ? 'عليه' : transaction.balance < 0 ? 'له' : ''}
                                </td>
                                <td className={`pl-0 pr-4 py-3 text-sm font-semibold text-left ${transaction.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatNumber(Math.abs(transaction.balance))}
                                </td>
                                <td className="px-4 py-3 text-sm text-green-600 font-medium">
                                  {transaction.credit > 0 ? formatNumber(transaction.credit) : ''}
                                </td>
                                <td className="px-4 py-3 text-sm text-red-600 font-medium">
                                  {transaction.debit > 0 ? formatNumber(transaction.debit) : ''}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                                      transaction.isPayment
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {transaction.isPayment ? 'دفعة' : 'فاتورة'}
                                    </span>
                                    <span>
                                      {transaction.isPayment
                                        ? extractPaymentMethod(transaction.description)
                                        : transaction.description}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm">{formatDateAr(transaction.date)}</td>
                              </tr>
                            ))
                          )}

                          {/* Totals Row */}
                          {rowsWithBalance.length > 0 && (
                            <tr className="bg-blue-800 text-white font-semibold">
                              <td className="pl-1 pr-0 py-4"></td>
                              <td className="pl-0 pr-4 py-4"></td>
                              <td className="px-4 py-4">{formatNumber(totalCredit)}</td>
                              <td className="px-4 py-4">{formatNumber(totalDebit)}</td>
                              <td className="px-4 py-4">المجموع</td>
                              <td className="px-4 py-4"></td>
                            </tr>
                          )}

                          {/* Final Balance Row */}
                          {rowsWithBalance.length > 0 && (
                            <tr className="bg-green-50">
                              <td className={`pl-1 pr-2 py-4 font-bold ${finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                د.أ {finalBalance > 0 ? 'عليه' : finalBalance < 0 ? 'له' : '(مسدد)'}
                              </td>
                              <td className={`pl-0 pr-4 py-4 font-bold text-lg text-left ${finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatNumber(Math.abs(finalBalance))}
                              </td>
                              <td className="px-4 py-4 font-bold text-gray-800" colSpan={3}>
                                الرصيد المستحق
                              </td>
                              <td className="px-4 py-4"></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pending Cheques Section */}
                    {(() => {
                      const pendingCheques = cheques.filter(c => c.status === "قيد الانتظار");
                      if (pendingCheques.length === 0) return null;

                      const totalPendingCheques = pendingCheques.reduce((sum, c) => sum + (c.amount || 0), 0);
                      // Calculate balance after cheques based on cheque type:
                      // - Incoming (وارد): We receive money → subtract from balance (reduces what they owe us)
                      // - Outgoing (صادر): We pay money → add to balance (reduces what we owe them)
                      const incomingTotal = pendingCheques
                        .filter(c => c.type === "وارد")
                        .reduce((sum, c) => sum + (c.amount || 0), 0);
                      const outgoingTotal = pendingCheques
                        .filter(c => c.type === "صادر")
                        .reduce((sum, c) => sum + (c.amount || 0), 0);
                      const balanceAfterCheques = finalBalance - incomingTotal + outgoingTotal;

                      return (
                        <div className="mt-6 border-t-2 border-gray-200 pt-6 px-4" dir="rtl">
                          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                            <span>شيكات قيد الانتظار</span>
                            <span className="bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full">
                              {pendingCheques.length}
                            </span>
                          </h3>

                          <div className="bg-yellow-50 rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-yellow-100">
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">رقم الشيك</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">النوع</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">البنك</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">تاريخ الاستحقاق</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">المبلغ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pendingCheques.map((cheque, index) => (
                                  <tr key={cheque.id} className={index % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                                    <td className="px-4 py-3 text-sm">{cheque.chequeNumber}</td>
                                    <td className="px-4 py-3 text-sm">{cheque.type}</td>
                                    <td className="px-4 py-3 text-sm">{cheque.bankName}</td>
                                    <td className="px-4 py-3 text-sm">
                                      {cheque.dueDate ? formatDateAr(cheque.dueDate) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium">
                                      {formatNumber(cheque.amount)} د.أ
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-yellow-200 font-semibold">
                                  <td colSpan={4} className="px-4 py-3 text-right">إجمالي الشيكات المعلقة</td>
                                  <td className="px-4 py-3">
                                    {formatNumber(totalPendingCheques)} د.أ
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Balance After Cheques Clear */}
                          <div className="mt-4 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
                            <span className="font-medium text-gray-600">الرصيد المتوقع بعد صرف الشيكات:</span>
                            <span className={`text-lg font-bold ${
                              balanceAfterCheques > 0 ? 'text-red-600' : balanceAfterCheques < 0 ? 'text-green-600' : ''
                            }`}>
                              {formatNumber(Math.abs(balanceAfterCheques))} د.أ
                              {balanceAfterCheques > 0 ? ' عليه' : balanceAfterCheques < 0 ? ' له' : ' (مسدد)'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Transaction Detail Modal */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-xl" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">
                  تفاصيل المعاملة
                </DialogTitle>
              </DialogHeader>

              {selectedTransaction && (
                <div className="px-4 py-2 space-y-5 text-right">
                  {/* Transaction Type Badge */}
                  <div className="flex justify-end mb-4">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                      selectedTransaction.isPayment
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedTransaction.isPayment ? 'دفعة' : 'فاتورة'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid gap-4 text-sm px-2">
                    <div className="flex justify-between items-start border-b pb-3">
                      <span className="font-medium">
                        {new Date(selectedTransaction.date).toLocaleDateString('en-GB')}
                      </span>
                      <span className="text-gray-500 mr-4">:التاريخ</span>
                    </div>

                    <div className="flex justify-between items-start border-b pb-3">
                      <span className="font-medium">{selectedTransaction.description || '-'}</span>
                      <span className="text-gray-500 mr-4">:الوصف</span>
                    </div>

                    <div className="flex justify-between items-start border-b pb-3">
                      <span className={`font-bold ${
                        selectedTransaction.debit > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatNumber(selectedTransaction.debit || selectedTransaction.credit || 0)} د.أ
                      </span>
                      <span className="text-gray-500 mr-4">:المبلغ</span>
                    </div>

                    {/* Show category for ledger entries */}
                    {!selectedTransaction.isPayment && selectedTransaction.category && (
                      <div className="flex justify-between items-start border-b pb-3">
                        <span className="font-medium">
                          {selectedTransaction.subCategory || selectedTransaction.category}
                        </span>
                        <span className="text-gray-500 mr-4">:الفئة</span>
                      </div>
                    )}

                    {/* Show payment method for payments */}
                    {selectedTransaction.isPayment && selectedTransaction.notes && (
                      <div className="flex justify-between items-start border-b pb-3">
                        <span className="font-medium">
                          {selectedTransaction.notes.split(' - ')[0]}
                        </span>
                        <span className="text-gray-500 mr-4">:طريقة الدفع</span>
                      </div>
                    )}

                    {/* Transaction ID with Copy Button (for ledger entries) */}
                    {!selectedTransaction.isPayment && selectedTransaction.transactionId && (
                      <div className="flex justify-between items-center border-b pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-600 break-all">
                            {selectedTransaction.transactionId}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(selectedTransaction.transactionId || '');
                              toast({
                                title: "تم النسخ",
                                description: "تم نسخ رقم المعاملة",
                              });
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="نسخ"
                          >
                            <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </button>
                        </div>
                        <span className="text-gray-500 mr-4 shrink-0">:رقم المعاملة</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 px-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const searchId = selectedTransaction.transactionId || selectedTransaction.id;
                        if (selectedTransaction.isPayment) {
                          router.push(`/payments?search=${encodeURIComponent(searchId)}`);
                        } else {
                          router.push(`/ledger?search=${encodeURIComponent(searchId)}`);
                        }
                        setIsModalOpen(false);
                      }}
                    >
                      {selectedTransaction.isPayment ? 'عرض في المدفوعات' : 'عرض في دفتر الأستاذ'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
