"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Line,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Users, DollarSign, TrendingUp, TrendingDown, Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, StatCardSkeleton } from "@/components/ui/loading-skeleton";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { toDate } from "@/lib/firestore-utils";
import { CASH_FLOW_LABELS } from "@/lib/constants";

// Modern chart color palette
const CHART_COLORS = {
  primary: "#3b82f6",      // Blue
  success: "#22c55e",      // Green
  danger: "#ef4444",       // Red
  warning: "#f59e0b",      // Amber
  info: "#06b6d4",         // Cyan
  purple: "#8b5cf6",       // Purple
  pink: "#ec4899",         // Pink
  slate: "#64748b",        // Gray

  // For pie/donut charts - harmonious palette
  pieColors: [
    "#3b82f6", // Blue
    "#22c55e", // Green
    "#f59e0b", // Amber
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#64748b", // Slate
  ],
};

// Modern tooltip styles
const tooltipStyle = {
  contentStyle: {
    backgroundColor: "white",
    border: "none",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    padding: "12px",
  },
  labelStyle: { color: "#334155", fontWeight: 600, marginBottom: "4px" },
};

// Chart skeleton for loading state
function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-slate-400">جاري تحميل الرسم البياني...</span>
    </div>
  );
}

// Lazy load heavy chart components
const LazyLineChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.LineChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LazyBarChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.BarChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LazyPieChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.PieChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LazyComposedChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: Date;
  associatedParty?: string;
  description?: string;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  date: Date;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [clientsCount, setClientsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentClients, setRecentClients] = useState<any[]>([]);

  // Loading states
  const [statsLoading, setStatsLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  // Chart data states
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);

  // Load clients count
  useEffect(() => {
    if (!user) {return;}

    const clientsRef = collection(firestore, `users/${user.uid}/clients`);
    const unsubscribe = onSnapshot(clientsRef, (snapshot) => {
      setClientsCount(snapshot.size);

      // Get recent clients (last 5)
      const clients: any[] = [];
      snapshot.docs.slice(0, 5).forEach((doc) => {
        clients.push({ id: doc.id, ...doc.data() });
      });
      setRecentClients(clients);
      setClientsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load ledger data for revenue, expenses, and charts
  useEffect(() => {
    if (!user) {return;}

    const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
    const unsubscribe = onSnapshot(ledgerRef, (snapshot) => {
      let revenue = 0;
      let expenses = 0;
      let sales = 0;
      const transactions: LedgerEntry[] = [];

      // Monthly aggregation
      const monthlyMap: { [key: string]: { revenue: number; expenses: number; profit: number } } = {};

      // Customer revenue aggregation
      const customerMap: { [key: string]: number } = {};

      // Expense categories
      const categoryMap: { [key: string]: number } = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const entry: LedgerEntry = {
          id: doc.id,
          type: data.type || "",
          amount: data.amount || 0,
          category: data.category || "",
          date: toDate(data.date),
          associatedParty: data.associatedParty,
          description: data.description,
        };

        // Calculate totals (EXCLUDE owner equity from P&L)
        const isOwnerEquity = entry.category === "رأس المال" || entry.category === "Owner Equity";

        if (!isOwnerEquity) {
          if (entry.type === "دخل" || entry.type === "إيراد") {
            revenue += entry.amount;
            sales++;

            // Track by customer
            if (entry.associatedParty) {
              customerMap[entry.associatedParty] = (customerMap[entry.associatedParty] || 0) + entry.amount;
            }
          } else if (entry.type === "مصروف") {
            expenses += entry.amount;

            // Track by category
            if (entry.category) {
              categoryMap[entry.category] = (categoryMap[entry.category] || 0) + entry.amount;
            }
          }

          // Monthly aggregation (excluding owner equity)
          // Use UTC to avoid timezone shifting the month
          const monthKey = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth() + 1).padStart(2, '0')}`;
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { revenue: 0, expenses: 0, profit: 0 };
          }

          if (entry.type === "دخل" || entry.type === "إيراد") {
            monthlyMap[monthKey].revenue += entry.amount;
          } else if (entry.type === "مصروف") {
            monthlyMap[monthKey].expenses += entry.amount;
          }
        }

        transactions.push(entry);
      });

      // Calculate profit for each month
      Object.keys(monthlyMap).forEach(month => {
        monthlyMap[month].profit = monthlyMap[month].revenue - monthlyMap[month].expenses;
      });

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setSalesCount(sales);

      // Sort by date and get last 5 transactions
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(transactions.slice(0, 5));

      // Prepare monthly chart data (last 6 months with actual data)
      const monthlyArray = Object.entries(monthlyMap)
        .filter(([, data]) => data.revenue > 0 || data.expenses > 0) // Only include months with actual transactions
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => {
          // Parse year and month from "YYYY-MM" format to avoid timezone issues
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 15); // Use day 15 to avoid timezone edge cases
          return {
            month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            الإيرادات: data.revenue,
            المصروفات: data.expenses,
            الربح: data.profit,
          };
        });
      setMonthlyData(monthlyArray);

      // Top 5 customers
      const topCustomersArray = Object.entries(customerMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));
      setTopCustomers(topCustomersArray);

      // Top expense categories
      const categoryArray = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
      setExpensesByCategory(categoryArray);
      setTransactionsLoading(false);
      setStatsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load payments for cash flow chart
  useEffect(() => {
    if (!user) {return;}

    const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
    const unsubscribe = onSnapshot(paymentsRef, (snapshot) => {
      const monthlyMap: { [key: string]: { cashIn: number; cashOut: number } } = {};
      let totalIn = 0;
      let totalOut = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const date = toDate(data.date);
        // Use UTC to avoid timezone shifting the month
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { cashIn: 0, cashOut: 0 };
        }

        // Skip endorsed cheques and no-cash-movement payments
        if (data.isEndorsement || data.noCashMovement) {
          return;
        }

        if (data.type === "قبض") {
          monthlyMap[monthKey].cashIn += data.amount || 0;
          totalIn += data.amount || 0;
        } else if (data.type === "صرف") {
          monthlyMap[monthKey].cashOut += data.amount || 0;
          totalOut += data.amount || 0;
        }
      });

      setTotalCashIn(totalIn);
      setTotalCashOut(totalOut);

      // Prepare cash flow chart data (last 6 months with actual data)
      const cashFlowArray = Object.entries(monthlyMap)
        .filter(([, data]) => data.cashIn > 0 || data.cashOut > 0) // Only include months with actual transactions
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => {
          // Parse year and month from "YYYY-MM" format to avoid timezone issues
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 15); // Use day 15 to avoid timezone edge cases
          return {
            month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            [CASH_FLOW_LABELS.CASH_IN]: data.cashIn,
            [CASH_FLOW_LABELS.CASH_OUT]: data.cashOut,
            "صافي التدفق": data.cashIn - data.cashOut,
          };
        });
      setCashFlowData(cashFlowArray);
    });

    return () => unsubscribe();
  }, [user]);

  // Load inventory count
  useEffect(() => {
    if (!user) {return;}

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      setInventoryCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  const netCashFlow = totalCashIn - totalCashOut;

  // Calculate net profit
  const netProfit = totalRevenue - totalExpenses;

  // Memoize stats with modern styling (using Tailwind built-in colors for reliability)
  const stats = useMemo(() => [
    {
      title: "إجمالي العملاء",
      value: clientsCount.toString(),
      icon: Users,
      cardClass: "stats-card-primary",
      iconBgClass: "bg-blue-100",
      iconClass: "text-blue-600",
      valueClass: "text-slate-900",
    },
    {
      title: "الإيرادات",
      value: `${totalRevenue.toFixed(2)} دينار`,
      icon: TrendingUp,
      cardClass: "stats-card-success",
      iconBgClass: "bg-green-100",
      iconClass: "text-green-600",
      valueClass: "text-green-700",
    },
    {
      title: "المصروفات",
      value: `${totalExpenses.toFixed(2)} دينار`,
      icon: TrendingDown,
      cardClass: "stats-card-danger",
      iconBgClass: "bg-red-100",
      iconClass: "text-red-600",
      valueClass: "text-red-700",
    },
    {
      title: "صافي الربح",
      value: `${netProfit.toFixed(2)} دينار`,
      icon: DollarSign,
      cardClass: "",
      iconBgClass: netProfit >= 0 ? "bg-green-100" : "bg-red-100",
      iconClass: netProfit >= 0 ? "text-green-600" : "text-red-600",
      valueClass: netProfit >= 0 ? "text-green-700" : "text-red-700",
    },
    {
      title: "صافي التدفق النقدي",
      value: `${netCashFlow.toFixed(2)} دينار`,
      icon: Activity,
      cardClass: "stats-card-warning",
      iconBgClass: "bg-amber-100",
      iconClass: "text-amber-600",
      valueClass: netCashFlow >= 0 ? "text-green-700" : "text-red-700",
    },
  ], [clientsCount, totalRevenue, totalExpenses, netProfit, netCashFlow]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">لوحة التحكم</h1>
        <p className="text-slate-600 mt-2">نظرة عامة على إحصائيات المصنع</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className={`card-modern ${stat.cardClass} group cursor-default`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-600">
                        {stat.title}
                      </p>
                      <p className={`text-2xl font-bold ${stat.valueClass}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-xl ${stat.iconBgClass} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`h-6 w-6 ${stat.iconClass}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Charts Row 1: Revenue vs Expenses + Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Trend */}
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              الإيرادات والمصروفات (آخر 6 أشهر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LazyLineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} دينار`,
                    name
                  ]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span style={{ color: "#475569", fontSize: "14px" }}>{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="الإيرادات"
                  stroke={CHART_COLORS.success}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.success, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="المصروفات"
                  stroke={CHART_COLORS.danger}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.danger, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="الربح"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LazyLineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cash Flow */}
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              التدفق النقدي (آخر 6 أشهر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LazyComposedChart data={cashFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} دينار`,
                    name
                  ]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span style={{ color: "#475569", fontSize: "14px" }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey={CASH_FLOW_LABELS.CASH_IN}
                  fill={CHART_COLORS.success}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey={CASH_FLOW_LABELS.CASH_OUT}
                  fill={CHART_COLORS.danger}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  type="monotone"
                  dataKey="صافي التدفق"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                />
              </LazyComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Customers + Expenses by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              أفضل 5 عملاء (حسب الإيرادات)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">لا توجد بيانات بعد</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LazyBarChart
                  data={topCustomers}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#334155", fontSize: 13 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} دينار`, "الإيرادات"]}
                  />
                  <Bar
                    dataKey="amount"
                    fill={CHART_COLORS.primary}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={24}
                  />
                </LazyBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              المصروفات حسب الفئة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-slate-500 text-center py-8">لا توجد مصروفات بعد</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LazyPieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {expensesByCategory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS.pieColors[index % CHART_COLORS.pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} دينار`]}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => (
                      <span style={{ color: "#475569", fontSize: "13px" }}>{value}</span>
                    )}
                  />
                </LazyPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              آخر الحركات المالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <p className="text-slate-500 text-center py-8">لا توجد حركات مالية بعد</p>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors rounded-lg px-2 -mx-2"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{transaction.description || transaction.category}</div>
                      <div className="text-xs text-slate-500">
                        {transaction.date.toLocaleDateString("ar-EG")}
                      </div>
                    </div>
                    <div
                      className={`font-semibold ${
                        transaction.type === "دخل" || transaction.type === "إيراد"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "دخل" || transaction.type === "إيراد" ? "+" : "-"}
                      {transaction.amount.toFixed(2)} دينار
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              العملاء الجدد
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : recentClients.length === 0 ? (
              <p className="text-slate-500 text-center py-8">لا يوجد عملاء بعد</p>
            ) : (
              <div className="space-y-1">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors rounded-lg px-2 -mx-2"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{client.name}</div>
                      <div className="text-xs text-slate-500">
                        {client.phone || "لا يوجد رقم هاتف"}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {client.company || "لا توجد شركة"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
