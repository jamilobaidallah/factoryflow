"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Calendar, TrendingUp, DollarSign, Package, Building2 } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import SubcategoryAnalysis from "./subcategory-analysis";
import {
  exportToExcel,
  exportLedgerToExcel,
  exportIncomeStatementToPDF,
  exportIncomeStatementToHTML,
  exportBalanceSheetToPDF,
  exportLedgerToPDF,
} from "@/lib/export-utils";
import { IncomeStatementTab } from "./tabs/IncomeStatementTab";
import { CashFlowTab } from "./tabs/CashFlowTab";
import { ARAPAgingTab } from "./tabs/ARAPAgingTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { SalesAndCOGSTab } from "./tabs/SalesAndCOGSTab";
import { FixedAssetsTab } from "./tabs/FixedAssetsTab";
import { TrialBalanceTab } from "./tabs/TrialBalanceTab";
import { useReportsCalculations } from "./hooks/useReportsCalculations";

interface LedgerEntry {
  id: string;
  transactionId: string;
  description: string;
  type: string;
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  date: Date;
  totalPaid?: number;
  remainingBalance?: number;
  paymentStatus?: "paid" | "unpaid" | "partial";
  isARAPEntry?: boolean;
}

interface Payment {
  id: string;
  amount: number;
  type: string;
  date: Date;
  linkedTransactionId?: string;
}

interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  category: string;
}

interface FixedAsset {
  id: string;
  assetName: string;
  category: string;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  status: string;
}

