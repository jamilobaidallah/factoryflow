"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportStatementToHTML } from "@/lib/export-utils";
import { exportStatementToExcel } from "@/lib/export-statement-excel";

// Import extracted hooks and types
import {
  useClientData,
  useLedgerForClient,
  usePaymentsForClient,
  useChequesForClient,
  useStatementData,
  type StatementItem,
} from './hooks';

// Import extracted components
import {
  ClientInfoCard,
  FinancialOverviewCards,
  TransactionsTab,
  PaymentsTab,
  ChequesTab,
  StatementHeader,
  DateFilterBar,
  StatementTable,
  PendingChequesSection,
  TransactionDetailModal,
} from './components';

// Import utility functions
import { buildExportData } from './lib';

interface ClientDetailPageProps {
  clientId: string;
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

  const handleExcelExport = async () => {
    if (!client) { return; }

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

  const handlePdfExport = () => {
    if (!client) { return; }

    const clientInitialBalance = client.balance || 0;
    const exportData = buildExportData(ledgerEntries, payments, cheques, clientInitialBalance);

    // Use HTML-based export for proper Arabic RTL support
    exportStatementToHTML({
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      dateFrom: dateFrom,
      dateTo: dateTo,
      openingBalance: clientInitialBalance,
      transactions: exportData.transactions,
      totalDebit: exportData.totalDebit,
      totalCredit: exportData.totalCredit,
      finalBalance: exportData.finalBalance,
      pendingCheques: exportData.pendingCheques.length > 0 ? exportData.pendingCheques : undefined,
      expectedBalanceAfterCheques: exportData.pendingCheques.length > 0 ? exportData.balanceAfterCheques : undefined,
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

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

  // Calculate counts for overview cards
  const salesCount = ledgerEntries.filter((e) => e.type === "دخل" || e.type === "إيراد").length;
  const purchasesCount = ledgerEntries.filter((e) => e.type === "مصروف").length;

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
          <Button onClick={handleExcelExport} variant="outline">
            <Download className="w-4 h-4 ml-2" />
            Excel
          </Button>
          <Button onClick={handlePdfExport} variant="outline">
            <FileText className="w-4 h-4 ml-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <FinancialOverviewCards
        totalSales={totalSales}
        totalPurchases={totalPurchases}
        loansReceivable={loansReceivable}
        loansPayable={loansPayable}
        salesCount={salesCount}
        purchasesCount={purchasesCount}
      />

      {/* Client Info Card */}
      <ClientInfoCard client={client} />

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
          <TransactionsTab ledgerEntries={ledgerEntries} />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <PaymentsTab payments={payments} />
        </TabsContent>

        {/* Cheques Tab */}
        <TabsContent value="cheques">
          <ChequesTab cheques={cheques} />
        </TabsContent>

        {/* Statement Tab */}
        <TabsContent value="statement">
          <Card>
            <CardContent className="p-0">
              <div>
                {/* Statement Header */}
                <StatementHeader
                  clientName={client.name}
                  hasTransactions={allTransactions.length > 0}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  dateRange={dateRange}
                />

                {/* Date Range Filter Bar */}
                <DateFilterBar
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  filteredCount={rowsWithBalance.length}
                  totalCount={allTransactions.length}
                />

                {/* Statement Table */}
                <StatementTable
                  openingBalance={openingBalance}
                  rowsWithBalance={rowsWithBalance}
                  totalDebit={totalDebit}
                  totalCredit={totalCredit}
                  finalBalance={finalBalance}
                  onRowClick={(transaction) => {
                    setSelectedTransaction(transaction);
                    setIsModalOpen(true);
                  }}
                />

                {/* Pending Cheques Section */}
                <PendingChequesSection
                  cheques={cheques}
                  finalBalance={finalBalance}
                />
              </div>
            </CardContent>
          </Card>

          {/* Transaction Detail Modal */}
          <TransactionDetailModal
            isOpen={isModalOpen}
            onOpenChange={setIsModalOpen}
            transaction={selectedTransaction}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
