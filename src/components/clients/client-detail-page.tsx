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
  Calendar,
  FileText,
  Download,
} from "lucide-react";
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

// ============================================
// Helper functions for account statement
// ============================================

/** Format number with commas and 2 decimal places */
const formatNumber = (num: number): string => {
  return Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/** Format date to DD/MM/YYYY format */
const formatDateAr = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
};

/** Calculate date range from transaction items */
const getDateRange = (items: Array<{ date: Date }>) => {
  if (items.length === 0) return { oldest: new Date(), newest: new Date() };
  const dates = items.map(item => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime());
  return { oldest: dates[0], newest: dates[dates.length - 1] };
};

/** Extract payment method from notes/description
 * If notes contains " - ", extract only the part before it
 * Examples:
 * - "تحويل كليك" → "تحويل كليك"
 * - "دفعة أولية - سماحة 4 سم" → "دفعة أولية"
 * - "" → ""
 */
const extractPaymentMethod = (description: string): string => {
  if (!description) return '';
  const dashIndex = description.indexOf(' - ');
  if (dashIndex > 0) {
    return description.substring(0, dashIndex).trim();
  }
  return description.trim();
};

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
  chequeDate: Date;
  bank: string;
  status: string;
  type: string;
  associatedParty?: string;
}

interface StatementItem {
  id: string;
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
            chequeDate: data.chequeDate?.toDate?.() || new Date(),
          } as Cheque);
        });
        // Sort by date in JavaScript
        chequesList.sort((a, b) => b.chequeDate.getTime() - a.chequeDate.getTime());
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

  // Export statement to CSV
  const exportStatement = () => {
    if (!client) {return;}

    // Combine all transactions (same logic as statement tab)
    const allTransactions = [
      ...ledgerEntries.map((e) => ({
        date: e.date,
        type: "فاتورة",
        description: e.description,
        // Income/Sales: amount goes in مدين (client owes us)
        // Expense/Purchases from them: amount goes in دائن (we owe them)
        debit: e.type === "دخل" || e.type === "إيراد" ? e.amount : 0,
        credit: e.type === "مصروف" ? e.amount : 0,
      })),
      ...payments.map((p) => ({
        date: p.date,
        type: "دفعة",
        description: extractPaymentMethod(p.notes || p.description || ''),  // Use notes field for payment method
        // Payment received (قبض): goes in دائن (reduces what they owe us)
        // Payment made (صرف): goes in مدين (reduces what we owe them)
        debit: p.type === "صرف" ? p.amount : 0,
        credit: p.type === "قبض" ? p.amount : 0,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let runningBalance = 0;
    const statementData = allTransactions.map((t) => {
      runningBalance += t.debit - t.credit;
      const balanceStatus = runningBalance > 0 ? "عليه" : runningBalance < 0 ? "له" : "مسدد";
      return {
        التاريخ: formatDateAr(t.date),
        البيان: t.type,
        الوصف: t.description,
        مدين: t.debit > 0 ? formatNumber(t.debit) : "",
        دائن: t.credit > 0 ? formatNumber(t.credit) : "",
        الرصيد: `${formatNumber(Math.abs(runningBalance))} ${balanceStatus}`,
      };
    });

    if (statementData.length === 0) {
      toast({
        title: "لا توجد معاملات",
        description: "لا توجد معاملات لتصديرها",
        variant: "destructive",
      });
      return;
    }

    // Convert to CSV
    const headers = Object.keys(statementData[0]).join(",");
    const rows = statementData.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;

    // Download
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `كشف_حساب_${client.name}_${formatDateAr(new Date())}.csv`;
    link.click();
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
        <Button onClick={exportStatement} variant="outline">
          <Download className="w-4 h-4 ml-2" />
          تصدير كشف الحساب
        </Button>
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
                    <TableHead>تاريخ الشيك</TableHead>
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
                        <TableCell>{formatShortDate(cheque.chequeDate)}</TableCell>
                        <TableCell>{cheque.bank}</TableCell>
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

                // Calculate date range
                const dateRange = getDateRange(allTransactions);

                // Calculate totals
                let totalDebit = 0;
                let totalCredit = 0;
                let runningBalance = 0;
                const rowsWithBalance = allTransactions.map((t) => {
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
                          الفترة: من {formatDateAr(dateRange.oldest)} إلى {formatDateAr(dateRange.newest)}
                        </div>
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
                            <td className="pl-1 pr-2 py-3 font-medium">د.أ</td>
                            <td className="pl-0 pr-4 py-3 font-medium text-left">0.00</td>
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

                    {/* Document ID with Copy Button */}
                    <div className="flex justify-between items-center border-b pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400 break-all">
                          {selectedTransaction.id}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(selectedTransaction.id);
                            toast({
                              title: "تم النسخ",
                              description: "تم نسخ رقم المستند",
                            });
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="نسخ"
                        >
                          <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                      </div>
                      <span className="text-gray-500 mr-4 shrink-0">:رقم المستند</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 px-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        if (selectedTransaction.isPayment) {
                          router.push('/payments');
                        } else {
                          router.push('/ledger');
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