export default function ReportsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("income-statement");

  // Date range filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Data states
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  // Fetch all data
  const fetchReportData = useCallback(async () => {
    if (!user) {return;}
    setLoading(true);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Fetch ledger entries (limit to 1000 to prevent memory issues)
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const ledgerQuery = query(
        ledgerRef,
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "desc"),
        limit(1000)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);
      const ledgerData: LedgerEntry[] = [];
      ledgerSnapshot.forEach((doc) => {
        const data = doc.data();
        ledgerData.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(),
        } as LedgerEntry);
      });
      setLedgerEntries(ledgerData);

      // Fetch payments (limit to 1000 to prevent memory issues)
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentsQuery = query(
        paymentsRef,
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "desc"),
        limit(1000)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData: Payment[] = [];
      paymentsSnapshot.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(),
        } as Payment);
      });
      setPayments(paymentsData);

      // Fetch inventory (limit to 500 items)
      const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
      const inventoryQuery = query(inventoryRef, limit(500));
      const inventorySnapshot = await getDocs(inventoryQuery);
      const inventoryData: InventoryItem[] = [];
      inventorySnapshot.forEach((doc) => {
        inventoryData.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(inventoryData);

      // Fetch fixed assets (limit to 500 items)
      const assetsRef = collection(firestore, `users/${user.uid}/fixed_assets`);
      const assetsQuery = query(assetsRef, limit(500));
      const assetsSnapshot = await getDocs(assetsQuery);
      const assetsData: FixedAsset[] = [];
      assetsSnapshot.forEach((doc) => {
        assetsData.push({ id: doc.id, ...doc.data() } as FixedAsset);
      });
      setFixedAssets(assetsData);

      toast({
        title: "تم تحميل البيانات",
        description: "تم تحميل بيانات التقارير بنجاح",
      });
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate, toast]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Use the custom hook for all calculations
  const {
    ownerEquity,
    incomeStatement,
    cashFlow,
    arapAging,
    inventoryValuation,
    salesAndCOGS,
    fixedAssetsSummary,
  } = useReportsCalculations({
    ledgerEntries,
    payments,
    inventory,
    fixedAssets,
  });

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    const csv = convertToCSV(data);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) {return "";}
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    return [headers, ...rows].join("\n");
  };

  // Export income statement to Excel
  const exportIncomeStatementToExcel = () => {
    const revenueData = Object.entries(incomeStatement.revenueByCategory).map(([category, amount]) => ({
      'الفئة': category,
      'النوع': 'إيراد',
      'المبلغ': amount,
    }));

    const expenseData = Object.entries(incomeStatement.expensesByCategory).map(([category, amount]) => ({
      'الفئة': category,
      'النوع': 'مصروف',
      'المبلغ': amount,
    }));

    const allData = [
      ...revenueData,
      { 'الفئة': 'إجمالي الإيرادات', 'النوع': '', 'المبلغ': incomeStatement.totalRevenue },
      ...expenseData,
      { 'الفئة': 'إجمالي المصروفات', 'النوع': '', 'المبلغ': incomeStatement.totalExpenses },
      { 'الفئة': 'صافي الدخل', 'النوع': '', 'المبلغ': incomeStatement.netProfit },
    ];

    exportToExcel(allData, `قائمة_الدخل_${startDate}_${endDate}`, 'قائمة الدخل');
  };

  // Export income statement to PDF
  const exportIncomeStatementPDF = () => {
    exportIncomeStatementToPDF(
      {
        revenues: Object.entries(incomeStatement.revenueByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === 'number' ? amount : 0,
        })),
        expenses: Object.entries(incomeStatement.expensesByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === 'number' ? amount : 0,
        })),
        totalRevenue: incomeStatement.totalRevenue,
        totalExpenses: incomeStatement.totalExpenses,
        netIncome: incomeStatement.netProfit,
      },
      startDate,
      endDate,
      `قائمة_الدخل_${startDate}_${endDate}`
    );
  };

  // Export income statement to HTML (printable with Arabic)
  const exportIncomeStatementHTML = () => {
    exportIncomeStatementToHTML(
      {
        revenues: Object.entries(incomeStatement.revenueByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === 'number' ? amount : 0,
        })),
        expenses: Object.entries(incomeStatement.expensesByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === 'number' ? amount : 0,
        })),
        totalRevenue: incomeStatement.totalRevenue,
        totalExpenses: incomeStatement.totalExpenses,
        netIncome: incomeStatement.netProfit,
      },
      startDate,
      endDate
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">التقارير المالية</h1>
          <p className="text-gray-500 mt-1">تحليل شامل للأداء المالي</p>
        </div>
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="startDate">من تاريخ</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="endDate">إلى تاريخ</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchReportData} disabled={loading}>
              <Calendar className="w-4 h-4 ml-2" />
              {loading ? "جاري التحميل..." : "تحديث التقارير"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subcategory Analysis */}
      <SubcategoryAnalysis />

      {/* Reports Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="income-statement">قائمة الدخل</TabsTrigger>
          <TabsTrigger value="cash-flow">التدفقات النقدية</TabsTrigger>
          <TabsTrigger value="arap-aging">أعمار الذمم</TabsTrigger>
          <TabsTrigger value="inventory">تقييم المخزون</TabsTrigger>
          <TabsTrigger value="sales-cogs">المبيعات و COGS</TabsTrigger>
          <TabsTrigger value="fixed-assets">الأصول الثابتة</TabsTrigger>
          <TabsTrigger value="trial-balance">ميزان المراجعة</TabsTrigger>
        </TabsList>

        {/* Income Statement Report */}
        <TabsContent value="income-statement">
          <IncomeStatementTab
            incomeStatement={incomeStatement}
            ownerEquity={ownerEquity}
            onExportCSV={() =>
              exportToCSV(
                [
                  ...Object.entries(incomeStatement.revenueByCategory).map(
                    ([cat, amt]) => ({ النوع: "إيراد", الفئة: cat, المبلغ: amt })
                  ),
                  ...Object.entries(incomeStatement.expensesByCategory).map(
                    ([cat, amt]) => ({ النوع: "مصروف", الفئة: cat, المبلغ: amt })
                  ),
                ],
                "income_statement"
              )
            }
            onExportExcel={exportIncomeStatementToExcel}
            onExportPDFArabic={exportIncomeStatementHTML}
            onExportPDFEnglish={exportIncomeStatementPDF}
          />
        </TabsContent>

        {/* Cash Flow Report */}
        <TabsContent value="cash-flow">
          <CashFlowTab
            cashFlow={cashFlow}
            payments={payments}
            onExportCSV={() =>
              exportToCSV(
                payments.map((p) => ({
                  التاريخ: p.date.toLocaleDateString("ar"),
                  النوع: p.type,
                  المبلغ: p.amount,
                })),
                "cash_flow"
              )
            }
          />
        </TabsContent>

        {/* AR/AP Aging Report */}
        <TabsContent value="arap-aging">
          <ARAPAgingTab
            arapAging={arapAging}
            onExportReceivablesCSV={() =>
              exportToCSV(
                arapAging.receivables.map((r) => ({
                  المعاملة: r.transactionId,
                  الوصف: r.description,
                  الطرف: r.associatedParty,
                  المبلغ: r.amount,
                  المدفوع: r.totalPaid || 0,
                  المتبقي: r.remainingBalance || 0,
                  التاريخ: r.date.toLocaleDateString("ar"),
                  العمر: arapAging.getAgingBucket(r.date),
                })),
                "accounts_receivable"
              )
            }
            onExportPayablesCSV={() =>
              exportToCSV(
                arapAging.payables.map((p) => ({
                  المعاملة: p.transactionId,
                  الوصف: p.description,
                  الطرف: p.associatedParty,
                  المبلغ: p.amount,
                  المدفوع: p.totalPaid || 0,
                  المتبقي: p.remainingBalance || 0,
                  التاريخ: p.date.toLocaleDateString("ar"),
                  العمر: arapAging.getAgingBucket(p.date),
                })),
                "accounts_payable"
              )
            }
          />
        </TabsContent>

        {/* Inventory Valuation Report */}
        <TabsContent value="inventory">
          <InventoryTab
            inventoryValuation={inventoryValuation}
            onExportCSV={() =>
              exportToCSV(
                inventoryValuation.valuedInventory.map((item) => ({
                  الصنف: item.itemName,
                  الفئة: item.category,
                  الكمية: item.quantity,
                  الوحدة: item.unit,
                  سعر_الوحدة: item.unitPrice,
                  القيمة_الإجمالية: item.totalValue,
                })),
                "inventory_valuation"
              )
            }
          />
        </TabsContent>

        {/* Sales & COGS Report */}
        <TabsContent value="sales-cogs">
          <SalesAndCOGSTab salesAndCOGS={salesAndCOGS} />
        </TabsContent>

        {/* Fixed Assets Summary */}
        <TabsContent value="fixed-assets">
          <FixedAssetsTab
            fixedAssetsSummary={fixedAssetsSummary}
            onExportCSV={() =>
              exportToCSV(
                fixedAssetsSummary.activeAssets.map((asset) => ({
                  الأصل: asset.assetName,
                  الفئة: asset.category,
                  التكلفة_الأصلية: asset.purchaseCost,
                  مجمع_الاستهلاك: asset.accumulatedDepreciation,
                  القيمة_الدفترية: asset.bookValue,
                  الاستهلاك_الشهري: asset.monthlyDepreciation,
                })),
                "fixed_assets_summary"
              )
            }
          />
        </TabsContent>

        {/* Trial Balance Report */}
        <TabsContent value="trial-balance">
          <TrialBalanceTab
            ledgerEntries={ledgerEntries}
            payments={payments}
            onExportCSV={() => {
              const trialBalanceData: any[] = [];
              const categoryTotals: {
                [key: string]: { debit: number; credit: number };
              } = {};

              ledgerEntries.forEach((entry) => {
                const category = entry.category || "غير مصنف";
                if (!categoryTotals[category]) {
                  categoryTotals[category] = { debit: 0, credit: 0 };
                }

                if (entry.type === "دخل" || entry.type === "إيراد") {
                  categoryTotals[category].credit += entry.amount;
                } else if (entry.type === "مصروف") {
                  categoryTotals[category].debit += entry.amount;
                }
              });

              Object.entries(categoryTotals).forEach(([category, totals]) => {
                trialBalanceData.push({
                  الحساب: category,
                  المدين: totals.debit,
                  الدائن: totals.credit,
                });
              });

              exportToCSV(trialBalanceData, "trial_balance");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
