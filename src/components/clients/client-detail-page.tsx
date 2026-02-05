"use client";

import { useState } from "react";
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
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  FileText,
  Download,
  Landmark,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate } from "@/lib/date-utils";
import { exportStatementToPDF } from "@/lib/export-statement-pdf";
import { exportStatementToExcel } from "@/lib/export-statement-excel";
import {
  formatCurrency,
  formatStatementDate,
  extractPaymentMethod
} from "@/lib/statement-format";
import { CHEQUE_STATUS_AR } from "@/lib/constants";
import {
  isLoanTransaction,
  isInitialLoan,
  getLoanType,
} from "@/components/ledger/utils/ledger-helpers";

// Import extracted hooks and types
import {
  useClientData,
  useLedgerForClient,
  usePaymentsForClient,
  useChequesForClient,
  useStatementData,
  isAdvanceEntry,
  type LedgerEntry,
  type Payment,
  type Cheque,
  type StatementItem,
} from './hooks';

// Aliases for backward compatibility with existing code
const formatNumber = formatCurrency;
const formatDateAr = formatStatementDate;

interface ClientDetailPageProps {
  clientId: string;
}

/**
 * Filter pending cheques, excluding endorsed cheques
 * Endorsed cheques are already accounted for in the statement as endorsement payments
 * Including them would double-count the amount
 */
function filterPendingCheques(cheques: Cheque[]): Cheque[] {
  return cheques.filter(c => c.status === "قيد الانتظار" && !c.isEndorsedCheque);
}

/**
 * Calculate expected balance after pending cheques clear
 * - Incoming (وارد): We receive money → reduces what they owe us
 * - Outgoing (صادر): We pay money → reduces what we owe them
 */
function calculateBalanceAfterCheques(
  currentBalance: number,
  pendingCheques: Cheque[]
): { incomingTotal: number; outgoingTotal: number; balanceAfterCheques: number } {
  const incomingTotal = pendingCheques
    .filter(c => c.type === "وارد")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const outgoingTotal = pendingCheques
    .filter(c => c.type === "صادر")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const balanceAfterCheques = currentBalance - incomingTotal + outgoingTotal;

  return { incomingTotal, outgoingTotal, balanceAfterCheques };
}

