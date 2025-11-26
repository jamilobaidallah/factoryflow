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

  // Calculate Owner Equity (separate from profit/loss)
  const calculateOwnerEquity = () => {
    let ownerInvestments = 0;
    let ownerWithdrawals = 0;

    ledgerEntries.forEach((entry) => {
      // Exclude owner equity transactions (رأس المال) from P&L
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        if (entry.type === "دخل") {
          ownerInvestments += entry.amount;
        } else if (entry.type === "مصروف") {
          ownerWithdrawals += entry.amount;
        }
      }
    });

    const netOwnerEquity = ownerInvestments - ownerWithdrawals;

    return {
      ownerInvestments,
      ownerWithdrawals,
      netOwnerEquity,
    };
  };

  // Calculate Income Statement (EXCLUDING owner equity)
  const calculateIncomeStatement = () => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueByCategory: { [key: string]: number } = {};
    const expensesByCategory: { [key: string]: number } = {};

    ledgerEntries.forEach((entry) => {
      // EXCLUDE owner equity transactions from profit/loss
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        return; // Skip owner equity transactions
      }

      if (entry.type === "دخل") {
        totalRevenue += entry.amount;
        revenueByCategory[entry.category] =
          (revenueByCategory[entry.category] || 0) + entry.amount;
      } else if (entry.type === "مصروف") {
        totalExpenses += entry.amount;
        expensesByCategory[entry.category] =
          (expensesByCategory[entry.category] || 0) + entry.amount;
      }
    });

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      revenueByCategory,
      expensesByCategory,
    };
  };

  // Calculate Cash Flow
  const calculateCashFlow = () => {
    let cashIn = 0;
    let cashOut = 0;

    // Count all payments from Payments collection
    // Instant settlement automatically creates payment records, so we only need to count from payments
    // EXCLUDE endorsed cheques and no-cash-movement payments to avoid double counting
    payments.forEach((payment: any) => {
      // Skip endorsed cheques and no-cash-movement payments
      if (payment.isEndorsement || payment.noCashMovement) {
        return;
      }

      if (payment.type === "قبض") {
        cashIn += payment.amount;
      } else if (payment.type === "صرف") {
        cashOut += payment.amount;
      }
    });

    const netCashFlow = cashIn - cashOut;

    return { cashIn, cashOut, netCashFlow };
  };

  // Calculate AR/AP Aging
  const calculateARAPAging = () => {
    const receivables: LedgerEntry[] = [];
    const payables: LedgerEntry[] = [];
    let totalReceivables = 0;
    let totalPayables = 0;

    ledgerEntries.forEach((entry) => {
      if (entry.isARAPEntry && entry.paymentStatus !== "paid") {
        if (entry.type === "دخل") {
          receivables.push(entry);
          totalReceivables += entry.remainingBalance || 0;
        } else if (entry.type === "مصروف") {
          payables.push(entry);
          totalPayables += entry.remainingBalance || 0;
        }
      }
    });

    // Calculate aging buckets (days overdue)
    const getAgingBucket = (date: Date) => {
      const today = new Date();
      const diffTime = today.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {return "0-30 يوم";}
      if (diffDays <= 60) {return "31-60 يوم";}
      if (diffDays <= 90) {return "61-90 يوم";}
      return "+90 يوم";
    };

    return {
      receivables,
      payables,
      totalReceivables,
      totalPayables,
      getAgingBucket,
    };
  };

  // Calculate Inventory Valuation
  const calculateInventoryValuation = () => {
    let totalValue = 0;
    const totalItems = inventory.length;
    let lowStockItems = 0;

    const valuedInventory = inventory.map((item) => {
      const value = item.quantity * item.unitPrice;
      totalValue += value;
      if (item.quantity < 10) {lowStockItems++;} // Arbitrary low stock threshold
      return { ...item, totalValue: value };
    });

    return { valuedInventory, totalValue, totalItems, lowStockItems };
  };

  // Calculate Sales & COGS
  const calculateSalesAndCOGS = () => {
    let totalSales = 0;
    let totalCOGS = 0;

    ledgerEntries.forEach((entry) => {
      if (entry.category === "إيرادات المبيعات") {
        totalSales += entry.amount;
      }
      if (entry.category === "تكلفة البضاعة المباعة (COGS)") {
        totalCOGS += entry.amount;
      }
    });

    const grossProfit = totalSales - totalCOGS;
    const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    return { totalSales, totalCOGS, grossProfit, grossMargin };
  };

  // Calculate Fixed Assets Summary
  const calculateFixedAssetsSummary = () => {
    let totalCost = 0;
    let totalAccumulatedDepreciation = 0;
    let totalBookValue = 0;
    let monthlyDepreciation = 0;

    const activeAssets = fixedAssets.filter((asset) => asset.status === "active");

    activeAssets.forEach((asset) => {
      totalCost += asset.purchaseCost;
      totalAccumulatedDepreciation += asset.accumulatedDepreciation;
      totalBookValue += asset.bookValue;
      monthlyDepreciation += asset.monthlyDepreciation;
    });

    const assetsByCategory: { [key: string]: number } = {};
    activeAssets.forEach((asset) => {
      assetsByCategory[asset.category] =
        (assetsByCategory[asset.category] || 0) + asset.bookValue;
    });

    return {
      activeAssets,
      totalCost,
      totalAccumulatedDepreciation,
      totalBookValue,
      monthlyDepreciation,
      assetsByCategory,
    };
  };

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

  const incomeStatement = calculateIncomeStatement();
  const ownerEquity = calculateOwnerEquity();
  const cashFlow = calculateCashFlow();
  const arapAging = calculateARAPAging();
  const inventoryValuation = calculateInventoryValuation();
  const salesAndCOGS = calculateSalesAndCOGS();
  const fixedAssetsSummary = calculateFixedAssetsSummary();

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
        <TabsContent value="income-statement" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي الإيرادات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {incomeStatement.totalRevenue.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي المصروفات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {incomeStatement.totalExpenses.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  صافي الربح/الخسارة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    incomeStatement.netProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {incomeStatement.netProfit.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  هامش الربح
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {incomeStatement.profitMargin.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Owner Equity Section - Separate from P&L */}
          {(ownerEquity.ownerInvestments > 0 || ownerEquity.ownerWithdrawals > 0) && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">
                رأس المال (منفصل عن الأرباح والخسائر)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      استثمارات المالك
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {ownerEquity.ownerInvestments.toFixed(2)} د.أ
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      سحوبات المالك
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {ownerEquity.ownerWithdrawals.toFixed(2)} د.أ
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      صافي رأس المال
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      ownerEquity.netOwnerEquity >= 0 ? "text-blue-600" : "text-red-600"
                    }`}>
                      {ownerEquity.netOwnerEquity.toFixed(2)} د.أ
                    </div>
                  </CardContent>
                </Card>
              </div>
              <p className="text-sm text-blue-700 mt-3 text-center">
                ⓘ رأس المال لا يُحتسب ضمن الأرباح أو الخسائر التشغيلية
              </p>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تفصيل الإيرادات والمصروفات</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
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
                  >
                    <Download className="w-4 h-4 ml-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportIncomeStatementToExcel}
                  >
                    <Download className="w-4 h-4 ml-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportIncomeStatementHTML}
                    title="طباعة باللغة العربية"
                  >
                    <Download className="w-4 h-4 ml-2" />
                    PDF عربي
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportIncomeStatementPDF}
                  >
                    <Download className="w-4 h-4 ml-2" />
                    PDF (EN)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revenue Breakdown */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700">
                    الإيرادات حسب الفئة
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفئة</TableHead>
                        <TableHead className="text-left">المبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(incomeStatement.revenueByCategory).map(
                        ([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-left font-medium">
                              {(amount as number).toFixed(2)} د.أ
                            </TableCell>
                          </TableRow>
                        )
                      )}
                      <TableRow className="bg-green-50">
                        <TableCell className="font-bold">المجموع</TableCell>
                        <TableCell className="text-left font-bold text-green-700">
                          {incomeStatement.totalRevenue.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Expenses Breakdown */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-red-700">
                    المصروفات حسب الفئة
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفئة</TableHead>
                        <TableHead className="text-left">المبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(incomeStatement.expensesByCategory).map(
                        ([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-left font-medium">
                              {(amount as number).toFixed(2)} د.أ
                            </TableCell>
                          </TableRow>
                        )
                      )}
                      <TableRow className="bg-red-50">
                        <TableCell className="font-bold">المجموع</TableCell>
                        <TableCell className="text-left font-bold text-red-700">
                          {incomeStatement.totalExpenses.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Report */}
        <TabsContent value="cash-flow" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  النقد الوارد
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {cashFlow.cashIn.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  النقد الصادر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {cashFlow.cashOut.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  صافي التدفق النقدي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    cashFlow.netCashFlow >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {cashFlow.netCashFlow.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تفصيل المدفوعات</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportToCSV(
                      payments.map((p) => ({
                        التاريخ: p.date.toLocaleDateString("ar"),
                        النوع: p.type,
                        المبلغ: p.amount,
                      })),
                      "cash_flow"
                    )
                  }
                >
                  <Download className="w-4 h-4 ml-2" />
                  تصدير CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 20).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {payment.date.toLocaleDateString("ar-JO")}
                      </TableCell>
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
                      <TableCell className="text-left font-medium">
                        {payment.amount.toFixed(2)} د.أ
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {payments.length > 20 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  عرض 20 من {payments.length} معاملة
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AR/AP Aging Report */}
        <TabsContent value="arap-aging" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي المستحقات (حسابات القبض)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {arapAging.totalReceivables.toFixed(2)} د.أ
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {arapAging.receivables.length} معاملة
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي المدفوعات (حسابات الدفع)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {arapAging.totalPayables.toFixed(2)} د.أ
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {arapAging.payables.length} معاملة
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accounts Receivable */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>حسابات القبض (المستحقات لنا)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
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
                  >
                    <Download className="w-4 h-4 ml-2" />
                    تصدير
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الطرف</TableHead>
                      <TableHead>المتبقي</TableHead>
                      <TableHead>العمر</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arapAging.receivables.map((receivable) => (
                      <TableRow key={receivable.id}>
                        <TableCell>{receivable.associatedParty}</TableCell>
                        <TableCell className="font-medium">
                          {(receivable.remainingBalance || 0).toFixed(2)} د.أ
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                            {arapAging.getAgingBucket(receivable.date)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Accounts Payable */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>حسابات الدفع (المستحقات علينا)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
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
                  >
                    <Download className="w-4 h-4 ml-2" />
                    تصدير
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الطرف</TableHead>
                      <TableHead>المتبقي</TableHead>
                      <TableHead>العمر</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arapAging.payables.map((payable) => (
                      <TableRow key={payable.id}>
                        <TableCell>{payable.associatedParty}</TableCell>
                        <TableCell className="font-medium">
                          {(payable.remainingBalance || 0).toFixed(2)} د.أ
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                            {arapAging.getAgingBucket(payable.date)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inventory Valuation Report */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي قيمة المخزون
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {inventoryValuation.totalValue.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  عدد الأصناف
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-700">
                  {inventoryValuation.totalItems}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  أصناف منخفضة المخزون
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {inventoryValuation.lowStockItems}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تفصيل المخزون</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
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
                >
                  <Download className="w-4 h-4 ml-2" />
                  تصدير CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر الوحدة</TableHead>
                    <TableHead className="text-left">القيمة الإجمالية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryValuation.valuedInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell>{item.unitPrice.toFixed(2)} د.أ</TableCell>
                      <TableCell className="text-left font-medium">
                        {item.totalValue.toFixed(2)} د.أ
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={4} className="font-bold">
                      المجموع الكلي
                    </TableCell>
                    <TableCell className="text-left font-bold text-blue-700">
                      {inventoryValuation.totalValue.toFixed(2)} د.أ
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales & COGS Report */}
        <TabsContent value="sales-cogs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي المبيعات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {salesAndCOGS.totalSales.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  تكلفة البضاعة المباعة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {salesAndCOGS.totalCOGS.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي الربح
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {salesAndCOGS.grossProfit.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  هامش الربح الإجمالي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {salesAndCOGS.grossMargin.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>تحليل الربحية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                  <span className="font-medium">إجمالي إيرادات المبيعات</span>
                  <span className="text-xl font-bold text-green-700">
                    {salesAndCOGS.totalSales.toFixed(2)} د.أ
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                  <span className="font-medium">تكلفة البضاعة المباعة (COGS)</span>
                  <span className="text-xl font-bold text-orange-700">
                    - {salesAndCOGS.totalCOGS.toFixed(2)} د.أ
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <span className="font-bold text-lg">إجمالي الربح</span>
                  <span className="text-2xl font-bold text-blue-700">
                    {salesAndCOGS.grossProfit.toFixed(2)} د.أ
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    💡 هامش الربح الإجمالي = (إجمالي الربح ÷ المبيعات) × 100 ={" "}
                    <span className="font-bold text-purple-600">
                      {salesAndCOGS.grossMargin.toFixed(2)}%
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixed Assets Summary */}
        <TabsContent value="fixed-assets" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  إجمالي التكلفة الأصلية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {fixedAssetsSummary.totalCost.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  مجمع الاستهلاك
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {fixedAssetsSummary.totalAccumulatedDepreciation.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  صافي القيمة الدفترية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {fixedAssetsSummary.totalBookValue.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  الاستهلاك الشهري
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {fixedAssetsSummary.monthlyDepreciation.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تفصيل الأصول الثابتة</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
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
                >
                  <Download className="w-4 h-4 ml-2" />
                  تصدير CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الأصل</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>التكلفة الأصلية</TableHead>
                    <TableHead>مجمع الاستهلاك</TableHead>
                    <TableHead className="text-left">القيمة الدفترية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedAssetsSummary.activeAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.assetName}</TableCell>
                      <TableCell>{asset.category}</TableCell>
                      <TableCell>{asset.purchaseCost.toFixed(2)} د.أ</TableCell>
                      <TableCell>
                        {asset.accumulatedDepreciation.toFixed(2)} د.أ
                      </TableCell>
                      <TableCell className="text-left font-medium">
                        {asset.bookValue.toFixed(2)} د.أ
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={4} className="font-bold">
                      المجموع الكلي
                    </TableCell>
                    <TableCell className="text-left font-bold text-blue-700">
                      {fixedAssetsSummary.totalBookValue.toFixed(2)} د.أ
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance Report */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>ميزان المراجعة (Trial Balance)</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    التحقق من توازن الحسابات - المدين = الدائن
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
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
                >
                  <Download className="w-4 h-4 ml-2" />
                  تصدير CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">اسم الحساب</TableHead>
                    <TableHead className="text-right">المدين (Debit)</TableHead>
                    <TableHead className="text-right">الدائن (Credit)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const categoryTotals: {
                      [key: string]: { debit: number; credit: number };
                    } = {};
                    let totalDebit = 0;
                    let totalCredit = 0;
                    let accountsReceivable = 0;
                    let accountsPayable = 0;

                    // Calculate totals by category and AR/AP
                    ledgerEntries.forEach((entry) => {
                      const category = entry.category || "غير مصنف";
                      if (!categoryTotals[category]) {
                        categoryTotals[category] = { debit: 0, credit: 0 };
                      }

                      if (entry.type === "دخل" || entry.type === "إيراد") {
                        categoryTotals[category].credit += entry.amount;
                        totalCredit += entry.amount;

                        // Track accounts receivable (unpaid income)
                        if (entry.isARAPEntry && entry.remainingBalance && entry.remainingBalance > 0) {
                          accountsReceivable += entry.remainingBalance;
                        }
                      } else if (entry.type === "مصروف") {
                        categoryTotals[category].debit += entry.amount;
                        totalDebit += entry.amount;

                        // Track accounts payable (unpaid expenses)
                        if (entry.isARAPEntry && entry.remainingBalance && entry.remainingBalance > 0) {
                          accountsPayable += entry.remainingBalance;
                        }
                      }
                    });

                    // Calculate net cash from payments
                    let cashBalance = 0;
                    payments.forEach((payment) => {
                      if (payment.type === "قبض") {
                        cashBalance += payment.amount;
                      } else if (payment.type === "صرف") {
                        cashBalance -= payment.amount;
                      }
                    });

                    // Add cash to trial balance (debit if positive, credit if negative)
                    if (cashBalance > 0) {
                      totalDebit += cashBalance;
                    } else if (cashBalance < 0) {
                      totalCredit += Math.abs(cashBalance);
                    }

                    // Add AR to debit
                    if (accountsReceivable > 0) {
                      totalDebit += accountsReceivable;
                    }

                    // Add AP to credit
                    if (accountsPayable > 0) {
                      totalCredit += accountsPayable;
                    }

                    const difference = Math.abs(totalDebit - totalCredit);
                    const isBalanced = difference < 0.01; // Allow for rounding errors

                    return (
                      <>
                        {/* Cash Account */}
                        {cashBalance !== 0 && (
                          <TableRow>
                            <TableCell className="font-medium">الصندوق (النقدية)</TableCell>
                            <TableCell className="text-right">
                              {cashBalance > 0 ? `${cashBalance.toFixed(2)} د.أ` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {cashBalance < 0 ? `${Math.abs(cashBalance).toFixed(2)} د.أ` : "-"}
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Accounts Receivable */}
                        {accountsReceivable > 0 && (
                          <TableRow>
                            <TableCell className="font-medium">حسابات مدينة (ذمم عملاء)</TableCell>
                            <TableCell className="text-right">
                              {accountsReceivable.toFixed(2)} د.أ
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                          </TableRow>
                        )}

                        {/* Accounts Payable */}
                        {accountsPayable > 0 && (
                          <TableRow>
                            <TableCell className="font-medium">حسابات دائنة (ذمم موردين)</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">
                              {accountsPayable.toFixed(2)} د.أ
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Category Accounts */}
                        {Object.entries(categoryTotals)
                          .sort(([a], [b]) => a.localeCompare(b, "ar"))
                          .map(([category, totals]) => (
                            <TableRow key={category}>
                              <TableCell className="font-medium">{category}</TableCell>
                              <TableCell className="text-right">
                                {totals.debit > 0 ? `${totals.debit.toFixed(2)} د.أ` : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {totals.credit > 0
                                  ? `${totals.credit.toFixed(2)} د.أ`
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}

                        {/* Totals Row */}
                        <TableRow className="bg-gray-100 font-bold">
                          <TableCell>المجموع الكلي</TableCell>
                          <TableCell className="text-right text-blue-700">
                            {totalDebit.toFixed(2)} د.أ
                          </TableCell>
                          <TableCell className="text-right text-blue-700">
                            {totalCredit.toFixed(2)} د.أ
                          </TableCell>
                        </TableRow>

                        {/* Balance Verification */}
                        <TableRow
                          className={
                            isBalanced ? "bg-green-50" : "bg-red-50"
                          }
                        >
                          <TableCell colSpan={3} className="text-center">
                            {isBalanced ? (
                              <span className="text-green-700 font-semibold flex items-center justify-center gap-2">
                                ✓ الميزان متوازن - المدين = الدائن
                              </span>
                            ) : (
                              <span className="text-red-700 font-semibold flex items-center justify-center gap-2">
                                ⚠ فرق في الميزان: {difference.toFixed(2)} د.أ
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })()}
                </TableBody>
              </Table>

              {ledgerEntries.length === 0 && payments.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  لا توجد بيانات لعرض ميزان المراجعة
                </p>
              )}
            </CardContent>
          </Card>

          {/* Explanation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ما هو ميزان المراجعة؟</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>ميزان المراجعة (Trial Balance)</strong> هو تقرير محاسبي يعرض
                جميع الحسابات مع أرصدتها المدينة والدائنة في نهاية فترة معينة.
              </p>
              <p>
                <strong>الهدف الرئيسي:</strong> التحقق من أن مجموع المبالغ المدينة =
                مجموع المبالغ الدائنة (القيد المزدوج).
              </p>
              <div className="bg-blue-50 p-3 rounded-lg mt-3">
                <p className="font-medium text-blue-900">القاعدة الذهبية:</p>
                <p className="text-blue-800">
                  • <strong>المدين (Debit):</strong> المصروفات، الأصول، المسحوبات
                </p>
                <p className="text-blue-800">
                  • <strong>الدائن (Credit):</strong> الإيرادات، الخصوم، رأس المال
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