interface ExportTransaction {
  date: Date;
  type?: "Invoice" | "Payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ExportData {
  transactions: ExportTransaction[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  pendingCheques: Array<{
    chequeNumber: string;
    bankName: string;
    dueDate: Date;
    amount: number;
    type: string;
  }>;
  balanceAfterCheques: number;
}

/**
 * Build export data from ledger entries, payments, and cheques
 * This shared function is used by both Excel and PDF exports
 */
function buildExportData(
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  cheques: Cheque[],
  clientInitialBalance: number
): ExportData {
  // Build transaction rows from ledger entries (including discounts and writeoffs)
  const allTxns: ExportTransaction[] = [
    ...ledgerEntries.flatMap((e) => {
      const rows: ExportTransaction[] = [];
      const isAdvance = isAdvanceEntry(e);
      const isLoan = isLoanTransaction(e.type, e.category);

      // Calculate debit/credit based on transaction type
      let debit = 0;
      let credit = 0;
      if (isAdvance) {
        debit = 0;
        credit = 0;
      } else if (isLoan) {
        const loanType = getLoanType(e.category);
        if (isInitialLoan(e.subCategory)) {
          if (loanType === "receivable") {
            debit = e.amount;
          } else if (loanType === "payable") {
            credit = e.amount;
          }
        } else {
          if (loanType === "receivable") {
            credit = e.amount;
          } else if (loanType === "payable") {
            debit = e.amount;
          }
        }
      } else if (e.type === "دخل" || e.type === "إيراد") {
        debit = e.amount;
      } else if (e.type === "مصروف") {
        credit = e.amount;
      }

      // Row 1: The invoice/loan itself
      rows.push({
        date: e.date,
        type: "Invoice" as const,
        description: isAdvance
          ? `${e.description} (${e.amount.toFixed(2)} - لا يؤثر على الرصيد)`
          : e.description,
        debit,
        credit,
        balance: 0,
      });

      // Row 2: Discount (if any) - reduces what client owes
      if (e.totalDiscount && e.totalDiscount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
        rows.push({
          date: e.date,
          type: "Payment" as const,
          description: "خصم تسوية",
          debit: 0,
          credit: e.totalDiscount,
          balance: 0,
        });
      }

      // Row 3: Writeoff (if any) - reduces what client owes
      if (e.writeoffAmount && e.writeoffAmount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
        rows.push({
          date: e.date,
          type: "Payment" as const,
          description: "شطب دين معدوم",
          debit: 0,
          credit: e.writeoffAmount,
          balance: 0,
        });
      }

      return rows;
    }),
    ...payments.map((p) => ({
      date: p.date,
      type: "Payment" as const,
      description: p.notes || p.description || '',
      debit: p.type === "صرف" ? p.amount : 0,
      credit: p.type === "قبض" ? p.amount : 0,
      balance: 0,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balances
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
  const pending = filterPendingCheques(cheques);
  const pendingChequeData = pending.map((c) => ({
    chequeNumber: c.chequeNumber,
    bankName: c.bankName,
    dueDate: c.dueDate || c.issueDate,
    amount: c.amount,
    type: c.type,
  }));

  // Calculate balance after cheques
  const { balanceAfterCheques } = calculateBalanceAfterCheques(runningBalance, pending);

  return {
    transactions: txnsWithBalance,
    totalDebit,
    totalCredit,
    finalBalance: runningBalance,
    pendingCheques: pendingChequeData,
    balanceAfterCheques,
  };
}

export default function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ============================================================================
  // DATA HOOKS
  // ============================================================================

  // Load client data
  const { client, loading } = useClientData(clientId);

  // Load ledger entries and financial metrics
  const {
    ledgerEntries,
    totalSales,
    totalPurchases,
    loansReceivable,
    loansPayable,
  } = useLedgerForClient(client);

  // Load payments
  const { payments } = usePaymentsForClient(client);

  // Load cheques
  const { cheques } = useChequesForClient(client);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  // Modal state for transaction details
  const [selectedTransaction, setSelectedTransaction] = useState<StatementItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Date filter state for statement
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // ============================================================================
  // DERIVED DATA (from useStatementData hook)
  // ============================================================================

  const {
    allTransactions,
    dateRange,
    openingBalance,
    rowsWithBalance,
    totalDebit,
    totalCredit,
    finalBalance,
  } = useStatementData(ledgerEntries, payments, client, dateFrom, dateTo);

  // ============================================================================
  // EXPORT FUNCTIONS
  // ============================================================================

  // Export statement to Excel
  const exportStatement = async () => {
    if (!client) {return;}

    const clientInitialBalance = client.balance || 0;
    const exportData = buildExportData(ledgerEntries, payments, cheques, clientInitialBalance);

    try {
      await exportStatementToExcel({
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        openingBalance: clientInitialBalance,
        transactions: exportData.transactions,
        totalDebit: exportData.totalDebit,
        totalCredit: exportData.totalCredit,
        finalBalance: exportData.finalBalance,
        pendingCheques: exportData.pendingCheques.length > 0 ? exportData.pendingCheques : undefined,
        expectedBalanceAfterCheques: exportData.pendingCheques.length > 0 ? exportData.balanceAfterCheques : undefined,
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
              if (!client) {return;}

              const clientInitialBalance = client.balance || 0;
              const exportData = buildExportData(ledgerEntries, payments, cheques, clientInitialBalance);

              try {
                await exportStatementToPDF({
                  clientName: client.name,
                  clientPhone: client.phone,
                  clientEmail: client.email,
                  openingBalance: clientInitialBalance,
                  transactions: exportData.transactions,
                  totalDebit: exportData.totalDebit,
                  totalCredit: exportData.totalCredit,
                  finalBalance: exportData.finalBalance,
                  pendingCheques: exportData.pendingCheques.length > 0 ? exportData.pendingCheques : undefined,
                  expectedBalanceAfterCheques: exportData.pendingCheques.length > 0 ? exportData.balanceAfterCheques : undefined,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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


        {/* Loan Balance Card - Only show if there are loans */}
        {(loansReceivable > 0 || loansPayable > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                رصيد القروض
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loansReceivable > 0 && (
                <div className="text-lg font-semibold text-green-600">
                  له (قرض ممنوح): {loansReceivable.toFixed(2)} د.أ
                </div>
              )}
              {loansPayable > 0 && (
                <div className="text-lg font-semibold text-red-600">
                  عليه (قرض مستلم): {loansPayable.toFixed(2)} د.أ
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {loansReceivable > 0 && loansPayable > 0
                  ? "قروض متبادلة"
                  : loansReceivable > 0
                  ? "قرض ممنوح للعميل"
                  : "قرض من العميل"}
              </p>
            </CardContent>
          </Card>
        )}
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
                          <div className="flex flex-col gap-1">
                            <span
                              className={`px-2 py-1 rounded text-xs inline-block w-fit ${
                                cheque.status === CHEQUE_STATUS_AR.PENDING
                                  ? "bg-yellow-100 text-yellow-800"
                                  : cheque.status === CHEQUE_STATUS_AR.CASHED || cheque.status === CHEQUE_STATUS_AR.COLLECTED
                                  ? "bg-green-100 text-green-800"
                                  : cheque.status === CHEQUE_STATUS_AR.ENDORSED
                                  ? "bg-purple-100 text-purple-800"
                                  : cheque.status === CHEQUE_STATUS_AR.BOUNCED
                                  ? "bg-red-100 text-red-800"
                                  : cheque.status === CHEQUE_STATUS_AR.RETURNED
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {cheque.status}
                            </span>
                            {/* Show endorsement info if cheque is endorsed */}
                            {cheque.endorsedTo && (
                              <span className="text-xs text-purple-600">
                                ← {cheque.endorsedTo}
                              </span>
                            )}
                          </div>
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
              <div>
                {/* Statement Header */}
                <div className="bg-gradient-to-l from-blue-600 to-blue-800 text-white p-5 rounded-t-lg">
                  <h3 className="text-lg mb-1">كشف حساب</h3>
                  <div className="text-2xl font-bold mb-2">{client?.name}</div>
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
                      ({rowsWithBalance.length} من {allTransactions.length} معاملة)
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
                                  transaction.entryType === 'سلفة'
                                    ? 'bg-orange-100 text-orange-800'
                                    : transaction.entryType === 'قرض'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : transaction.isEndorsement
                                    ? 'bg-purple-100 text-purple-800'
                                    : transaction.isPayment
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {transaction.entryType === 'سلفة' ? 'سلفة' : transaction.entryType === 'قرض' ? 'قرض' : transaction.isEndorsement ? 'تظهير' : transaction.isPayment ? 'دفعة' : 'فاتورة'}
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
                  const pendingCheques = filterPendingCheques(cheques);
                  if (pendingCheques.length === 0) {return null;}

                  const totalPendingCheques = pendingCheques.reduce((sum, c) => sum + (c.amount || 0), 0);
                  const { balanceAfterCheques } = calculateBalanceAfterCheques(finalBalance, pendingCheques);

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
